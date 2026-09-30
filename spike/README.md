# Lightcurve hardware spike

Throwaway tooling to answer the questions that decide the scheduler design, before
any of the integration gets written. Nothing here imports Home Assistant; it talks
to a running HA over the WebSocket API, so it measures the real path a Lightcurve
command will take — through the TP-Link integration, over Wi-Fi, to the bulb.

## Setup

```bash
cd spike
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # then fill in HA_URL, HA_TOKEN, the bulb entity_ids
```

The token is a long-lived access token: HA sidebar → your profile → Security →
Long-lived access tokens → Create token.

## What to run

Two bulbs in one room is enough. Do it in the evening — the probes will strobe the
lights through the full range for a few minutes, and two of them need you watching.

```bash
python probe.py interference  # RUN FIRST: is anything else writing to these bulbs?
python discover.py            # what are my lights called? read-only
python probe.py info          # capabilities; confirms setup, ~1s, read-only
python probe.py all           # everything, ~5 min, restores state afterwards
python watch.py               # separate: watch the bus while you talk to Siri
```

`discover.py` lists every light grouped by HA area, with colour modes, kelvin range
and transition support, and flags areas whose members *disagree* on capabilities —
those are the areas where a wrapper light has to fall back to the intersection of
what all its members support. `--area Toilet` prints a pasteable
`LIGHTCURVE_SPIKE_ENTITIES` line. It needs an admin token to see areas; with a
non-admin token it still lists the lights, just ungrouped.

Each `probe.py` run writes `results/spike-<timestamp>.json`.

## What each probe decides

| Probe | Question | Feeds into |
|---|---|---|
| `info` | Does HA advertise `TRANSITION` on the L630? What's the real kelvin range and colour-mode set? | §9 min/max kelvin, whether transitions are on the table at all |
| `onestep` | Can on + colour + brightness land in one call with no intermediate state at the old colour? | The entire no-flash premise, §9 `turn_on()`, Phase 1 acceptance |
| `transition` | Does a 10 s transition produce a visible ramp, and does HA see it? | §8 `tick_seconds` and `default_transition_seconds` |
| `rounding` | How far does reported state drift from what was sent, across the range? | §10.1 tolerances — currently guessed at ±100 K / ±3 % |
| `modes` | How big is the CT↔RGB brightness jump on the L630? | §21 risk row; whether RGB keyframes are usable in practice |
| `latency` | Command latency alone and with all bulbs at once; failure rate | §8 `min_command_interval_seconds`, retry policy, §19 budget |
| `colours` | Hue fidelity, whether a dim saturated red survives to 1 %, and the CT↔RGB jump at realistic brightness | Appendix D.1 — whether a red night section is viable |
| `interference` | Is another integration writing to these bulbs? | Everything. Run it first |

**Run `interference` first.** Adaptive Lighting and anything like it writes to bulbs
on its own schedule, and its writes are indistinguishable from hardware behaviour
unless you are looking for them. An entire round of this spike was spent attributing
one integration's `adapt_brightness` to the L630's firmware — see Appendix C.4 and
C.5 in the spec for how that looked from the inside.

`transition` also quietly answers a fifth question that the spec gets wrong:
**do the state writes that follow our command carry our context?** The TP-Link
integration refreshes from the device after a command, and that refresh is a fresh
context. If any of those writes report a value more than 100 K from the target —
which they will, mid-transition — then §10.1's "ignore events with our context id"
is not enough on its own, and the room would be flagged overridden and silently
stop adapting. The probe counts those writes and prints the worst delta. Whatever
it reports is the size of the suppression window Lightcurve needs after each
command.

## Reading the transition result

One caveat matters. The integration refreshes from the device after a command, and
the device may report its *final* target while the LEDs are still fading. So:

- **HA sees a ramp** → transitions work, and `tick_seconds` can be long (60 s) with
  `transition ≈ tick`, which is both smoother and fewer commands.
- **HA sees no ramp, but the bulb visibly fades** → transitions work; HA just can't
  observe them. Same conclusion, and it makes override detection *easier* (no
  misleading intermediate values).
- **HA sees no ramp and the bulb snaps** → no transition support. The curve has to
  be stepped instead: shorter `tick_seconds` (20–30 s) with steps small enough to
  be imperceptible, and §8's transition parameter comes out of the design.

The script asks you which it was. Answer honestly — this is the one finding that
can't be automated.

## watch.py

Subscribes to `call_service` and `state_changed` and prints anything touching a
light, with full service data and context. Run it, then work through the phrases it
lists. The one to watch for is:

```
Hey Siri, set the lounge lights to 40%
Hey Siri, turn on the lounge lights      <- does THIS carry brightness: 102?
```

If HomeKit sends a remembered brightness alongside a bare "turn on", then §9's
rule ("`turn_on(brightness=…)` → brightness override") fires on every voice
turn-on, and the lights stop following the curve the first time anyone dims them.
Lightcurve then needs a rule that treats a brightness arriving on an off→on
transition, equal to the brightness the wrapper last reported, as a HomeKit restore
rather than a deliberate override.
