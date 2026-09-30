# Lightcurve — Custom Circadian Lighting Integration for Home Assistant

**Status:** Draft v0.1
**Owner:** Matt
**Domain:** `lightcurve`
**Date:** 30 September 2026

---

## 1. Summary

Lightcurve is a Home Assistant custom integration that drives smart lights along a user-defined 24-hour curve of colour (colour temperature or RGB) and brightness. Unlike Adaptive Lighting, it:

- applies the correct colour **in the same command that turns a light on** (no flash of the old colour), via wrapper light entities;
- lets the user draw the curve on a **graphical editor** with keyframes, rather than tuning min/max parameters;
- supports **custom RGB colours** in the curve, not just white temperature;
- handles **power-restore events** (load-shedding) deliberately.

## 2. Goals and non-goals

### Goals
1. A light that is on always shows the colour/brightness the curve dictates for the current time, unless deliberately overridden.
2. Turning a light on from any source (Siri, wall switch, dashboard, automation) produces the correct colour immediately.
3. Curves are edited visually in HA, on desktop and phone.
4. Works with Siri via HomeKit Bridge using room-level entities ("lounge lights", "toilet light").
5. Robust to Tapo quirks: slow commands, rounded state reporting, dropping offline, restoring at default state after power loss.

### Non-goals (v1)
- Animated effects (colour loops, strobing, music sync).
- Adding/provisioning bulbs (done via Tapo app + TP-Link integration).
- Cloud control or non-HA clients.
- Multiple Lightcurve instances per HA install.
- Controlling the wall switch relay itself.

## 3. Environment and constraints

| Item | Detail |
|---|---|
| Bulbs | TP-Link Tapo L630 GU10, Wi-Fi, 2200–6500 K, RGB, 350 lm, local control via HA TP-Link Smart Home integration |
| Hub | Home Assistant (current 2026 release) |
| Voice | Siri via HA HomeKit Bridge, HomePod mini as home hub |
| Wall control | Sonoff Matter switch, relay to be left permanently on (detached mode) |
| Location | Durban, SA — sun times from HA configured location |
| Power | Load-shedding possible; bulbs power up at their default/last state when mains returns |

**Known Tapo behaviours to design around**
- Command latency ~300–800 ms; occasional timeouts.
- Reported colour temp/brightness is rounded; state won't exactly match what was sent.
- The L630 uses separate LED channels for white and RGB; switching between CT and RGB modes can cause a visible brightness jump.
- Firmware updates can change the local protocol (e.g. TPAP) and temporarily break local control.

## 4. Glossary

- **Member light** — a real bulb entity (e.g. `light.lounge_spot_1`).
- **Room** — a named set of member lights driven together by one profile.
- **Wrapper light** — the entity Lightcurve creates per room (e.g. `light.lounge_curve`). This is what users, Siri and automations control.
- **Profile** — a named 24-hour curve made of keyframes.
- **Keyframe** — a point on the curve: time, colour, brightness, easing.
- **Target** — the colour/brightness the curve dictates for a room right now.
- **Override** — a state where a room (or one channel of it) stops following the curve because someone changed it manually.

## 5. Functional requirements

### Curves and profiles
- **FR-1** A profile consists of 2–48 keyframes spanning a 24-hour cycle that wraps at midnight.
- **FR-2** A keyframe time is either fixed (`HH:MM`) or sun-relative (`sunrise`, `sunset`, `solar_noon`, `dawn`, `dusk` ± offset in minutes).
- **FR-3** A keyframe colour is either a colour temperature in kelvin or an RGB/HS colour.
- **FR-4** A keyframe brightness is 1–100 %.
- **FR-5** Each keyframe defines the easing into the *next* keyframe: `linear`, `ease_in_out` or `step`.
- **FR-6** Profiles can have day variants: `default`, optionally `weekday` and `weekend` (v3).
- **FR-7** Each room has a sleep mode with its own fixed colour/brightness (or a sleep profile), toggled by a switch entity.

### Rooms and wrapper lights
- **FR-8** Each room creates one wrapper light entity plus supporting entities (§10).
- **FR-9** Turning on the wrapper with no parameters turns on all members at the current target, in a single command per bulb.
- **FR-10** Turning on the wrapper with explicit parameters (e.g. Siri "set lounge to 30 %") applies them and creates an override for the affected channel(s) only.
- **FR-11** Turning off the wrapper turns off all members and clears overrides for that room.
- **FR-12** Wrapper state reflects members: on if any member is on; attributes show the current target.

### Scheduling
- **FR-13** While a room is on and not overridden, members are updated as the curve progresses.
- **FR-14** Updates are only sent when the change is perceptible (thresholds in §8).
- **FR-15** Transitions between updates are smooth (configurable transition time).

### Overrides
- **FR-16** A change to a member or wrapper not made by Lightcurve creates an override for that room. This includes changes from Siri, the Tapo app, scenes and other automations.
- **FR-17** Overrides are per channel: colour and brightness can be overridden independently. For example, Siri dimming leaves colour following the curve.
- **FR-18** An override clears when the room is turned off and on again, when the configurable timeout expires (default: none), or when the `resume` service is called.

