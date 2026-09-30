"""Coordinator behaviour, including the rules Phase 0 measurements produced.

Several of these tests exist because a plausible-looking implementation would fail
them in ways that are invisible until the lights misbehave for a day. They are
labelled where that is the case.
"""

from __future__ import annotations

import time

import pytest
from freezegun import freeze_time
from homeassistant.core import Context
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.lightcurve.const import DEFAULT_PROFILE_ID
from custom_components.lightcurve.coordinator import LightcurveCoordinator
from custom_components.lightcurve.store import Group, LightcurveStore

MEMBERS = ["light.toilet_1", "light.toilet_2"]

# Local 10:00 in Africa/Johannesburg: inside the morning->noon segment, so the
# target is a colour temperature rather than the red night section.
MORNING_UTC = "2026-09-30 08:00:00"
# Local 22:00: inside the red section.
NIGHT_UTC = "2026-09-30 20:00:00"


async def setup_coordinator(hass, member_attributes, **group_kwargs):
    # Coordinates and timezone must agree. The test harness defaults to San Diego,
    # and with a Johannesburg timezone solar noon resolves to 21:52 local — inside
    # the red night section, splitting it. See test_engine's
    # test_a_sun_keyframe_landing_inside_a_colour_section_splits_it.
    await hass.config.async_set_time_zone("Africa/Johannesburg")
    await hass.config.async_update(latitude=-29.8587, longitude=31.0218)
    for entity_id in MEMBERS:
        hass.states.async_set(entity_id, "on", dict(member_attributes))

    store = LightcurveStore(hass)
    await store.async_load()
    group = Group(
        id="g_toilet",
        name="Toilet",
        members=list(MEMBERS),
        profile_id=DEFAULT_PROFILE_ID,
        **group_kwargs,
    )
    await store.async_put_group(group)
    return LightcurveCoordinator(hass, store), group


# --------------------------------------------------- the acceptance criterion


async def test_turn_on_sends_one_command_per_bulb_with_colour_and_brightness(
    hass, member_attributes
):
    """FR-9, and the whole point of the integration.

    Colour and brightness must ride in the same command. Two commands, or a command
    missing the colour, is the flash this project exists to remove.
    """
    coordinator, group = await setup_coordinator(hass, member_attributes)
    calls = async_mock_service(hass, "light", "turn_on")

    with freeze_time(MORNING_UTC):
        await coordinator.async_turn_on(group)

    assert len(calls) == len(MEMBERS), "expected exactly one command per bulb"
    targeted = set()
    for call in calls:
        entity_id = call.data["entity_id"]
        assert isinstance(entity_id, str), "each command addresses a single bulb"
        targeted.add(entity_id)
        assert "color_temp_kelvin" in call.data, "colour was missing from the turn-on"
        assert "brightness_pct" in call.data, "brightness was missing from the turn-on"
    assert targeted == set(MEMBERS)


async def test_turn_on_during_the_night_section_sends_a_colour_not_a_temperature(
    hass, member_attributes
):
    """The red-at-night requirement, end to end."""
    coordinator, group = await setup_coordinator(hass, member_attributes)
    calls = async_mock_service(hass, "light", "turn_on")

    with freeze_time(NIGHT_UTC):
        await coordinator.async_turn_on(group)

    data = calls[0].data
    assert "hs_color" in data
    assert data["hs_color"][0] == pytest.approx(0, abs=1)  # red
    assert data["brightness_pct"] == 3


async def test_no_transition_is_sent(hass, member_attributes):
    """The L630 ignores transitions, so sending one only misleads later debugging."""
    coordinator, group = await setup_coordinator(hass, member_attributes)
    calls = async_mock_service(hass, "light", "turn_on")

    with freeze_time(MORNING_UTC):
        await coordinator.async_apply(group, force=True)

    assert all("transition" not in call.data for call in calls)


# ------------------------------------------------------------ per-channel overrides


async def test_explicit_brightness_overrides_only_brightness(hass, member_attributes):
    """Siri dimming must hold the brightness but leave colour on the curve (FR-17)."""
    coordinator, group = await setup_coordinator(hass, member_attributes)
    calls = async_mock_service(hass, "light", "turn_on")

    with freeze_time(MORNING_UTC):
        await coordinator.async_turn_on(group, brightness_pct=30)

    runtime = coordinator.runtime(group.id)
    assert runtime.override_brightness is True
    assert runtime.override_colour is False
    data = calls[0].data
    assert data["brightness_pct"] == 30
    assert "color_temp_kelvin" in data, "colour should still come from the curve"


