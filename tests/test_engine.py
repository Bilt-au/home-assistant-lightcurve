"""Unit tests for the curve engine. Plain pytest: no Home Assistant needed."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from custom_components.lightcurve.engine import (
    Colour,
    CurveError,
    Keyframe,
    KeyframeTime,
    ResolvedKeyframe,
    clamp_target,
    ease,
    evaluate,
    hs_to_rgb,
    interpolate_brightness,
    interpolate_colour,
    kelvin_to_mired,
    kelvin_to_rgb,
    mired_to_kelvin,
    oklab_to_rgb,
    parse_hhmm,
    resolve_day,
    resolve_window,
    rgb_to_hs,
    rgb_to_oklab,
    sample,
)

TZ = timezone(timedelta(hours=2))  # Durban, no DST


def at(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=TZ)


# A stand-in for HA's sun helper. Fixed offsets keep the arithmetic checkable.
SUN_OFFSETS = {
    "dawn": (5, 0),
    "sunrise": (5, 30),
    "solar_noon": (12, 0),
    "sunset": (18, 30),
    "dusk": (19, 0),
}


def sun(day: date, event: str) -> datetime | None:
    if event not in SUN_OFFSETS:
        return None
    hour, minute = SUN_OFFSETS[event]
    return at(day, hour, minute)


def rday(keyframes, day, sun_fn=sun, tz=TZ):
    """resolve_day with this test module's timezone already supplied."""
    return resolve_day(keyframes, day, sun_fn, tz)


def rwin(keyframes, day, sun_fn=sun, tz=TZ, days_either_side=1):
    """resolve_window with this test module's timezone already supplied."""
    return resolve_window(keyframes, day, sun_fn, tz, days_either_side)


def kf(
    identifier: str,
    when: KeyframeTime,
    colour: Colour,
    brightness: int,
    easing: str = "linear",
) -> Keyframe:
    return Keyframe(identifier, when, colour, brightness, easing)  # type: ignore[arg-type]


def fixed(value: str) -> KeyframeTime:
    return KeyframeTime(type="fixed", value=value)


def solar(event: str, offset: int = 0) -> KeyframeTime:
    return KeyframeTime(type="sun", event=event, offset_min=offset)


# ------------------------------------------------------------------------- easing


def test_linear_easing_is_identity():
    assert ease("linear", 0.0) == 0.0
    assert ease("linear", 0.5) == 0.5
    assert ease("linear", 1.0) == 1.0


def test_ease_in_out_is_smoothstep_and_symmetric():
    assert ease("ease_in_out", 0.0) == 0.0
    assert ease("ease_in_out", 0.5) == pytest.approx(0.5)
    assert ease("ease_in_out", 1.0) == 1.0
    # symmetric about the midpoint
    assert ease("ease_in_out", 0.25) == pytest.approx(1 - ease("ease_in_out", 0.75))
    # and slower than linear at the start
    assert ease("ease_in_out", 0.1) < 0.1


def test_step_easing_holds_the_start_value():
    assert ease("step", 0.0) == 0.0
    assert ease("step", 0.99) == 0.0


def test_easing_clamps_out_of_range_progress():
    assert ease("linear", -1.0) == 0.0
    assert ease("linear", 2.0) == 1.0


def test_unknown_easing_is_rejected():
    with pytest.raises(CurveError):
        ease("bounce", 0.5)  # type: ignore[arg-type]


# -------------------------------------------------------------------- mired maths


def test_mired_round_trip():
    for kelvin in (2200, 2700, 4000, 6500):
        assert mired_to_kelvin(kelvin_to_mired(kelvin)) == pytest.approx(kelvin)


def test_mired_interpolation_is_not_linear_in_kelvin():
    """The midpoint in mireds sits below the arithmetic mean in kelvin.

    This is the whole reason the spec interpolates in mireds, so it is worth
    pinning rather than trusting.
    """
    midpoint = interpolate_colour(
        Colour.from_kelvin(2000), Colour.from_kelvin(6000), 0.5
    )
    assert midpoint.kelvin == 3000  # arithmetic mean would be 4000
    assert midpoint.kelvin < 4000


def test_non_positive_kelvin_is_rejected():
    with pytest.raises(CurveError):
        kelvin_to_mired(0)


# --------------------------------------------------------------- colour conversion


def test_kelvin_to_rgb_is_warm_at_the_bottom_and_cool_at_the_top():
    warm = kelvin_to_rgb(2200)
    cool = kelvin_to_rgb(6500)
    assert warm[0] > warm[2]  # more red than blue
    assert cool[2] > warm[2]  # cooler light is bluer


