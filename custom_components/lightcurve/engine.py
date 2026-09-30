"""Pure curve maths for Lightcurve.

No Home Assistant imports, deliberately: this module runs under plain pytest and
knows nothing about entities, services or the event loop. Anything the curve needs
from the outside — sun times above all — is passed in.

Two stages, kept separate because they fail in different ways:

  resolve()   turns stored keyframes into concrete local datetimes for given days,
              which is where sun events and seasonal reordering come in
  evaluate()  interpolates between two resolved keyframes, which is pure arithmetic

Colour interpolation follows the spec: kelvin pairs interpolate in mireds because
that is perceptually more even than kelvin, and anything involving an RGB endpoint
goes through Oklab so a red-to-warm-white ramp travels the short way round the hue
circle without passing through grey.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, tzinfo
from itertools import pairwise
from typing import Literal

Easing = Literal["linear", "ease_in_out", "step"]
ColourMode = Literal["kelvin", "hs"]
SunEvent = Literal["dawn", "sunrise", "solar_noon", "sunset", "dusk"]

#: Resolves a sun event for a given local date, or None when it does not occur
#: (polar latitudes). Supplied by the caller so this module stays HA-free.
SunLookup = Callable[[date, str], "datetime | None"]

MIN_KELVIN = 1000
MAX_KELVIN = 20000
MIN_BRIGHTNESS_PCT = 1
MAX_BRIGHTNESS_PCT = 100


class CurveError(ValueError):
    """The curve cannot be resolved or evaluated as given."""


# --------------------------------------------------------------------------- types


@dataclass(frozen=True)
class Colour:
    """A keyframe colour: either a colour temperature or a hue/saturation pair."""

    mode: ColourMode
    kelvin: int | None = None
    hs: tuple[float, float] | None = None

    def __post_init__(self) -> None:
        if self.mode == "kelvin":
            if self.kelvin is None:
                raise CurveError("kelvin colour needs a kelvin value")
            if not MIN_KELVIN <= self.kelvin <= MAX_KELVIN:
                raise CurveError(
                    f"kelvin {self.kelvin} outside {MIN_KELVIN}-{MAX_KELVIN}"
                )
        elif self.mode == "hs":
            if self.hs is None:
                raise CurveError("hs colour needs a hue/saturation pair")
            hue, saturation = self.hs
            if not 0 <= hue <= 360 or not 0 <= saturation <= 100:
                raise CurveError(f"hs {self.hs} outside 0-360 / 0-100")
        else:
            raise CurveError(f"unknown colour mode {self.mode!r}")

    @classmethod
    def from_kelvin(cls, kelvin: int) -> Colour:
        return cls(mode="kelvin", kelvin=kelvin)

    @classmethod
    def from_hs(cls, hue: float, saturation: float) -> Colour:
        return cls(mode="hs", hs=(hue, saturation))


@dataclass(frozen=True)
class KeyframeTime:
    """When a keyframe sits: a wall-clock time, or an offset from a sun event."""

    type: Literal["fixed", "sun"]
    value: str | None = None  # "HH:MM" for fixed
    event: str | None = None  # sun event name
    offset_min: int = 0

    def __post_init__(self) -> None:
        if self.type == "fixed":
            if not self.value:
                raise CurveError("fixed keyframe time needs a HH:MM value")
            parse_hhmm(self.value)
        elif self.type == "sun":
            if not self.event:
                raise CurveError("sun keyframe time needs an event")
        else:
            raise CurveError(f"unknown keyframe time type {self.type!r}")


@dataclass(frozen=True)
class Keyframe:
    """A keyframe as stored: time is unresolved, so this is date-independent."""

    id: str
    time: KeyframeTime
    colour: Colour
    brightness_pct: int
    easing: Easing = "linear"

    def __post_init__(self) -> None:
        if not MIN_BRIGHTNESS_PCT <= self.brightness_pct <= MAX_BRIGHTNESS_PCT:
            raise CurveError(
                f"brightness {self.brightness_pct} outside"
                f" {MIN_BRIGHTNESS_PCT}-{MAX_BRIGHTNESS_PCT}"
            )
        if self.easing not in ("linear", "ease_in_out", "step"):
            raise CurveError(f"unknown easing {self.easing!r}")


@dataclass(frozen=True)
class ResolvedKeyframe:
    """A keyframe pinned to a concrete local datetime."""

    id: str
    at: datetime
    colour: Colour
    brightness_pct: int
    easing: Easing


@dataclass(frozen=True)
class Target:
    """What the curve dictates at one instant."""

    mode: ColourMode
    kelvin: int | None
    hs: tuple[float, float] | None
    brightness_pct: int
    segment: tuple[str, str]
    evaluated_at: datetime

    def describe(self) -> str:
        colour = f"{self.kelvin}K" if self.mode == "kelvin" else f"hs{self.hs}"
        return f"{colour} @ {self.brightness_pct}%"


# ----------------------------------------------------------------------- utilities


def parse_hhmm(value: str) -> time:
    """Parse "HH:MM", raising CurveError rather than ValueError."""
    try:
        hours, _, minutes = value.partition(":")
        return time(int(hours), int(minutes))
    except (ValueError, TypeError) as err:
        raise CurveError(f"bad HH:MM value {value!r}") from err


def ease(easing: Easing, t: float) -> float:
    """Map linear progress to eased progress, clamped to 0..1."""
    t = min(1.0, max(0.0, t))
    if easing == "linear":
        return t
    if easing == "ease_in_out":
        return t * t * (3.0 - 2.0 * t)  # smoothstep
    if easing == "step":
        return 0.0  # hold the start value until the next keyframe
    raise CurveError(f"unknown easing {easing!r}")


def kelvin_to_mired(kelvin: float) -> float:
    if kelvin <= 0:
        raise CurveError(f"kelvin must be positive, got {kelvin}")
    return 1_000_000.0 / kelvin


def mired_to_kelvin(mired: float) -> float:
    if mired <= 0:
        raise CurveError(f"mired must be positive, got {mired}")
    return 1_000_000.0 / mired


def _cbrt(x: float) -> float:
    """Real cube root, including for negatives, which ** (1/3) cannot do."""
    return math.copysign(abs(x) ** (1.0 / 3.0), x)


def kelvin_to_rgb(kelvin: float) -> tuple[float, float, float]:
    """Tanner Helland's blackbody approximation, as Home Assistant uses.

    Reimplemented rather than imported so this module stays HA-free. Returns
    channels in 0..255.
    """
    temp = min(max(kelvin, MIN_KELVIN), 40000) / 100.0
    if temp <= 66:
        red = 255.0
        green = 99.4708025861 * math.log(temp) - 161.1195681661
    else:
        red = 329.698727446 * ((temp - 60) ** -0.1332047592)
        green = 288.1221695283 * ((temp - 60) ** -0.0755148492)
    if temp >= 66:
        blue = 255.0
    elif temp <= 19:
        blue = 0.0
    else:
        blue = 138.5177312231 * math.log(temp - 10) - 305.0447927307
    return tuple(  # type: ignore[return-value]
        min(255.0, max(0.0, c)) for c in (red, green, blue)
    )


def _srgb_to_linear(channel: float) -> float:
    c = channel / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(channel: float) -> float:
    c = channel * 12.92 if channel <= 0.0031308 else 1.055 * channel ** (1 / 2.4) - 0.055
    return min(255.0, max(0.0, c * 255.0))


def rgb_to_oklab(rgb: tuple[float, float, float]) -> tuple[float, float, float]:
    """Oklab, per Björn Ottosson. Input channels 0..255."""
    r, g, b = (_srgb_to_linear(c) for c in rgb)
    long_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    medium = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    short = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = _cbrt(long_), _cbrt(medium), _cbrt(short)
    return (
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    )


def oklab_to_rgb(lab: tuple[float, float, float]) -> tuple[float, float, float]:
    """Inverse of rgb_to_oklab. Output channels 0..255."""
    lightness, a, b = lab
    l_ = lightness + 0.3963377774 * a + 0.2158037573 * b
    m_ = lightness - 0.1055613458 * a - 0.0638541728 * b
    s_ = lightness - 0.0894841775 * a - 1.2914855480 * b
    long_, medium, short = l_**3, m_**3, s_**3
    linear = (
        +4.0767416621 * long_ - 3.3077115913 * medium + 0.2309699292 * short,
        -1.2684380046 * long_ + 2.6097574011 * medium - 0.3413193965 * short,
        -0.0041960863 * long_ - 0.7034186147 * medium + 1.7076147010 * short,
    )
    return tuple(_linear_to_srgb(c) for c in linear)  # type: ignore[return-value]


def rgb_to_hs(rgb: tuple[float, float, float]) -> tuple[float, float]:
    """Hue in 0..360, saturation in 0..100. Value is dropped: brightness is its
    own channel, so colour carries no lightness of its own."""
    r, g, b = (c / 255.0 for c in rgb)
    high, low = max(r, g, b), min(r, g, b)
    span = high - low
    if span == 0:
        hue = 0.0
    elif high == r:
        hue = (60 * ((g - b) / span)) % 360
    elif high == g:
        hue = 60 * ((b - r) / span) + 120
    else:
        hue = 60 * ((r - g) / span) + 240
    saturation = 0.0 if high == 0 else (span / high) * 100
    return (round(hue % 360, 3), round(saturation, 3))


def hs_to_rgb(hue: float, saturation: float) -> tuple[float, float, float]:
    """Inverse of rgb_to_hs at full value."""
    h = (hue % 360) / 60.0
    s = saturation / 100.0
    chroma = s
    x = chroma * (1 - abs(h % 2 - 1))
    if h < 1:
        r, g, b = chroma, x, 0.0
    elif h < 2:
        r, g, b = x, chroma, 0.0
    elif h < 3:
        r, g, b = 0.0, chroma, x
    elif h < 4:
        r, g, b = 0.0, x, chroma
    elif h < 5:
        r, g, b = x, 0.0, chroma
    else:
        r, g, b = chroma, 0.0, x
    offset = 1 - chroma
    return ((r + offset) * 255, (g + offset) * 255, (b + offset) * 255)


def colour_to_rgb(colour: Colour) -> tuple[float, float, float]:
    if colour.mode == "kelvin":
        return kelvin_to_rgb(colour.kelvin)  # type: ignore[arg-type]
    hue, saturation = colour.hs  # type: ignore[misc]
    return hs_to_rgb(hue, saturation)


# ------------------------------------------------------------------- interpolation


def interpolate_colour(start: Colour, end: Colour, progress: float) -> Colour:
    """Blend two keyframe colours.

    Both kelvin stays in colour-temperature space, interpolated in mireds, so the
    bulb can be driven in its white channel — which matters on the L630, where CT
    mode uses a dedicated white LED and RGB mode does not. As soon as either end is
    an explicit colour the whole segment has to become hs, and Oklab is used so the
    path looks even.
    """
    progress = min(1.0, max(0.0, progress))
    if start.mode == "kelvin" and end.mode == "kelvin":
        start_mired = kelvin_to_mired(start.kelvin)  # type: ignore[arg-type]
        end_mired = kelvin_to_mired(end.kelvin)  # type: ignore[arg-type]
        mired = start_mired + (end_mired - start_mired) * progress
        return Colour.from_kelvin(round(mired_to_kelvin(mired)))

    start_lab = rgb_to_oklab(colour_to_rgb(start))
    end_lab = rgb_to_oklab(colour_to_rgb(end))
    blended = tuple(
        a + (b - a) * progress
        for a, b in zip(start_lab, end_lab, strict=True)
    )
    hue, saturation = rgb_to_hs(oklab_to_rgb(blended))  # type: ignore[arg-type]
    return Colour.from_hs(hue, saturation)


def interpolate_brightness(start_pct: int, end_pct: int, progress: float) -> int:
    progress = min(1.0, max(0.0, progress))
    value = start_pct + (end_pct - start_pct) * progress
    return min(MAX_BRIGHTNESS_PCT, max(MIN_BRIGHTNESS_PCT, round(value)))


# ---------------------------------------------------------------------- resolution


def resolve_day(
    keyframes: Sequence[Keyframe], day: date, sun: SunLookup, tz: tzinfo
) -> list[ResolvedKeyframe]:
    """Pin every keyframe to a datetime on `day`, sorted by time.

    Sun-relative keyframes can cross fixed ones as the year turns, so sorting after
    resolution is what decides segment order — the stored order is not authoritative.
    A sun event that does not occur on `day` drops the keyframe rather than failing
    the whole curve.
    """
    resolved: list[ResolvedKeyframe] = []
    for keyframe in keyframes:
        when = _resolve_time(keyframe.time, day, sun, tz)
        if when is None:
            continue
        resolved.append(
            ResolvedKeyframe(
                id=keyframe.id,
                at=when,
                colour=keyframe.colour,
                brightness_pct=keyframe.brightness_pct,
                easing=keyframe.easing,
            )
        )
    resolved.sort(key=lambda k: k.at)
    return resolved


def _resolve_time(
    spec: KeyframeTime, day: date, sun: SunLookup, tz: tzinfo
) -> datetime | None:
    if spec.type == "fixed":
        clock = parse_hhmm(spec.value)  # type: ignore[arg-type]
        return datetime.combine(day, clock, tzinfo=tz)
    event = sun(day, spec.event)  # type: ignore[arg-type]
    if event is None:
        return None
    return event + timedelta(minutes=spec.offset_min)


def resolve_window(
    keyframes: Sequence[Keyframe],
    day: date,
    sun: SunLookup,
    tz: tzinfo,
    days_either_side: int = 1,
) -> list[ResolvedKeyframe]:
    """Resolve across neighbouring days so the midnight wrap needs no special case.

    The segment running through midnight joins the last keyframe of one day to the
    first of the next, and with sun-relative keyframes those are different times on
    different days. Resolving a window and then simply bracketing `now` is both
    simpler and more correct than shifting a single day's keyframes by 24 hours.
    """
    resolved: list[ResolvedKeyframe] = []
    for offset in range(-days_either_side, days_either_side + 1):
        resolved.extend(
            resolve_day(keyframes, day + timedelta(days=offset), sun, tz)
        )
    resolved.sort(key=lambda k: k.at)
    return resolved


# ------------------------------------------------------------------------ evaluate


def evaluate(resolved: Sequence[ResolvedKeyframe], now: datetime) -> Target:
    """Interpolate the curve at `now`.

    `resolved` must bracket `now` — use resolve_window() to guarantee that.
    """
    if len(resolved) < 2:
        raise CurveError("a curve needs at least two resolved keyframes")
    if now < resolved[0].at or now >= resolved[-1].at:
        raise CurveError(
            f"{now.isoformat()} is outside the resolved window "
            f"{resolved[0].at.isoformat()}..{resolved[-1].at.isoformat()}"
        )

    start = end = None
    for current, following in pairwise(resolved):
        if current.at <= now < following.at:
            start, end = current, following
            break
    if start is None or end is None:  # pragma: no cover - guarded above
        raise CurveError("no bracketing keyframes found")

    span = (end.at - start.at).total_seconds()
    progress = 0.0 if span <= 0 else (now - start.at).total_seconds() / span
    eased = ease(start.easing, progress)

    colour = interpolate_colour(start.colour, end.colour, eased)
    return Target(
        mode=colour.mode,
        kelvin=colour.kelvin,
        hs=colour.hs,
        brightness_pct=interpolate_brightness(
            start.brightness_pct, end.brightness_pct, eased
        ),
        segment=(start.id, end.id),
        evaluated_at=now,
    )


def sample(
    resolved: Sequence[ResolvedKeyframe],
    start: datetime,
    end: datetime,
    step_minutes: int = 5,
) -> list[Target]:
    """Evaluate at regular intervals, for the editor's gradient strip."""
    if step_minutes <= 0:
        raise CurveError("step_minutes must be positive")
    out: list[Target] = []
    cursor = start
    stride = timedelta(minutes=step_minutes)
    while cursor < end:
        out.append(evaluate(resolved, cursor))
        cursor += stride
    return out


def clamp_target(target: Target, min_kelvin: int, max_kelvin: int) -> Target:
    """Pull a kelvin target inside what the bulbs can actually reach (§7.3)."""
    if target.mode != "kelvin" or target.kelvin is None:
        return target
    clamped = min(max_kelvin, max(min_kelvin, target.kelvin))
    if clamped == target.kelvin:
        return target
    return Target(
        mode=target.mode,
        kelvin=clamped,
        hs=target.hs,
        brightness_pct=target.brightness_pct,
        segment=target.segment,
        evaluated_at=target.evaluated_at,
    )