async def test_explicit_colour_overrides_only_colour(hass, member_attributes):
    coordinator, group = await setup_coordinator(hass, member_attributes)
    calls = async_mock_service(hass, "light", "turn_on")

    with freeze_time(MORNING_UTC):
        await coordinator.async_turn_on(group, hs_color=[240, 100])

    runtime = coordinator.runtime(group.id)
    assert runtime.override_colour is True
    assert runtime.override_brightness is False
    assert calls[0].data["hs_color"] == [240, 100]
    assert "brightness_pct" in calls[0].data


async def test_an_overridden_channel_is_left_out_of_later_commands(
    hass, member_attributes
):
    coordinator, group = await setup_coordinator(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    runtime = coordinator.runtime(group.id)
    runtime.override_brightness = True

    calls = async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await coordinator.async_apply(group, force=True)

    assert calls
    assert all("brightness_pct" not in call.data for call in calls)


async def test_turn_off_clears_overrides(hass, member_attributes):
    coordinator, group = await setup_coordinator(hass, member_attributes)
    async_mock_service(hass, "light", "turn_off")
    runtime = coordinator.runtime(group.id)
    runtime.override_colour = True
    runtime.override_brightness = True

    await coordinator.async_turn_off(group)
    assert runtime.overridden is False


async def test_resume_clears_overrides_and_reapplies(hass, member_attributes):
    coordinator, group = await setup_coordinator(hass, member_attributes)
    calls = async_mock_service(hass, "light", "turn_on")
    runtime = coordinator.runtime(group.id)
    runtime.override_colour = True

    with freeze_time(MORNING_UTC):
        await coordinator.async_resume(group)

    assert runtime.overridden is False
    assert calls


# ------------------------------------------------------------- override detection


async def test_a_foreign_change_raises_an_override(hass, member_attributes):
    coordinator, group = await setup_coordinator(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await coordinator.async_apply(group, force=True)
    coordinator._resubscribe_members()
    runtime = coordinator.runtime(group.id)
    runtime.suppress_until.clear()

    attributes = dict(member_attributes)
    attributes["brightness"] = 255  # someone set it to full
    hass.states.async_set(MEMBERS[0], "on", attributes, context=Context())
    await hass.async_block_till_done()

    assert runtime.override_brightness is True


async def test_our_own_commands_do_not_raise_an_override(hass, member_attributes):
    """Otherwise the curve would flag itself and stop on the first tick."""
    coordinator, group = await setup_coordinator(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    coordinator._resubscribe_members()

    with freeze_time(MORNING_UTC):
        await coordinator.async_apply(group, force=True)
        await hass.async_block_till_done()

    assert coordinator.runtime(group.id).overridden is False


async def test_synthesised_hs_in_colour_temp_mode_is_not_a_colour_override(
    hass, member_attributes
):
    """Measured in Phase 0: in colour-temperature mode the TP-Link integration still
    reports an hs_color derived from the kelvin value. Comparing hue unconditionally
    would mark every white light as carrying a colour, and every group would override
    itself within one tick."""
    coordinator, group = await setup_coordinator(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await coordinator.async_apply(group, force=True)
    coordinator._resubscribe_members()
    runtime = coordinator.runtime(group.id)
    runtime.suppress_until.clear()
    applied = runtime.applied[MEMBERS[0]]

    attributes = dict(member_attributes)
    attributes["color_mode"] = "color_temp"
    attributes["color_temp_kelvin"] = applied.kelvin
    attributes["brightness"] = round(applied.brightness_pct / 100 * 255)
    # A hue wildly different from the target, but in colour_temp mode it is derived,
    # not commanded.
    attributes["hs_color"] = [27.8, 56.9]
    hass.states.async_set(MEMBERS[0], "on", attributes, context=Context())
    await hass.async_block_till_done()

    assert runtime.override_colour is False, "synthesised hs was read as a real colour"


async def test_state_within_tolerance_is_not_an_override(hass, member_attributes):
    coordinator, group = await setup_coordinator(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await coordinator.async_apply(group, force=True)
    coordinator._resubscribe_members()
    runtime = coordinator.runtime(group.id)
    runtime.suppress_until.clear()
    applied = runtime.applied[MEMBERS[0]]

    attributes = dict(member_attributes)
    attributes["color_temp_kelvin"] = applied.kelvin + 10  # inside the 25 K tolerance
    attributes["brightness"] = round(applied.brightness_pct / 100 * 255) + 2
    hass.states.async_set(MEMBERS[0], "on", attributes, context=Context())
    await hass.async_block_till_done()

    assert runtime.overridden is False


async def test_a_member_turning_off_alone_is_not_an_override(hass, member_attributes):
    coordinator, group = await setup_coordinator(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await coordinator.async_apply(group, force=True)
    coordinator._resubscribe_members()
    coordinator.runtime(group.id).suppress_until.clear()

    hass.states.async_set(MEMBERS[0], "off", dict(member_attributes), context=Context())
    await hass.async_block_till_done()

    assert coordinator.runtime(group.id).overridden is False


async def test_changes_inside_the_suppression_window_are_ignored(
    hass, member_attributes
):
    coordinator, group = await setup_coordinator(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await coordinator.async_apply(group, force=True)
    coordinator._resubscribe_members()
    runtime = coordinator.runtime(group.id)
    runtime.suppress_until[MEMBERS[0]] = time.monotonic() + 30

    attributes = dict(member_attributes)
    attributes["brightness"] = 255
    hass.states.async_set(MEMBERS[0], "on", attributes, context=Context())
    await hass.async_block_till_done()

    assert runtime.override_brightness is False


# ------------------------------------------------------------------- thresholds


async def test_an_imperceptible_change_sends_nothing(hass, member_attributes):
    """The scheduler must not command the bulbs every tick for nothing."""
    coordinator, group = await setup_coordinator(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await coordinator.async_apply(group, force=True)

        calls = async_mock_service(hass, "light", "turn_on")
        coordinator.runtime(group.id).last_command_at.clear()
        # Same instant, so the curve has not moved at all.
        await coordinator.async_apply(group)

    assert calls == []


async def test_the_rate_limit_suppresses_a_rapid_second_command(
    hass, member_attributes
):
    """Isolated from the perceptibility threshold on purpose.

    freezegun patches time.monotonic, so simply advancing the clock far enough for the
    curve to move also clears the rate-limit window. The last-applied state is faked
    to something far from the target instead, so the threshold passes and only the
    rate limit can be responsible for the silence.
    """
    coordinator, group = await setup_coordinator(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC) as frozen:
        await coordinator.async_apply(group, force=True)

        calls = async_mock_service(hass, "light", "turn_on")
        for entity_id in MEMBERS:
            applied = coordinator.runtime(group.id).applied[entity_id]
            applied.kelvin = 6500
            applied.brightness_pct = 100

        frozen.tick(2)  # inside min_command_interval_seconds, which is 5
        await coordinator.async_apply(group)
        assert calls == [], "a command was sent inside min_command_interval_seconds"

        frozen.tick(10)  # now outside it
        await coordinator.async_apply(group)
        assert calls, "the command should be sent once the interval has passed"


async def test_force_bypasses_both_the_threshold_and_the_rate_limit(
    hass, member_attributes
):
    coordinator, group = await setup_coordinator(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await coordinator.async_apply(group, force=True)
        calls = async_mock_service(hass, "light", "turn_on")
        await coordinator.async_apply(group, force=True)

    assert calls, "apply_now must always reach the bulbs"


# --------------------------------------------------------------------- targets


async def test_target_is_clamped_to_what_the_bulbs_support(hass, member_attributes):
    narrow = dict(member_attributes)
    narrow["min_color_temp_kelvin"] = 3000
    narrow["max_color_temp_kelvin"] = 4000
    coordinator, group = await setup_coordinator(hass, narrow)

    with freeze_time(NIGHT_UTC):
        # The night section is a colour, so clamping does not apply to it; check the
        # daytime end instead, where the curve dips to 2200 K.
        pass
    with freeze_time("2026-09-30 17:45:00"):  # local 19:45, the 2200 K shoulder
        target = coordinator.target_for(group)

    assert target is not None
    if target.mode == "kelvin":
        assert 3000 <= target.kelvin <= 4000


async def test_group_is_on_if_any_member_is_on(hass, member_attributes):
    coordinator, group = await setup_coordinator(hass, member_attributes)
    hass.states.async_set(MEMBERS[0], "off", dict(member_attributes))
    assert coordinator.is_on(group) is True
    hass.states.async_set(MEMBERS[1], "off", dict(member_attributes))
    assert coordinator.is_on(group) is False


async def test_unavailable_members_are_skipped_not_blocking(hass, member_attributes):
    """FR-20: one dead bulb must not stop its neighbours being driven."""
    coordinator, group = await setup_coordinator(hass, member_attributes)
    hass.states.async_set(MEMBERS[0], "unavailable", {})
    calls = async_mock_service(hass, "light", "turn_on")

    with freeze_time(MORNING_UTC):
        await coordinator.async_apply(group, force=True)

    assert calls
    assert MEMBERS[0] not in calls[0].data["entity_id"]
    assert MEMBERS[1] in calls[0].data["entity_id"]


async def test_a_disabled_group_is_left_alone_by_the_tick(hass, member_attributes):
    coordinator, _group = await setup_coordinator(
        hass, member_attributes, enabled=False
    )
    calls = async_mock_service(hass, "light", "turn_on")

    with freeze_time(MORNING_UTC):
        await coordinator.async_apply_all()

    assert calls == []