def test_oklab_round_trip_preserves_rgb():
    for rgb in [(255, 0, 0), (0, 255, 0), (10, 20, 30), (255, 147, 41), (128, 128, 128)]:
        back = oklab_to_rgb(rgb_to_oklab(rgb))
        assert back == pytest.approx(rgb, abs=0.5)


def test_hs_round_trip_preserves_hue_and_saturation():
    for hue, saturation in [(0, 100), (30, 90), (120, 50), (240, 100), (359, 10)]:
        got_hue, got_sat = rgb_to_hs(hs_to_rgb(hue, saturation))
        assert got_hue == pytest.approx(hue, abs=0.5)
        assert got_sat == pytest.approx(saturation, abs=0.5)


def test_rgb_to_hs_drops_lightness():
    """Colour carries no brightness of its own; that is a separate channel."""
    bright = rgb_to_hs((255, 0, 0))
    dim = rgb_to_hs((60, 0, 0))
    assert bright == dim


def test_greyscale_has_zero_saturation():
    _, saturation = rgb_to_hs((128, 128, 128))
    assert saturation == pytest.approx(0.0)


# --------------------------------------------------------- colour interpolation


def test_kelvin_pair_stays_in_kelvin_mode():
    """CT segments must not fall back to hs: the L630 uses a dedicated white LED in
    colour-temperature mode, so staying in kelvin is what keeps whites clean."""
    blended = interpolate_colour(
        Colour.from_kelvin(2200), Colour.from_kelvin(4000), 0.5
    )
    assert blended.mode == "kelvin"
    assert blended.hs is None


def test_any_rgb_endpoint_forces_hs_mode():
    blended = interpolate_colour(
        Colour.from_kelvin(2200), Colour.from_hs(0, 100), 0.5
    )
    assert blended.mode == "hs"
    assert blended.kelvin is None


def test_red_to_warm_white_takes_the_short_way_round():
    """Red (hue 0) to 2200 K (hue ~27) must not detour through green or blue.

    This is the ramp out of the night section, so a detour would be very visible.
    """
    warm_hue, _ = rgb_to_hs(kelvin_to_rgb(2200))
    for progress in (0.25, 0.5, 0.75):
        blended = interpolate_colour(
            Colour.from_hs(0, 100), Colour.from_kelvin(2200), progress
        )
        hue, _ = blended.hs
        assert 0 <= hue <= warm_hue + 1, f"hue {hue} left the 0..{warm_hue} arc"


def test_colour_interpolation_hits_its_endpoints():
    start, end = Colour.from_hs(0, 100), Colour.from_hs(120, 50)
    assert interpolate_colour(start, end, 0.0).hs == pytest.approx(start.hs, abs=0.5)
    assert interpolate_colour(start, end, 1.0).hs == pytest.approx(end.hs, abs=0.5)


def test_colour_interpolation_clamps_progress():
    start, end = Colour.from_kelvin(2000), Colour.from_kelvin(6000)
    assert interpolate_colour(start, end, -1).kelvin == 2000
    assert interpolate_colour(start, end, 2).kelvin == 6000


# ------------------------------------------------------------------- brightness


def test_brightness_interpolates_and_rounds():
    assert interpolate_brightness(10, 60, 0.0) == 10
    assert interpolate_brightness(10, 60, 1.0) == 60
    assert interpolate_brightness(10, 60, 0.5) == 35


def test_brightness_never_reaches_zero():
    """1 % is the floor: 0 would mean off, which is a different thing entirely."""
    assert interpolate_brightness(1, 1, 0.5) == 1
    assert interpolate_brightness(3, 1, 0.99) == 1


def test_brightness_outside_range_is_rejected_at_construction():
    with pytest.raises(CurveError):
        kf("k", fixed("00:00"), Colour.from_kelvin(2200), 0)
    with pytest.raises(CurveError):
        kf("k", fixed("00:00"), Colour.from_kelvin(2200), 101)


# ------------------------------------------------------------------- validation


def test_colour_validation():
    with pytest.raises(CurveError):
        Colour(mode="kelvin")
    with pytest.raises(CurveError):
        Colour(mode="hs")
    with pytest.raises(CurveError):
        Colour.from_kelvin(500)
    with pytest.raises(CurveError):
        Colour.from_hs(400, 50)
    with pytest.raises(CurveError):
        Colour(mode="cmyk")  # type: ignore[arg-type]