### Power and availability
- **FR-19** When a member returns from `unavailable` in the `on` state, Lightcurve handles it per the room's `power_restore` setting: `apply_curve` (default), `turn_off`, or `restore_previous` (the state before it went unavailable).
- **FR-20** A member that is unavailable is skipped without blocking commands to other members.

### Editor
- **FR-21** A sidebar panel shows each profile as a 24-hour graph with draggable keyframes, a colour-gradient lane and a brightness lane.
- **FR-22** The editor shows sunrise/sunset markers and a "now" line for today.
- **FR-23** The editor can preview any time of day on a chosen room's real lights.
- **FR-24** The editor validates profiles and blocks saving invalid ones (§13.4).

## 6. Data model

Persisted with `homeassistant.helpers.storage.Store`, key `lightcurve`, version 1.

```json
{
  "version": 1,
  "settings": {
    "tick_seconds": 60,
    "default_transition_seconds": 30,
    "kelvin_threshold": 50,
    "brightness_threshold_pct": 2,
    "min_command_interval_seconds": 10
  },
  "profiles": {
    "p_default": {
      "id": "p_default",
      "name": "Everyday",
      "variants": {
        "default": {
          "keyframes": [
            { "id": "k1", "time": { "type": "fixed", "value": "00:00" },
              "colour": { "mode": "kelvin", "kelvin": 2200 },
              "brightness": 10, "easing": "linear" },
            { "id": "k2", "time": { "type": "sun", "event": "sunrise", "offset_min": 0 },
              "colour": { "mode": "kelvin", "kelvin": 3000 },
              "brightness": 60, "easing": "ease_in_out" },
            { "id": "k3", "time": { "type": "sun", "event": "solar_noon", "offset_min": 0 },
              "colour": { "mode": "kelvin", "kelvin": 5500 },
              "brightness": 100, "easing": "ease_in_out" },
            { "id": "k4", "time": { "type": "sun", "event": "sunset", "offset_min": -30 },
              "colour": { "mode": "kelvin", "kelvin": 3200 },
              "brightness": 80, "easing": "ease_in_out" },
            { "id": "k5", "time": { "type": "fixed", "value": "21:30" },
              "colour": { "mode": "kelvin", "kelvin": 2200 },
              "brightness": 30, "easing": "linear" }
          ]
        }
      }
    }
  },
  "rooms": {
    "r_lounge": {
      "id": "r_lounge",
      "name": "Lounge",
      "members": ["light.lounge_spot_1", "light.lounge_spot_2"],
      "profile_id": "p_default",
      "variant_schedule": "default",
      "sleep": { "kelvin": 2200, "brightness": 5 },
      "override_timeout_minutes": null,
      "power_restore": "apply_curve",
      "enabled": true
    }
  }
}
```

Runtime-only state (not persisted, rebuilt on start): current target per room, override flags per room/channel, our in-flight context IDs, last command time per bulb, pre-outage state per bulb.

## 7. Curve engine

Pure Python module (`engine.py`) with no HA imports, so it's unit-testable in isolation.

### 7.1 Resolving keyframe times
1. For the evaluation date, resolve each keyframe to a local datetime. Sun events come from `homeassistant.helpers.sun.get_astral_event_date` using HA's configured location.
2. Sort resolved keyframes by time. If sun-relative keyframes swap order with fixed ones (e.g. in winter), sort order wins and the editor shows a warning (§13.4).
3. The curve wraps: the segment after the last keyframe runs to the first keyframe of the next day.

### 7.2 Interpolation
Given `now`, find the surrounding keyframes A and B, compute `t = (now − A) / (B − A)`, then apply easing:
- `linear`: `t`
- `ease_in_out`: `t² (3 − 2t)` (smoothstep)
- `step`: `0` (hold A until B)

**Colour**
- Both kelvin → interpolate in **mireds** (`1e6 / K`), convert back. This is perceptually more even than interpolating kelvin directly.
- Either endpoint RGB → convert kelvin endpoints to RGB (`homeassistant.util.color.color_temperature_to_rgb`), interpolate in **Oklab**, output RGB/HS.
- Output mode for the segment: kelvin if both endpoints are kelvin, otherwise HS. The editor warns on CT↔RGB segments (brightness jump risk on L630).

**Brightness** — linear interpolation of the eased `t` in percent, rounded to an integer, then mapped to HA's 1–255 scale.

### 7.3 Clamping
Clamp output kelvin to the intersection of member lights' `min_color_temp_kelvin`/`max_color_temp_kelvin`. For RGB, drop members that don't support HS/RGB colour mode and log a warning once.

### 7.4 Output
```python
@dataclass
class Target:
    mode: Literal["kelvin", "hs"]
    kelvin: int | None
    hs: tuple[float, float] | None
    brightness_pct: int
    segment: tuple[str, str]   # keyframe ids
    evaluated_at: datetime
```

`evaluate(profile, date, now) -> Target` and `sample(profile, date, step_minutes) -> list[Target]` (for the editor graph).

## 8. Scheduler and update policy

- A single `async_track_time_interval` tick every `tick_seconds` (default 60 s).
- On each tick, for each enabled room that is on:
  1. Compute the target (or sleep values if sleep mode is on).
  2. Skip channels that are overridden.
  3. Compare against the last target sent. Skip if |Δmired| is below the equivalent of `kelvin_threshold` and |Δbrightness| < `brightness_threshold_pct`.
  4. Send `light.turn_on` to members with `transition = min(default_transition_seconds, tick_seconds)`.
