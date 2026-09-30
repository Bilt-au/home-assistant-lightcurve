"""Constants, defaults and the built-in profile.

Every numeric default here traces back to a Phase 0 measurement; see Appendix C of
docs/spec.md. Where a value differs from the original spec, the reason is noted,
because several of them look wrong without it.
"""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "lightcurve"
PLATFORMS: Final = [
    "light",
    "switch",
    "sensor",
    "select",
    "binary_sensor",
    "scene",
]

STORAGE_KEY: Final = DOMAIN
STORAGE_VERSION: Final = 1

# --- scheduler -----------------------------------------------------------------
#
# The L630 advertises LightEntityFeature.TRANSITION but does not honour it, so
# smoothness comes from small frequent steps rather than from the bulb ramping.
# On the steepest part of a daily curve that is roughly 6.7 K and 0.1 % per tick,
# which is below perception.
DEFAULT_TICK_SECONDS: Final = 60

# Deliberately 0: a transition the bulb ignores only obscures later debugging.
# Retained as a setting for hardware that does honour it.
DEFAULT_TRANSITION_SECONDS: Final = 0

# Lowered from the spec's 50 K / 2 %. With no transition support a large threshold
# holds the light still and then jumps the whole accumulated delta at once, which is
# visible in a dim room. It was a command-volume damper; without transitions it
# manufactures the steps it was meant to prevent.
DEFAULT_KELVIN_THRESHOLD: Final = 10
DEFAULT_BRIGHTNESS_THRESHOLD_PCT: Final = 1

# Measured latency was 638 ms median, 1301 ms worst, with no failures, and two bulbs
# concurrently cost the same as one. The spec's 10 s was guesswork.
DEFAULT_MIN_COMMAND_INTERVAL_SECONDS: Final = 5

# --- override detection --------------------------------------------------------
#
# Reported state proved exact: zero error across 11 kelvin points and 10 brightness
# points. These are headroom over a measured zero, not an allowance for rounding.
DEFAULT_KELVIN_TOLERANCE: Final = 25
DEFAULT_BRIGHTNESS_TOLERANCE_PCT: Final = 2
DEFAULT_HUE_TOLERANCE: Final = 5

# Ignore member state for this long after commanding it. Not needed for any observed
# failure — kept as cheap insurance against a slow coordinator refresh landing
# mid-command and reading as a foreign change.
DEFAULT_COMMAND_SUPPRESSION_SECONDS: Final = 2

# Bulbs come back in waves after a grid restore; debounce before acting.
DEFAULT_POWER_RESTORE_DEBOUNCE_SECONDS: Final = 10

SETTINGS_DEFAULTS: Final[dict[str, object]] = {
    "tick_seconds": DEFAULT_TICK_SECONDS,
    "default_transition_seconds": DEFAULT_TRANSITION_SECONDS,
    "kelvin_threshold": DEFAULT_KELVIN_THRESHOLD,
    "brightness_threshold_pct": DEFAULT_BRIGHTNESS_THRESHOLD_PCT,
    "min_command_interval_seconds": DEFAULT_MIN_COMMAND_INTERVAL_SECONDS,
    "kelvin_tolerance": DEFAULT_KELVIN_TOLERANCE,
    "brightness_tolerance_pct": DEFAULT_BRIGHTNESS_TOLERANCE_PCT,
    "hue_tolerance": DEFAULT_HUE_TOLERANCE,
    "command_suppression_seconds": DEFAULT_COMMAND_SUPPRESSION_SECONDS,
    "power_restore_debounce_seconds": DEFAULT_POWER_RESTORE_DEBOUNCE_SECONDS,
}

# --- power restore -------------------------------------------------------------
POWER_RESTORE_APPLY_CURVE: Final = "apply_curve"
POWER_RESTORE_TURN_OFF: Final = "turn_off"
POWER_RESTORE_RESTORE_PREVIOUS: Final = "restore_previous"
POWER_RESTORE_MODES: Final = [
    POWER_RESTORE_APPLY_CURVE,
    POWER_RESTORE_TURN_OFF,
    POWER_RESTORE_RESTORE_PREVIOUS,
]

# --- override channels ---------------------------------------------------------
CHANNEL_COLOUR: Final = "colour"
CHANNEL_BRIGHTNESS: Final = "brightness"
CHANNELS: Final = [CHANNEL_COLOUR, CHANNEL_BRIGHTNESS]

# --- services ------------------------------------------------------------------
SERVICE_APPLY_NOW: Final = "apply_now"
SERVICE_PAUSE: Final = "pause"
SERVICE_RESUME: Final = "resume"
SERVICE_SET_PROFILE: Final = "set_profile"