def test_keyframe_time_validation():
    with pytest.raises(CurveError):
        KeyframeTime(type="fixed")
    with pytest.raises(CurveError):
        KeyframeTime(type="fixed", value="25:99")
    with pytest.raises(CurveError):
        KeyframeTime(type="sun")
    with pytest.raises(CurveError):
        KeyframeTime(type="lunar")  # type: ignore[arg-type]


def test_parse_hhmm():
    assert parse_hhmm("00:00").hour == 0
    assert parse_hhmm("21:30") == __import__("datetime").time(21, 30)
    with pytest.raises(CurveError):
        parse_hhmm("nonsense")


# ------------------------------------------------------------------- resolution


def test_resolve_day_pins_fixed_and_sun_times():
    day = date(2026, 9, 30)
    resolved = rday(
        [
            kf("night", fixed("20:00"), Colour.from_hs(0, 100), 3),
            kf("dawn", solar("sunrise"), Colour.from_kelvin(2700), 40),
        ],
        day,
        sun,
    )
    assert [k.id for k in resolved] == ["dawn", "night"]  # sorted by time
    assert resolved[0].at == at(day, 5, 30)
    assert resolved[1].at == at(day, 20, 0)


def test_sun_offsets_are_applied():
    day = date(2026, 9, 30)
    resolved = rday(
        [kf("pre", solar("sunset", -30), Colour.from_kelvin(3200), 80)], day, sun
    )
    assert resolved[0].at == at(day, 18, 0)


def test_resolve_sorts_after_resolution_not_before():
    """A sun-relative keyframe that drifts past a fixed one must reorder.

    Stored order is not authoritative — this is the seasonal-reordering risk in §21,
    and sorting after resolution is what handles it.
    """
    day = date(2026, 9, 30)
    keyframes = [
        kf("fixed_six", fixed("06:00"), Colour.from_kelvin(2700), 30),
        kf("sunrise", solar("sunrise"), Colour.from_kelvin(3000), 50),
    ]
    # sunrise at 05:30 resolves before the fixed 06:00 keyframe
    assert [k.id for k in rday(keyframes, day, sun, TZ)] == ["sunrise", "fixed_six"]

    # push sunrise later and the order flips, with no change to stored order
    def late_sun(d: date, event: str) -> datetime | None:
        if event == "sunrise":
            return at(d, 7, 0)
        return sun(d, event)

    assert [k.id for k in rday(keyframes, day, late_sun)] == [
        "fixed_six",
        "sunrise",
    ]


def test_missing_sun_event_drops_the_keyframe_rather_than_failing():
    """Polar latitudes have days with no sunrise. One missing keyframe must not take
    the whole curve down with it."""
    day = date(2026, 9, 30)

    def no_sunrise(d: date, event: str) -> datetime | None:
        return None if event == "sunrise" else sun(d, event)

    resolved = rday(
        [
            kf("midnight", fixed("00:00"), Colour.from_kelvin(2200), 10),
            kf("sunrise", solar("sunrise"), Colour.from_kelvin(3000), 60),
        ],
        day,
        no_sunrise,
    )
    assert [k.id for k in resolved] == ["midnight"]


def test_resolve_window_spans_neighbouring_days():
    day = date(2026, 9, 30)
    resolved = rwin(
        [kf("noon", solar("solar_noon"), Colour.from_kelvin(5000), 90)],
        day,
        sun,
        TZ,
    )
    assert [k.at.date() for k in resolved] == [
        date(2026, 9, 29),
        date(2026, 9, 30),
        date(2026, 10, 1),
    ]


# --------------------------------------------------------------------- evaluation


def simple_curve(day: date) -> list[ResolvedKeyframe]:
    return rwin(
        [
            kf("night", fixed("20:00"), Colour.from_hs(0, 100), 3),
            kf("morning", fixed("08:00"), Colour.from_kelvin(2700), 40),
        ],
        day,
        sun,
        TZ,
    )


def test_evaluate_at_a_keyframe_returns_that_keyframe():
    day = date(2026, 9, 30)
    target = evaluate(simple_curve(day), at(day, 8, 0))
    assert target.brightness_pct == 40
    assert target.segment[0] == "morning"
    # The segment ends in red, so per 7.2 the whole segment renders as hs even at
    # its kelvin end. The colour is still 2700 K, expressed as hue/saturation.
    assert target.mode == "hs"
    expected_hue, expected_sat = rgb_to_hs(kelvin_to_rgb(2700))
    assert target.hs[0] == pytest.approx(expected_hue, abs=1)
    assert target.hs[1] == pytest.approx(expected_sat, abs=1)