- Per-bulb lock plus `min_command_interval_seconds` rate limit, so a slow Tapo bulb doesn't get stacked commands.
- Commands to members run concurrently (`asyncio.gather`). Failures are retried once with 2 s backoff, then logged. They never block other bulbs.
- Also recompute immediately on: HA start, sun event changes (new day), profile save, sleep toggle, override resume.

## 9. Wrapper light behaviour

`LightcurveRoomLight(LightEntity)`

- **Supported colour modes:** `{COLOR_TEMP, HS}` (only those supported by all members).
- **Min/max kelvin:** intersection of member ranges.
- **turn_on()** with no kwargs:
  1. Compute the current target.
  2. Call `light.turn_on` on each member with target colour + brightness and `transition: 0`, in one call per bulb.
  3. Clear overrides for the room.
- **turn_on(brightness=…)** only: apply target colour with the requested brightness; set brightness override.
- **turn_on(color_temp_kelvin=… or hs_color=…)**: apply requested colour with target brightness; set colour override.
- **turn_off()**: turn off members; clear overrides.
- **State:** `on` if any available member is on. Brightness/colour attributes mirror the target actually applied.
- **Extra attributes:** `profile`, `target_kelvin`, `target_hs`, `target_brightness_pct`, `override_colour`, `override_brightness`, `override_until`, `next_keyframe_at`.

All commands Lightcurve issues use a `Context` it creates and records, so override detection (§10.1) can ignore them.

## 10. Entities per room

| Entity | Purpose |
|---|---|
| `light.<room>_curve` | Wrapper light (exposed to HomeKit/Siri) |
| `switch.<room>_curve_enabled` | Enable/disable curve for the room (when off, the wrapper behaves like a plain light group) |
| `switch.<room>_sleep_mode` | Sleep mode (can be exposed to Siri: "turn on lounge sleep mode") |
| `sensor.<room>_curve_target` | State = target kelvin (or `rgb`), attributes = full target |
| `binary_sensor.<room>_curve_override` | On while any channel is overridden |

### 10.1 Override detection
- Listen to `state_changed` for all member lights and wrapper lights.
- Ignore events whose `context.id` (or `context.parent_id`) is one of ours.
- Compare the new state against the last target sent, using tolerances: ±100 K (Tapo rounds), ±3 % brightness, ±5° hue.
- A change outside tolerance sets an override on the affected channel(s). Colour-only change → colour override; brightness-only → brightness override.
- A member going off while others stay on does not create an override.

## 11. Power restore handling

- Track each member's last known state before it becomes `unavailable`.
- When it becomes available again:
  - `apply_curve`: if on, apply the current target with `transition: 0`.
  - `turn_off`: if on, turn it off. Useful if power returns at 02:00 and you don't want every light blazing.
  - `restore_previous`: set it to the state it was in before the outage (off if it was off).
- A debounce (default 10 s) handles bulbs reconnecting in waves after a grid restore.

## 12. Services

| Service | Fields | Behaviour |
|---|---|---|
| `lightcurve.apply_now` | `target` (rooms/wrappers) | Recompute and push the target now, ignoring thresholds |
| `lightcurve.pause` | `target`, `duration_minutes` (optional), `channels` (colour/brightness/both) | Manually set an override |
| `lightcurve.resume` | `target` | Clear overrides and apply the target |
| `lightcurve.set_profile` | `room`, `profile_id` | Switch a room's profile |
| `lightcurve.preview` | `room`, `time`, `duration_seconds` | Show the target for a given time on the room's lights, then revert |

## 13. Editor panel

### 13.1 Tech
- TypeScript + Lit, built with Vite into a single `lightcurve-panel.js`.
- Registered as a sidebar panel via `panel_custom`, served with `hass.http.async_register_static_paths`.
- Rendering in plain SVG (d3-scale for axes is acceptable, nothing heavier).
- Uses the HA theme CSS variables so it works in light/dark mode.

### 13.2 Websocket API
| Command | Purpose |
|---|---|
| `lightcurve/profiles/list`, `/get`, `/create`, `/update`, `/delete` | Profile CRUD |
| `lightcurve/rooms/list`, `/create`, `/update`, `/delete` | Room CRUD, including member selection |
| `lightcurve/evaluate` | Returns sampled targets for a profile/date/step (drives the graph) |
| `lightcurve/sun` | Returns today's sun event times |
| `lightcurve/preview/start`, `/stop` | Live preview on a room |
| `lightcurve/subscribe` | Pushes live room state (target, overrides) |

All commands require an admin user.

### 13.3 Layout
- **Header:** profile selector, room selector (for preview), day-variant tabs, Save/Undo.
- **Graph area** (x = 00:00–24:00):
  - **Colour lane:** a gradient strip rendered from `evaluate` samples every 5 minutes, showing the actual resulting colours.
  - **Brightness lane:** a line from 0–100 %, with keyframe handles.
  - Vertical markers for dawn, sunrise, solar noon, sunset, dusk; a "now" line.