ATTR_TARGET_KELVIN: Final = "target_kelvin"
ATTR_TARGET_HS: Final = "target_hs"
ATTR_TARGET_BRIGHTNESS_PCT: Final = "target_brightness_pct"
ATTR_PROFILE: Final = "profile"
ATTR_OVERRIDE_COLOUR: Final = "override_colour"
ATTR_OVERRIDE_BRIGHTNESS: Final = "override_brightness"
ATTR_NEXT_KEYFRAME_AT: Final = "next_keyframe_at"
ATTR_SEGMENT: Final = "segment"
ATTR_MEMBERS: Final = "members"
ATTR_UNAVAILABLE_MEMBERS: Final = "unavailable_members"

DEFAULT_PROFILE_ID: Final = "p_default"
DEFAULT_PROFILE_NAME: Final = "Everyday"

# The shoulder keyframes at 19:45 and 04:15 are load-bearing. A segment renders as
# hs if either endpoint is a colour, so without them the run from `morning` to
# `red_on` would put the whole day in RGB mode and leave the L630's dedicated white
# LED unused. With them, hs is confined to the 15 minutes either side of the night.
DEFAULT_PROFILE: Final[dict[str, object]] = {
    "id": DEFAULT_PROFILE_ID,
    "name": DEFAULT_PROFILE_NAME,
    "variants": {
        "default": {
            "keyframes": [
                {
                    "id": "k_predawn",
                    "time": {"type": "fixed", "value": "04:15"},
                    "colour": {"mode": "kelvin", "kelvin": 2200},
                    "brightness": 5,
                    "easing": "ease_in_out",
                },
                {
                    "id": "k_morning",
                    "time": {"type": "fixed", "value": "08:00"},
                    "colour": {"mode": "kelvin", "kelvin": 2700},
                    "brightness": 40,
                    "easing": "ease_in_out",
                },
                {
                    "id": "k_noon",
                    "time": {"type": "sun", "event": "solar_noon", "offset_min": 0},
                    "colour": {"mode": "kelvin", "kelvin": 4000},
                    "brightness": 70,
                    "easing": "ease_in_out",
                },
                {
                    "id": "k_evening",
                    "time": {"type": "fixed", "value": "19:45"},
                    "colour": {"mode": "kelvin", "kelvin": 2200},
                    "brightness": 5,
                    "easing": "ease_in_out",
                },
                {
                    "id": "k_red_on",
                    "time": {"type": "fixed", "value": "20:00"},
                    "colour": {"mode": "hs", "hs": [0, 100]},
                    "brightness": 3,
                    "easing": "linear",
                },
                {
                    "id": "k_red_off",
                    "time": {"type": "fixed", "value": "04:00"},
                    "colour": {"mode": "hs", "hs": [0, 100]},
                    "brightness": 3,
                    "easing": "linear",
                },
            ]
        }
    },
}


# --- looks ---------------------------------------------------------------------
#
# A "look" is a named set of values held against the curve: Mood, Movie, Disco.
# Applying one sets both channel overrides, which is what makes it stick — without
# that the scheduler would put the curve back within a tick. Turning the room off
# and on clears the overrides and returns it to the curve, so a look never needs an
# explicit exit.
LOOK_MODE_STATIC: Final = "static"
LOOK_MODE_EFFECT: Final = "effect"

#: Effects run on the bulb itself. The L630 offers Off, Party and Relax, and a
#: native effect animates at the firmware's own rate with no command traffic from
#: us — which is the only way anything resembling disco works over Wi-Fi at ~640 ms
#: per command.
DEFAULT_LOOKS: Final[dict[str, dict[str, object]]] = {
    "l_mood": {
        "id": "l_mood",
        "name": "Mood",
        "mode": LOOK_MODE_STATIC,
        "colour": {"mode": "kelvin", "kelvin": 2200},
        "brightness": 25,
        "groups": [],
        "hold_minutes": None,
    },
    "l_movie": {
        "id": "l_movie",
        "name": "Movie",
        "mode": LOOK_MODE_STATIC,
        "colour": {"mode": "kelvin", "kelvin": 2200},
        "brightness": 5,
        "groups": [],
        "hold_minutes": None,
    },
    "l_disco": {
        "id": "l_disco",
        "name": "Disco",
        "mode": LOOK_MODE_EFFECT,
        "effect": "Party",
        "colour": None,
        "brightness": None,
        "groups": [],
        "hold_minutes": None,
    },
}