def realistic_curve(day: date) -> list[ResolvedKeyframe]:
    """The shape a red night section actually needs.

    A keyframe sitting at each side of the colour section is not cosmetic. Without
    one, the segment from the last white keyframe to the red keyframe is hs for its
    whole length, so the entire day renders through the RGB LEDs and the dedicated
    white channel goes unused — dimmer and less pure, for no benefit. Short shoulder
    segments confine hs mode to a few minutes either side of the night.
    """
    return rwin(
        [
            kf("morning", fixed("08:00"), Colour.from_kelvin(2700), 40),
            kf("noon", solar("solar_noon"), Colour.from_kelvin(4000), 70),
            kf("evening", fixed("19:45"), Colour.from_kelvin(2200), 5),
            kf("red_on", fixed("20:00"), Colour.from_hs(0, 100), 3),
            kf("red_off", fixed("04:00"), Colour.from_hs(0, 100), 3),
            kf("predawn", fixed("04:15"), Colour.from_kelvin(2200), 5),
        ],
        day,
        sun,
        TZ,
    )


def test_daytime_stays_in_kelvin_mode_when_boundary_keyframes_exist():
    """The payoff of the shoulder keyframes: the day keeps its white channel."""
    day = date(2026, 9, 30)
    curve = realistic_curve(day)
    for hour in (8, 10, 12, 15, 19):
        target = evaluate(curve, at(day, hour))
        assert target.mode == "kelvin", f"{hour}:00 fell back to hs"
        assert target.kelvin is not None


def test_night_is_hs_and_the_shoulders_are_short():
    day = date(2026, 9, 30)
    curve = realistic_curve(day)
    for hour in (20, 22, 1, 3):
        assert evaluate(curve, at(day, hour)).mode == "hs"
    # 04:15 onwards is back to colour temperature
    assert evaluate(curve, at(day, 4, 30)).mode == "kelvin"
    # and the hs shoulder either side lasts 15 minutes, not 12 hours
    assert evaluate(curve, at(day, 19, 50)).mode == "hs"
    assert evaluate(curve, at(day, 19, 40)).mode == "kelvin"


def test_evaluate_midway_interpolates_both_channels():
    day = date(2026, 9, 30)
    # 08:00 (2700K/40%) -> 20:00 (red/3%), midpoint at 14:00
    target = evaluate(simple_curve(day), at(day, 14, 0))
    assert target.mode == "hs"  # an RGB endpoint forces hs for the segment
    assert 3 < target.brightness_pct < 40
    assert target.segment == ("morning", "night")


def test_curve_wraps_through_midnight():
    """01:00 sits in the segment from the previous evening's 20:00 to 08:00 today."""
    day = date(2026, 9, 30)
    target = evaluate(simple_curve(day), at(day, 1, 0))
    assert target.segment == ("night", "morning")
    # five hours into a twelve-hour segment, so brightness has risen off its floor
    assert 3 < target.brightness_pct < 40


def test_wrap_segment_is_continuous_across_midnight():
    """No discontinuity at 00:00 — the two sides of midnight must nearly agree."""
    day = date(2026, 9, 30)
    curve = simple_curve(day)
    before = evaluate(curve, at(day, 0, 0) - timedelta(seconds=1))
    after = evaluate(curve, at(day, 0, 0))
    assert abs(before.brightness_pct - after.brightness_pct) <= 1
    assert before.segment == after.segment


def test_step_easing_holds_until_the_next_keyframe():
    day = date(2026, 9, 30)
    curve = rwin(
        [
            kf("a", fixed("06:00"), Colour.from_kelvin(2200), 10, easing="step"),
            kf("b", fixed("18:00"), Colour.from_kelvin(6000), 100, easing="linear"),
        ],
        day,
        sun,
        TZ,
    )
    for hour in (6, 10, 14, 17):
        target = evaluate(curve, at(day, hour))
        assert target.kelvin == 2200
        assert target.brightness_pct == 10


def test_evaluate_needs_at_least_two_keyframes():
    day = date(2026, 9, 30)
    single = rday(
        [kf("only", fixed("12:00"), Colour.from_kelvin(3000), 50)], day, sun, TZ
    )
    with pytest.raises(CurveError):
        evaluate(single, at(day, 12, 30))


def test_evaluate_outside_the_window_is_an_error_not_a_guess():
    day = date(2026, 9, 30)
    curve = rday(
        [
            kf("a", fixed("06:00"), Colour.from_kelvin(2200), 10),
            kf("b", fixed("18:00"), Colour.from_kelvin(6000), 100),
        ],
        day,
        sun,
    )
    with pytest.raises(CurveError):
        evaluate(curve, at(day, 3, 0))