- **Keyframe interactions:**
  - Drag horizontally to change time (snaps to 5 min, or to a sun event when dragged close to it, which converts it to sun-relative).
  - Drag vertically to change brightness.
  - Tap to open a side sheet: time type (fixed/sun + offset), colour mode (kelvin slider limited to the room's supported range, or colour picker), brightness, easing.
  - Double-tap empty space to add a keyframe; delete from the side sheet.
- **Preview scrubber:** drag along the timeline and the selected room's real lights follow in real time (throttled to 1 update/s). Releasing reverts to the current target.
- **Mobile:** vertical stacking, larger touch handles (min 44 px), side sheet becomes a bottom sheet.

### 13.4 Validation
- At least 2 keyframes; max 48.
- No two keyframes resolving within 5 minutes of each other on any day of the year (check sun offsets across the year).
- Warn (not block): sun-relative keyframes that cross fixed ones at some point in the year; CT↔RGB segments; kelvin values outside the selected room's range.

## 14. HomeKit and Siri

- In HomeKit Bridge (include mode), expose only wrapper lights and optionally `switch.<room>_sleep_mode`. Do **not** expose member bulbs.
- In the Apple Home app, place each wrapper in its room and name it simply ("Lounge Lights", "Toilet Light").
- Expected voice behaviour:
  - "Turn on the lounge lights" → on at the current curve target.
  - "Set the lounge lights to 40 %" → brightness override, colour keeps following the curve.
  - "Make the lounge lights blue" → colour override until off/on.
  - "Turn off the lounge lights" → off, overrides cleared.

## 15. Wall switch

Out of scope for the integration, but documented setup:
- Sonoff relay in detached mode, bulbs permanently powered.
- An automation toggles the wrapper on the switch's button event:

```yaml
alias: Lounge wall switch toggles curve lights
triggers:
  - trigger: state
    entity_id: event.lounge_switch_button
actions:
  - action: light.toggle
    target:
      entity_id: light.lounge_curve
```

v3 option: a per-room `toggle_trigger_entity` setting so no automation is needed.

## 16. Config flow

- **Config flow:** single instance, creates the integration and a default "Everyday" profile.
- **Options flow:** global settings from §6 (`tick_seconds`, thresholds, transition, rate limit).
- Rooms and profiles are managed in the panel. A basic options-flow room editor is provided in phase 1, before the panel exists.

## 17. Project structure

```
lightcurve/
├── custom_components/lightcurve/
│   ├── __init__.py          # setup, storage load, scheduler start
│   ├── manifest.json
│   ├── config_flow.py
│   ├── const.py
│   ├── engine.py            # pure curve maths
│   ├── store.py             # Store wrapper + migrations
│   ├── coordinator.py       # scheduler, override + power-restore logic
│   ├── light.py             # wrapper lights
│   ├── switch.py            # enabled + sleep switches
│   ├── sensor.py
│   ├── binary_sensor.py
│   ├── services.py / services.yaml
│   ├── websocket_api.py
│   ├── panel.py             # panel + static path registration
│   ├── translations/en.json
│   └── frontend/dist/lightcurve-panel.js
├── frontend/                # Lit + TS source, Vite config
├── tests/
├── hacs.json
└── README.md
```

## 18. Testing

- **Engine unit tests** (pure pytest): interpolation, mired maths, Oklab, wrap-around at midnight, sun-relative resolution across solstices, easing, clamping.
- **Integration tests** (`pytest-homeassistant-custom-component` + freezegun):
  - wrapper turn_on applies target in one command;
  - scheduler thresholds and rate limiting;
  - override detection from foreign contexts, and non-detection of our own;
  - per-channel overrides;
  - power restore for each mode;
  - storage migration.
- **Frontend:** vitest for time↔pixel geometry and validation; manual testing on phone and desktop.
- **Soak test:** run 72 h on real L630s, logging command counts and failures.

## 19. Non-functional requirements

- Tick processing for 10 rooms / 30 bulbs under 50 ms (excluding network I/O).
- No more than 1 command per bulb per `min_command_interval_seconds`.
- Survives HA restart with no user action; applies targets within 5 s of start.
- All errors logged once per cause, not every tick.

## 20. Phases and acceptance criteria

### Phase 1 — MVP
Engine, store, config/options flow, wrapper light, enabled switch, target sensor, scheduler, override detection (whole-room), power restore (`apply_curve` only), `apply_now`/`resume` services. One JSON-defined profile.
**Accept when:** "Hey Siri, turn on the lounge lights" at any time of day produces the correct colour immediately with no flash, and the colour follows the curve for 24 h without intervention.

### Phase 2 — Editor
Panel, websocket API, graph editing, validation, preview scrubber, multiple profiles, room CRUD in the UI.
**Accept when:** a profile can be created, edited and assigned entirely from the phone, and preview drives real bulbs.

### Phase 3 — Extras
Per-channel overrides, sleep mode, day variants, all power-restore modes, override timeout, `toggle_trigger_entity`, HACS publication.
**Accept when:** all FRs are met and the 72 h soak test passes.

## 21. Risks

| Risk | Mitigation |
|---|---|
| Tapo firmware changes break local control | Out of our control; surface member unavailability clearly on the wrapper and target sensor |
| Tapo state rounding causes false overrides | Tolerances in §10.1, tunable in settings |
| CT↔RGB transitions look jumpy on L630 | Editor warnings; recommend kelvin-only curves for everyday use |
| HomeKit Bridge caches entity capabilities | Document: reset the bridge accessory if colour modes change |
| Sun-relative keyframes reorder seasonally | Sort-after-resolve plus year-round validation |

## 22. Open questions

1. Which rooms and how many bulbs in each? (Affects default rooms and testing.)
2. Override behaviour: clear on off/on only, or also after a timeout (e.g. 2 h)?
3. Power-restore default: re-apply curve, or turn lights off if it's night?
4. Should the toilet have a night-light behaviour (very dim warm light between e.g. 23:00–05:00 regardless of curve)?
5. Editor as a sidebar panel only, or also a dashboard card for quick profile switching?
6. Private repo installed as a HACS custom repository, or public HACS release?

---

## Appendix A — Decisions taken (30 September 2026)

Recorded here so the sections above can be updated as Phase 0 results land.

- **Groups come from HA areas.** A group is an HA area by default, with members
  derived live so a new bulb in that area joins automatically, plus an optional
  explicit member list for groups that are not rooms ("outdoor", "downstairs").
  This replaces the hand-maintained `members` array in §6 as the primary path.
- **One profile per room, as specced.** Many rooms may point at the same
  `profile_id`; per-room brightness scaling and kelvin offsets are deliberately
  *not* in scope, though the data model should leave room for them.
- **All members are Tapo L630** (CT + RGB), so Phase 1 may assume uniform
  capabilities. Capability degradation for CT-only and dimmable-only fixtures is
  deferred, not designed away.
- **Phase 0 (hardware spike) comes first.** See `spike/README.md`. Its five
  measurements settle §8's tick and transition, §10.1's tolerances, and whether
  the no-flash premise in §9 holds on real hardware.

## Appendix B — Corrections pending Phase 0

Issues found in review that need fixing in the sections above.

- ~~**§10.1 is not sufficient on its own.**~~ **Measured: not an issue on this
  hardware.** Phase 0 saw zero foreign-context state writes and zero rounding, so
  the scenario below does not arise for the L630 through this integration. A short
  suppression window is retained as cheap insurance, not as a fix for a live bug.
  (C.4 briefly reinstated this concern via the brightness channel; C.4 is retracted
  and this strike-through stands.) The original concern, for the record: ignoring
  events that carry our context
  does not cover the TP-Link coordinator's post-command refresh, which arrives
  under a *fresh* context. Mid-transition that refresh reports a value far from
  the target and would flag the room as overridden, after which it silently stops
  adapting. Needs a per-member suppression window of `transition + grace` after
  each command, and acceptance of a match against the *previous* target as well
  as the current one. The spike measures how big that window must be.
- **HomeKit may send a remembered brightness alongside a bare "turn on."** If so,
  §9's `turn_on(brightness=…)` rule fires a brightness override on every voice
  turn-on and Phase 1's acceptance criterion cannot pass. Needs a rule treating a
  brightness that arrives on an off→on transition and equals the wrapper's
  last-reported brightness as a HomeKit restore, not an override. `spike/watch.py`
  settles whether this happens.
- **Do not listen to the wrapper's own `state_changed`** (§10.1). It changes only
  because Lightcurve changed it; the override signal comes from the kwargs to
  `async_turn_on`. Listening invites a feedback loop.
- **§7 contradicts itself:** `engine.py` is specified as having no HA imports, but
  §7.2 calls `homeassistant.util.color.color_temperature_to_rgb`. Inject the
  conversion or vendor it.
- **`sensor.<room>_curve_target` mixes types** (§10): an integer kelvin or the
  string `rgb`. Keep the state numeric and put the mode in an attribute.
- **Preview contradicts the rate limit:** §13.3 throttles the scrubber to 1
  update/s while §6 sets `min_command_interval_seconds: 10`. Preview must bypass
  the limiter.
- **Entity count:** five entities per room × N rooms is a lot of registry noise.
  Consider a global sleep-mode switch with per-group opt-in.
- **Consider `select.<group>_profile`** as an entity. It answers open question 5
  for free — any dashboard, automation or voice assistant can then switch profiles
  with no custom card.

## Appendix C — Phase 0 measurements (30 September 2026)

Measured on two `light.toilet_*` L630s via the TP-Link integration. Raw report in
`spike/results/`.

| Measurement | Result | Consequence |
|---|---|---|
| `supported_features` | 36 = TRANSITION + EFFECT | Transition is *advertised* |
| Transition honoured? | **No.** HA sees no ramp; observed as a snap | §8's smooth-transition design is out |
| Kelvin reporting | **Exact.** 0 K error across 2200–6500 K, 11 points | §10.1 tolerances can be tight, not ±100 K |
| Brightness reporting | **Exact.** 0 % error across 1–100 %, 10 points | Same |
| Foreign-context state writes | **Zero** | The false-override risk in Appendix B does not materialise here |
| Command latency | 638 ms median, 739 ms p95, 1301 ms max | `min_command_interval_seconds: 10` is over-cautious |
| Two bulbs concurrently | 668 ms median wall — same as one | `asyncio.gather` scales; no serialisation penalty |
| Command failures | 0 of 16 | No retry pressure at this scale |
| CT↔RGB switch | Reported brightness unchanged at 80 %; **visible jump observed** | §21's risk confirmed; HA cannot see it, so it cannot be auto-compensated |
| One-call turn-on | No stale-colour state write, but **a flash was observed** | Open — see below |

### C.1 Revised scheduler design (replaces §8's transition strategy)

Transitions are not available, so smoothness has to come from steps small enough
not to be seen. The steepest segment of the default profile moves about 400 K/h and
6.4 %/h, which at a 60 s tick is a 6.7 K and 0.1 % step — below perception.

The threshold logic in §8 step 3 now works *against* this: a 50 K threshold holds
the light still for ~7.5 minutes and then jumps 50 K at once, which is visible in a
dim room. With transitions it damped command volume harmlessly; without them it
manufactures the very steps it was meant to avoid.

- `tick_seconds`: 60 (unchanged)
- `kelvin_threshold`: 50 → **10**
- `brightness_threshold_pct`: 2 → **1**
- `min_command_interval_seconds`: 10 → **5**
- `default_transition_seconds`: drop from member commands; the bulb ignores it

Cost at these settings: one command per on-bulb per minute, ~650 ms each, run
concurrently. Trivial for this house.

### C.2 Override detection is simpler than specced

Exact state reporting plus no transition removes most of the difficulty:

- Tolerances can be ±25 K and ±2 % (headroom over a measured zero), not ±100 K/±3 %.
- **The hue check needs care.** In `color_temp` mode the integration still reports a
  synthesised `hs_color` — 3000 K came back as `hs=[27.8, 56.9]`. Override detection
  must branch on `color_mode` and compare only the channel in use, or every
  CT-mode light looks like it is carrying a colour.
- A short suppression window after each command is still worth having as insurance
  against a slow refresh, but it does not need to span a transition.

### C.3 Cold turn-on: the bulb restores its last state, then applies the command

Re-measured with the interfering integration disabled (C.5). The earlier reading of
this was wrong; what follows is the corrected picture.

`warmup`, unaided cold turn-on at 2200 K/10 % with **no** corrective write:

| Dwell at the pre-off state | Reported after cold on | Landed |
|---|---|---|
| 0 s | 10 % | yes |
| 15 s | 10 % | yes |
| 60 s | 10 % | yes |

Observed after the 60 s dwell: **dim** — correct on arrival.

So the mechanism is simple and benign:

1. On a software turn-on the bulb restores its last on-state, as "last state"
   power-on behaviour promises.
2. It then applies everything in the `turn_on` command — colour **and** brightness —
   correctly, in one command, within about one round trip.

The flash observed in the earlier probes was step 1 showing for ~600 ms before step 2
landed. It tracks the delta, exactly as measured: where the restored state already
equalled the target there was nothing to see, and where it differed there was a brief
flash. That holds up, and now has a mechanism rather than a mystery behind it.

**Consequences for the design**

- **FR-9 stands.** One command per bulb genuinely does apply colour and brightness.
  No corrective second write is needed.
- **§1's no-flash claim stands, with a bounded caveat.** A cold turn-on briefly shows
  whatever the bulb was last left at. The duration is one command round trip
  (~600 ms measured), and the *magnitude* is the difference between the stored state
  and the new target.
- **The mitigation falls out for free.** Lightcurve rewrites the curve target every
  tick while a room is on, so the state a bulb is left at when switched off is the
  curve value at that moment. The residual flash is the curve's movement across the
  off period: negligible within an evening, largest for a light off all day.
- Worst case is the red night section (D.1): switched off during the day at a bright
  daytime white, turned on at 22:00 expecting dim red. That is ~600 ms of bright white
  and nothing can remove it from the HA side. Worth confirming by eye once the
  scheduler exists; if it grates, the fallback is a dim warm power-on preset, at the
  cost of losing last-state restore.

### C.4 Retracted: "the bulb ignores brightness on a cold turn-on"

Recorded so it is not rediscovered. This section previously claimed the L630 dropped
the brightness argument on a cold turn-on, based on a constant 71 % being reported
and the bulb visibly dimming when the same value was re-sent. Both observations were
real; the conclusion was wrong.

The bulb accepted 10 % exactly as asked. Another integration then wrote 71 % over it,
which is why re-sending produced a visible dim: it was undoing the override, not
completing an ignored command. C.5 has the cause. Two intermediate hypotheses — a
custom power-on preset, and lazy flash persistence of the last state — were both
wrong and are noted only to keep them from being retried. C.4's claim that it
"corrects C.2" is likewise withdrawn: **C.2 stands unamended.**

Method lesson worth keeping: every probe up to that point assumed it was the only
thing writing to the bulbs, and nothing verified it. `probe.py interference` exists
now, and it should be run first, before any probe whose result would be interpreted
as hardware behaviour.

### C.5 Confirmed: another integration was overwriting the probes

Adaptive Lighting — or whatever else was managing these bulbs — was writing to them
throughout. The fingerprints were there in the data before the cause was known:

- The bulb drifted to `hs` mode at `[27, 15]`, unprompted, at the **+90 s**
  checkpoint and about 4 s after a command in one `coldon` scenario. Ninety seconds
  is the Adaptive Lighting integration's default interval.
- A constant 71 % applied straight after every turn-on regardless of what was
  requested is exactly what `adapt_brightness` does.

With it disabled, an unaided cold turn-on lands on target at every dwell, including
0 s. That is conclusive.

**This is a hard prerequisite, not a testing artifact.** No other adaptive integration
may manage Lightcurve's member lights in normal operation either. If one does, its
writes are foreign changes by §10.1's definition, so every one of them raises an
override and the room stops following the curve within ~90 seconds of being turned on.

**Recommendation for the config flow (§16):** when members are chosen, look for
`adaptive_lighting` entities whose configured lights overlap the selection, and warn
before saving. It is a few lines, it catches the failure at setup rather than as
mysterious drift weeks later, and this spike is the evidence that it is worth having.

`probe.py interference` performs the same check on demand, and additionally sits idle
for three minutes so that any service call or state change on the member lights must
have come from elsewhere. It reports the gaps between foreign calls, since ~90 s
spacing is a fingerprint.

**What the interference invalidated, and what it did not**

| Finding | Status |
|---|---|
| C.1 capabilities, transition not honoured | Stands — measured warm, zero foreign-context writes in that window |
| C.1 exact kelvin and brightness reporting | Stands — interference would have produced mismatches, not exact matches |
| C.1 latency, concurrency, zero failures | Stands |
| D.1 hue fidelity, dim red to 1 %, slight mode-switch jump | Stands — measured with the bulb already on |
| C.3 cold turn-on behaviour | **Re-measured**, see above |
| C.4 brightness ignored on cold turn-on | **Retracted** |

## Appendix D — Colour sections and the editor (30 September 2026)

### D.1 Requirement

Red light between 20:00 and 04:00 when a light is turned on; sunrise/sunset and
daytime colours the rest of the time.

This is already expressible in the §6 data model — RGB keyframes are FR-3 — but it
moves work forward. §7.2's Oklab interpolation and per-segment mode selection were
implicitly Phase 3; a red night section needs them in **Phase 1**.

Three consequences, in order of how much they matter:

1. ~~**Dim saturated red is the risk.**~~ **Measured: not a problem.** `colours`
   walked 30 % → 20 % → 10 % → 5 % → 2 % → 1 % at `hs=[0, 100]`, and all six were
   judged a clean, properly red, visible light. Reported hue and saturation came back
   exact at every level. Hue fidelity across 0°, 15°, 30°, 345°, and at 80 % and 60 %
   saturation, was likewise exact — 0° error everywhere, including the wraparound at
   345°. A dim red night section is safe on this hardware.
2. **Red to warm white is a short hue path.** 2200 K as RGB sits near hue 27°, and
   red is hue 0°, so a red→dawn ramp travels ~27° of hue and should read as a
   natural sunset. Interpolating in Oklab as §7.2 specifies is right for this.
3. **Two unavoidable CT↔RGB switches per day**, at the boundaries of the red
   section. Measured at 20 % — the brightness a boundary keyframe would actually use
   — the jump was judged **slight**, against "visible" at the 80 % the `modes` probe
   used.

   **A keyframe on each side of the colour section is structural, not cosmetic.**
   Under §7.2 a segment renders as hs if *either* endpoint is a colour, so a curve
   that runs straight from a morning white keyframe to the 20:00 red keyframe is hs
   for that entire twelve-hour span: the whole day would be driven through the RGB
   LEDs with the dedicated white channel unused — dimmer and less pure, for no
   benefit. Adding shoulder keyframes shortly before 20:00 and shortly after 04:00
   confines hs mode to a few minutes either side of the night, keeps the day in
   colour-temperature mode, and as a side effect puts the mode switch where
   brightness is lowest. The engine test suite pins this behaviour
   (`test_daytime_stays_in_kelvin_mode_when_boundary_keyframes_exist`). Keeping the whole curve in RGB mode to avoid switching is *not*
   recommended: the L630's white channel is only used in CT mode, so daytime whites
   rendered as RGB would be dimmer and less pure.

### D.2 Editor: three lanes, two of them mutually exclusive

The request is three graphs — brightness, warmth, colour — with time on x.

Brightness is independent and gets its own lane. Warmth and colour are **the same
channel**: a keyframe is either a kelvin value or a hue, never both, because the
bulb cannot be 3000 K and red simultaneously. Three freely-editable lanes would
imply a state the hardware cannot enter.

So: three lanes, with the mode made visible rather than hidden.

- **Brightness lane** — 0–100 %, always active.
- **Warmth lane** — kelvin, active only where the segment's mode is `kelvin`;
  greyed elsewhere.
- **Colour lane** — hue/saturation, active only where the mode is `rgb`; greyed
  elsewhere.

Dragging in a greyed region converts that span to that mode, which is how the
20:00–04:00 red section gets drawn: drag in the colour lane across the night and it
becomes an RGB section, with the two mode-switch boundaries marked so the jump from
D.1.3 is visible while editing rather than discovered on the wall.

### D.3 Editor: drawing vs keyframes

Freehand drag and a keyframe model pull in opposite directions — dragging produces
hundreds of points, FR-1 caps a profile at 48 keyframes. Reconciled by fitting
rather than by choosing:

- **Drag** paints values freely, then on release the editor fits keyframes to the
  drawn path (Douglas–Peucker or similar) and shows the resulting count. The user
  draws a shape; the model stays keyframes with easing.
- **Click** at a time sets or moves a single keyframe at that x — the precise case,
  unchanged from §13.3.
- **Smoothness** stays a property of interpolation between fitted keyframes, so a
  hand-drawn curve still ramps rather than steps.

The hand-walked red→warm-white ramp in `colours` was judged "steps but not harsh",
but that probe stepped 6° of hue at a time back to back. A real ramp across an hour
at a 60 s tick moves about 0.45°/min — roughly thirteen times finer than what was
observed — so the production curve should be smooth. Worth confirming once the
scheduler exists rather than assuming it.

One correction to the mental model: "smooth transitions (ramp up/down)" cannot come
from the `transition` parameter, because this bulb ignores it (C.1). Smoothness comes
from the 60 s tick applying steps small enough not to be seen — about 6.7 K and 0.1 %
on the steepest part of a daily curve. The effect is the same; the mechanism is not
the obvious one, and the thresholds in §8 have to stay small or they reintroduce the
steps.

## Appendix E — Phase 1 implementation notes (30 September 2026)

### E.1 A sun keyframe can silently split a colour section

Found while writing the tests, and not something §13.4's validation rules cover.

A sun-relative keyframe whose resolved time drifts inside a colour section becomes an
interior keyframe of it. The section is then no longer one segment between two
identical colours; it is two segments joining a colour to a white. The visible result
is "my red night light is not red", with nothing obviously wrong in the profile.

It surfaced as a failing test where the harness had San Diego coordinates and a
Johannesburg timezone, putting solar noon at 21:52 local — right inside the red
section. That particular cause is a misconfiguration, but the same thing happens at
high latitude, or with a large enough sun offset, on a correctly configured system.

**§13.4 needs an extra rule:** warn when a sun-relative keyframe can resolve inside a
colour section at any point in the year, not only when two keyframes collide. Pinned
by `test_a_sun_keyframe_landing_inside_a_colour_section_splits_it`, which is written
to fail loudly if validation is later added and the behaviour changes.

### E.2 `force` did not bypass the threshold

A plain bug, caught by a test asserting that `apply_now` always reaches the bulbs.
Both branches of the guard returned, so a forced apply was discarded whenever the
curve had not moved perceptibly — meaning `apply_now` and `resume` would silently do
nothing, which is exactly the kind of failure that reads as a dead service.

### E.3 One command per bulb, not one per group

FR-9 says "a single command per bulb", and that is what both code paths now do. The
explicit path originally sent one fan-out call addressing every member, which was
inconsistent and would have blocked per-bulb capability handling — a group can hold
bulbs with different colour support, and a fan-out call has to send them all the same
payload.

### E.4 The `sun` dependency was unnecessary

`homeassistant.helpers.sun.get_astral_event_date` works from `hass.config` and astral
directly. Declaring `sun` in the manifest pulled in that integration's polling
entities for no benefit.

### E.5 Testing against the real Home Assistant needs Python 3.14

The suite initially ran against HA **2025.4.4** while the target system runs
**2026.9.4**, which would have left it verifying logic rather than API currency. The
cause was not that newer versions are unavailable — it was the interpreter.

**HA 2026.9.4 declares `requires_python >=3.14.2`.** On Python 3.13, pip filters every
2026.x release out of the index and reports "No matching distribution found", which is
indistinguishable from the version not existing. `pip index versions homeassistant`
likewise showed 2025.4.4 as the newest. Querying PyPI's JSON API directly was what
made the real constraint visible.

Resolved by installing Python 3.14 and pinning
`pytest-homeassistant-custom-component==0.13.367`, which pins
`homeassistant==2026.9.4` — the exact production version. The development requirement
is therefore **Python >= 3.14**.

**Result: all 90 tests pass unchanged against 2026.9.4.** Nothing in the integration
needed adjusting, which retires the list of APIs this section previously said to
verify by hand — the config flow, the options flow, the `DeviceInfo` import path and
the `SelectSelector` schema are all exercised by the suite now. A predicted casualty,
`AddEntitiesCallback` being replaced by `AddConfigEntryEntitiesCallback`, did not
materialise.

A scan with deprecation warnings enabled found none originating from this
integration, and `filterwarnings` now promotes Home Assistant deprecation warnings to
errors. Testing against the exact production version is pointless while its warnings
are suppressed, and this is what keeps the next API change from passing silently.

Worth remembering as a general trap: a pip "no matching distribution" error for a
version you can see on PyPI usually means an interpreter constraint, not a missing
release.

**Toolchain, for reproducibility.** Python 3.14.7 is installed through pyenv and
pinned by `.python-version` in the repository root, so the interpreter is part of the
checkout rather than something to remember. Two snags worth recording: pyenv's own
build definitions had to be updated first (2.6.7 offered nothing above `3.14.0rc2`,
below HA's `>=3.14.2` floor), and verifying which interpreter a shell resolves needs
care — `zsh -l -c` inherits `PATH` from its parent and does not source `.zshrc` at
all, so it reports the calling environment rather than a fresh terminal. Checking
`~/.pyenv/shims/python` directly is the reliable test.
