#!/usr/bin/env python3
"""Generate the brand icon from the default profile.

The icon is not decoration: it is a plot of the curve the integration ships with,
drawn by the same engine that drives the lights. Height is brightness, colour is the
target colour at that time of day, so the shape and the palette are both real.

Kept in the repository so the asset is reproducible rather than an opaque binary.

    python tools/make_brand_assets.py
"""

from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from PIL import Image, ImageDraw  # noqa: E402

from custom_components.lightcurve.const import DEFAULT_PROFILE  # noqa: E402
from custom_components.lightcurve.engine import (  # noqa: E402
    colour_to_rgb,
    evaluate,
    resolve_window,
)
from custom_components.lightcurve.store import keyframe_from_dict  # noqa: E402

BRAND_DIR = ROOT / "custom_components" / "lightcurve" / "brand"
TZ = timezone(timedelta(hours=2))
SUPERSAMPLE = 4

# Brightness spans 3-70%, which would hug the floor if mapped literally. Mapped into
# a band instead, so the shape reads as a curve at 32 pixels.
BAND_TOP = 0.18
BAND_BOTTOM = 0.86


def sun(day: date, event: str) -> datetime | None:
    """A neutral sun, so the icon does not depend on anyone's latitude."""
    clock = {
        "dawn": (5, 15),
        "sunrise": (5, 45),
        "solar_noon": (12, 0),
        "sunset": (18, 15),
        "dusk": (18, 45),
    }.get(event)
    if clock is None:
        return None
    return datetime(day.year, day.month, day.day, *clock, tzinfo=TZ)


def curve_points(
    size: int, left: float, right: float
) -> list[tuple[float, float, tuple[int, int, int]]]:
    """(x, y, rgb) along a full day, spanning left..right in pixels."""
    keyframes = [
        keyframe_from_dict(k)
        for k in DEFAULT_PROFILE["variants"]["default"]["keyframes"]
    ]
    day = date(2026, 6, 21)
    resolved = resolve_window(keyframes, day, sun, TZ)

    points = []
    steps = size
    for index in range(steps + 1):
        fraction = index / steps
        moment = datetime(day.year, day.month, day.day, tzinfo=TZ) + timedelta(
            minutes=fraction * 24 * 60
        )
        if moment >= datetime(day.year, day.month, day.day, tzinfo=TZ) + timedelta(
            days=1
        ):
            moment -= timedelta(seconds=1)
        target = evaluate(resolved, moment)
        rgb = colour_to_rgb(_target_colour(target))
        level = target.brightness_pct / 100.0
        y = (BAND_BOTTOM - (BAND_BOTTOM - BAND_TOP) * level) * size
        x = left + (right - left) * fraction
        points.append((x, y, tuple(round(c) for c in rgb)))
    return points


def _target_colour(target):
    """Re-wrap a Target's colour so colour_to_rgb can consume it."""
    from custom_components.lightcurve.engine import Colour

    if target.mode == "kelvin":
        return Colour.from_kelvin(target.kelvin)
    return Colour.from_hs(*target.hs)


def render(size: int) -> Image.Image:
    work = size * SUPERSAMPLE
    image = Image.new("RGBA", (work, work), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # A dark rounded plate, so the warm end of the curve stays visible on both light
    # and dark backgrounds.
    inset = work * 0.06
    draw.rounded_rectangle(
        [inset, inset, work - inset, work - inset],
        radius=work * 0.22,
        fill=(22, 25, 32, 255),
    )

    stroke = work * 0.075
    # Keep the curve clear of the rounded corners, or the dim red night ends read as
    # clipping artefacts rather than part of the curve.
    margin = inset + stroke * 0.9
    floor = work - inset - stroke * 0.35
    points = curve_points(work, margin, work - margin)

    # Soft fill under the curve first, then the stroke over it.
    for x, y, rgb in points:
        draw.line([(x, y), (x, floor)], fill=(*rgb, 30), width=SUPERSAMPLE * 2)
    for x, y, rgb in points:
        draw.ellipse(
            [x - stroke / 2, y - stroke / 2, x + stroke / 2, y + stroke / 2],
            fill=(*rgb, 255),
        )

    # Mask the plate's rounded corners back out.
    mask = Image.new("L", (work, work), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [inset, inset, work - inset, work - inset], radius=work * 0.22, fill=255
    )
    image.putalpha(
        Image.composite(image.getchannel("A"), Image.new("L", (work, work), 0), mask)
    )
    return image.resize((size, size), Image.LANCZOS)


def main() -> int:
    BRAND_DIR.mkdir(parents=True, exist_ok=True)
    for name, size in (("icon.png", 256), ("icon@2x.png", 512)):
        path = BRAND_DIR / name
        render(size).save(path, "PNG", optimize=True)
        print(f"  {path.relative_to(ROOT)}  {size}x{size}  {path.stat().st_size} bytes")
    # Home Assistant treats a square logo as acceptable when there is no wordmark.
    for name, size in (("logo.png", 256), ("logo@2x.png", 512)):
        path = BRAND_DIR / name
        render(size).save(path, "PNG", optimize=True)
        print(f"  {path.relative_to(ROOT)}  {size}x{size}  {path.stat().st_size} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