def test_red_night_section_holds_red_all_night():
    """The actual requirement: red from 20:00 to 04:00, whenever it is asked for."""
    day = date(2026, 9, 30)
    curve = rwin(
        [
            kf("red_on", fixed("20:00"), Colour.from_hs(0, 100), 3),
            kf("red_off", fixed("04:00"), Colour.from_hs(0, 100), 3),
            kf("morning", fixed("08:00"), Colour.from_kelvin(2700), 40),
            kf("evening", fixed("18:00"), Colour.from_kelvin(2700), 40),
        ],
        day,
        sun,
        TZ,
    )
    for hour in (20, 22, 23):
        target = evaluate(curve, at(day, hour))
        assert target.mode == "hs", f"{hour}:00 should be a colour section"
        assert target.hs[0] == pytest.approx(0, abs=1), f"{hour}:00 drifted off red"
        assert target.brightness_pct == 3
    for hour in (0, 2, 3):
        target = evaluate(curve, at(day, hour))
        assert target.mode == "hs"
        assert target.hs[0] == pytest.approx(0, abs=1)


# ------------------------------------------------------------------------ sample


def test_sample_walks_the_window_at_the_given_step():
    day = date(2026, 9, 30)
    curve = simple_curve(day)
    targets = sample(curve, at(day, 8, 0), at(day, 9, 0), step_minutes=15)
    assert len(targets) == 4
    assert [t.evaluated_at.minute for t in targets] == [0, 15, 30, 45]


def test_sample_rejects_a_non_positive_step():
    day = date(2026, 9, 30)
    with pytest.raises(CurveError):
        sample(simple_curve(day), at(day, 8), at(day, 9), step_minutes=0)


# ------------------------------------------------------------------------- clamp


def test_clamp_pulls_kelvin_into_the_supported_range():
    day = date(2026, 9, 30)
    target = evaluate(
        rwin(
            [
                kf("a", fixed("06:00"), Colour.from_kelvin(1500), 50),
                kf("b", fixed("18:00"), Colour.from_kelvin(1500), 50),
            ],
            day,
            sun,
        ),
        at(day, 12),
    )
    clamped = clamp_target(target, 2200, 6500)
    assert clamped.kelvin == 2200
    assert clamped.brightness_pct == target.brightness_pct


def test_clamp_leaves_in_range_and_hs_targets_alone():
    day = date(2026, 9, 30)
    curve = simple_curve(day)
    in_range = evaluate(curve, at(day, 8, 0))
    assert clamp_target(in_range, 2200, 6500) is in_range
    hs_target = evaluate(curve, at(day, 20, 0))
    assert clamp_target(hs_target, 2200, 6500) is hs_target


# ------------------------------------------------- sun keyframes vs colour sections


def test_a_sun_keyframe_landing_inside_a_colour_section_splits_it():
    """A hazard worth pinning, because the symptom is baffling.

    A sun-relative keyframe whose resolved time drifts into a colour section becomes
    an interior keyframe of that section, so the section is no longer one segment
    between two identical colours — it is two segments joining a colour to a white.
    The visible result is "my red night light is not red", with nothing obviously
    wrong in the profile.

    This is the seasonal-reordering risk from 21 in a form the spec did not spell
    out, and it is why validation has to check sun keyframes against colour-section
    boundaries across the whole year rather than only checking for collisions.
    """
    day = date(2026, 9, 30)
    keyframes = [
        kf("red_on", fixed("20:00"), Colour.from_hs(0, 100), 3),
        kf("red_off", fixed("04:00"), Colour.from_hs(0, 100), 3),
        kf("morning", fixed("08:00"), Colour.from_kelvin(2700), 40),
        kf("noon", solar("solar_noon"), Colour.from_kelvin(4000), 70),
    ]

    # Sane case: solar noon at midday, well clear of the night section.
    intact = rwin(keyframes, day)
    target = evaluate(intact, at(day, 22, 0))
    assert target.mode == "hs"
    assert target.hs[0] == pytest.approx(0, abs=1), "should be red at 22:00"

    # Now put solar noon at 21:52, as happens when coordinates and timezone disagree
    # — or, for a real installation, at a high enough latitude.
    def late_noon(d: date, event: str) -> datetime | None:
        if event == "solar_noon":
            return at(d, 21, 52)
        return sun(d, event)

    split = rwin(keyframes, day, late_noon)
    broken = evaluate(split, at(day, 22, 0))
    assert broken.hs is None or broken.hs[0] != pytest.approx(0, abs=1), (
        "this test documents the failure; if it now holds red, validation has been"
        " added and this expectation should be inverted"
    )
