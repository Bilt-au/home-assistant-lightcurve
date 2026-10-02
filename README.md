# Lightcurve

[![Validate](https://github.com/Bilt-au/home-assistant-lightcurve/actions/workflows/validate.yml/badge.svg)](https://github.com/Bilt-au/home-assistant-lightcurve/actions/workflows/validate.yml)
[![hacs](https://img.shields.io/badge/HACS-custom-41BDF5.svg)](https://hacs.xyz)

A Home Assistant integration that drives your lights along a 24-hour curve of colour
and brightness — and applies the right colour **in the same command that turns the
light on**, so you never see a flash of last night's setting.

It also supports genuine colours in the curve, not just white temperatures, so a
"dim red between 20:00 and 04:00" night section is a normal thing to ask for rather
than a workaround.

> **Status: Phase 1.** The integration works and is tested, but profiles are edited
> in code rather than in a graphical editor. The editor is Phase 2.

## Requirements

- Home Assistant 2026.9 or newer
- Bulbs already set up in Home Assistant and assigned to **areas**
- **No other adaptive lighting integration managing the same bulbs** — see below

## Installing

Add this repository to HACS as a custom repository:

1. HACS → three-dot menu → **Custom repositories**
2. URL: `https://github.com/Bilt-au/home-assistant-lightcurve`, category: **Integration**
3. Find **Lightcurve** in HACS and install it
4. Restart Home Assistant
5. **Settings → Devices & Services → Add Integration → Lightcurve**

Setup asks which areas to drive. Each area becomes a group with its own wrapper
light. Membership is taken from the area, so a bulb you add to that room later joins
on its own with no reconfiguration.

### Adding rooms later

Lightcurve is a single config entry holding as many groups as you like, so adding a
room is an edit rather than a second install — there is deliberately only one entry.

**Settings → Devices & Services → Lightcurve → Configure → Rooms**, then tick the
areas you want. Unticking one removes that group and its entities; the bulbs
themselves are untouched. Groups built from a hand-picked list of lights rather than
an area are not shown there and are left alone.

## What you get, per group

| Entity | What it does |
|---|---|
| `light.<group>` | The light you actually control. Expose **this** to HomeKit, not the bulbs |
| `switch.<group>_curve_enabled` | Turn the curve off without losing the configuration; the light then behaves like a plain group |
| `select.<group>_profile` | Which profile drives the group — usable from a dashboard, an automation or a voice assistant |
| `sensor.<group>_curve_target` | The target colour temperature right now, with the full target in attributes |
| `binary_sensor.<group>_curve_overridden` | On while the group has stopped following the curve |

### How it behaves

- **Turn it on** → comes up at the curve's colour and brightness, in one command.
- **Set it to 40 %** → holds that brightness, but colour keeps following the curve.
- **Make it blue** → holds that colour, but brightness keeps following the curve.
- **Turn it off and on again** → back on the curve.

Those per-channel overrides are what make voice control pleasant: dimming the lights
does not also freeze their colour for the rest of the evening.

## The editor

**Settings → sidebar → Lightcurve** opens a three-lane graph of the selected profile.

The graph has two parts.

**Brightness** is a lane you draw on: drag across it and every moment your cursor
passes takes its height.

**Colour** is a ribbon showing the colour the lights will actually be, all day. Tap it
at any time to set the colour there — one picker offering both whites, as a colour
temperature, and colours, on a hue and saturation wheel. Tapping bare ribbon creates a
keyframe carrying the colour already showing there, so you never have to think about
keyframes to change a colour. Drag a marker to move it in time, or onto a sun line to
make it follow sunrise or sunset.

An earlier version split this into three lanes — brightness, warmth and colour — with
warmth and colour greyed out according to which mode the curve was in, because a
keyframe holds a colour temperature *or* a hue and never both. That was accurate about
the data and wrong about the question people ask, which is just "what colour is the
light at seven?" Whether the answer is a white or an orange is an implementation
detail, and surfacing it meant a colour could not be set without first understanding
the model.

Every keyframe is also listed as an editable row below: time, what it resolves to
today, colour, brightness and easing. Dragging is good for shape and hopeless for
"make this exactly 06:30".

Validation runs as you edit and samples the whole year, because the failures that
matter here are seasonal: a profile that is fine in September can have two keyframes
collide in June, or a sun keyframe drift inside the red night section and stop the
colour holding. Errors block saving; warnings do not, since a warning about June
should not stop you saving in September.

## Looks, and Siri

Three scenes ship by default — **Mood**, **Movie** and **Disco** — each named exactly
that, so `Hey Siri, Movie` works once Home Assistant's HomeKit Bridge exposes them.
They deliberately have no device, because Home Assistant prepends a device name to
the friendly name and "Lightcurve looks Movie" is not something anyone says.

A look sets its values **and holds both channels**, so the curve does not put itself
back a minute later. Switching the room off and on releases it — a look needs no
explicit exit. Optionally it can release itself after a set number of minutes.

**Disco runs on the bulb.** The L630 offers native `Party` and `Relax` effects, and a
native effect animates at the firmware's own rate with no command traffic from Home
Assistant. That matters: at ~640 ms per command, a loop driven from Home Assistant
manages roughly one colour change a second, which is a slow fade rather than a disco.
Effect names differ between bulbs, so a look whose effect none of the members offer
reports doing nothing rather than sending a command they will reject.

## Services

| Service | What it does |
|---|---|
| `lightcurve.apply_now` | Recompute and push the curve immediately |
| `lightcurve.resume` | Clear overrides and return to the curve |
| `lightcurve.pause` | Hold one or both channels so manual values stick |
| `lightcurve.set_profile` | Point groups at a different profile |

All of them accept a group, a wrapper light, or an area. With no target at all,
`apply_now` and `resume` apply to every group.

## Updating

Once installed, updates arrive the same way Home Assistant's own do: HACS watches
this repository's **GitHub Releases** and creates an update entity, so Lightcurve
appears under **Settings → Updates** with a one-click update and restart.

Nothing appears there until a release exists — HACS treats a repository without
releases as "install from the default branch" and never reports a new version.

### Cutting one

```bash
python scripts/release.py 0.2.0
git push origin main --follow-tags
```

That bumps the manifest, commits, and tags. Pushing the tag triggers CI, which
refuses the release if the tag and the manifest version disagree, or if the committed
panel bundle is stale relative to its source. Home Assistant reports the manifest
version and HACS reports the tag, so a mismatch would show two different numbers for
the same install.

## Important: only one integration may adapt a bulb

If Adaptive Lighting — or anything similar — is managing the same bulbs, the two will
fight. Lightcurve treats any change it did not make as a manual override, so every
Adaptive Lighting update stops the curve within about 90 seconds of a light coming
on. The symptom is "it worked for a minute and then stopped".

Setup checks for this and warns you, but it cannot fix it. Disable the other
integration for those lights.

## The default profile

A warm, dim night; a moderate day; red at night.

| Time | Colour | Brightness |
|---|---|---|
| 04:00 | red | 3 % |
| 04:15 | 2200 K | 5 % |
| 08:00 | 2700 K | 40 % |
| solar noon | 4000 K | 70 % |
| 19:45 | 2200 K | 5 % |
| 20:00 | red | 3 % |

The keyframes at 19:45 and 04:15 are doing real work. A segment renders as a colour
if *either* end is a colour, so without them the stretch from morning to 20:00 would
be driven through the RGB LEDs all day, leaving the dedicated white LED unused —
dimmer and less pure for no benefit. The shoulders keep hs mode to fifteen minutes
either side of the night, and put the mode switch where brightness is lowest and it
is least noticeable.

## Notes on Tapo L630 bulbs

Measured, not assumed. Full detail in `docs/spec.md` Appendix C.

- **Transitions do not work.** The bulb advertises the feature and ignores it. So
  Lightcurve does not send one, and gets smoothness from small frequent steps
  instead — about 7 K and 0.1 % per minute on the steepest part of a daily curve.
  This is why the thresholds are deliberately tiny; raising them makes the light hold
  still and then visibly jump.
- **Reported state is exact.** No rounding at all across the full range, which is why
  override detection can use tight tolerances.
- **Dim saturated red works** down to 1 %, so a dim red night section is viable.
- **A cold turn-on briefly shows the bulb's previous state** for about one command
  round trip (~600 ms) before the new values land. Lightcurve keeps each bulb at the
  curve target while it is on, so what a light comes back to is whatever the curve
  last set — the difference is small unless the light has been off for many hours.

## Development

Requires **Python 3.14 or newer** — Home Assistant 2026.9 declares
`requires_python >=3.14.2`, and on an older interpreter pip hides every 2026.x release
and reports it as missing rather than incompatible.

The repository pins its interpreter in `.python-version`, so with pyenv installed
`python` resolves correctly on its own:

```bash
pyenv install 3.14.7      # needs pyenv >= 2.7; older build definitions stop at 3.14.0rc2
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt   # pins the exact HA the integration targets
pytest
ruff check custom_components/ tests/
```

`custom_components/lightcurve/engine.py` is pure Python with no Home Assistant
imports, so the curve maths can be tested on its own — that is where most of the test
suite lives.

The editor lives in `frontend/` and builds to a single file committed under
`custom_components/lightcurve/frontend/`, so installing from HACS needs no build step.
CI fails if that bundle is out of date with its source.

```bash
cd frontend
npm install
npm test          # geometry and curve-fitting
npm run build     # writes the committed bundle
```

`spike/` holds the throwaway tooling used to measure the bulbs before any of this was
written. `spike/README.md` explains what each probe decides. If you are porting this
to different hardware, start there — and run `probe.py interference` first.

## Why another circadian lighting integration

[Adaptive Lighting](https://github.com/basnijholt/adaptive-lighting) is excellent and
solves most of this problem. Lightcurve exists for four things it does not do:

- **The colour arrives with the "on".** Adaptive Lighting corrects a light shortly
  after it comes on, so you see the old colour first. Lightcurve creates a wrapper
  light and puts the curve's colour and brightness in the same command that turns the
  bulb on, so there is nothing to correct.
- **Real colours, not just white temperatures.** A dim red section from 20:00 to 04:00
  is an ordinary keyframe, not a workaround.
- **A curve you draw, not min/max parameters.** Keyframes with easing, rather than
  tuning endpoints and inferring the middle. (The graphical editor is Phase 2; for now
  profiles are defined in code.)
- **Deliberate power-restore behaviour**, because mains interruptions are a fact of
  life where this was written and bulbs come back at whatever state they please.

If none of those matter to you, use Adaptive Lighting — and do not run both on the
same bulbs.

## Licence

MIT. See [LICENSE](LICENSE).
