"""The circuit breaker that stops a feedback loop killing Home Assistant.

Two adaptive systems pointed at the same light each react to the other's writes.
Every cycle allocates service calls, contexts and coroutine frames, and nothing in
the loop yields a stopping condition — so the process grows until it is killed.
Dropping commands is a far better failure than taking the whole instance down.
"""

from __future__ import annotations

import time

from freezegun import freeze_time
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.lightcurve.const import DEFAULT_PROFILE_ID
from custom_components.lightcurve.coordinator import (
    STORM_LIMIT,
    LightcurveCoordinator,
)
from custom_components.lightcurve.store import Group, LightcurveStore

MEMBERS = ["light.toilet_1", "light.toilet_2"]
MORNING_UTC = "2026-09-30 08:00:00"


async def build(hass, member_attributes):
    await hass.config.async_set_time_zone("Africa/Johannesburg")
    await hass.config.async_update(latitude=-29.8587, longitude=31.0218)
    for entity_id in MEMBERS:
        hass.states.async_set(entity_id, "on", dict(member_attributes))
    store = LightcurveStore(hass)
    await store.async_load()
    group = Group(
        id="g_toilet", name="Toilet", members=list(MEMBERS),
        profile_id=DEFAULT_PROFILE_ID,
    )
    await store.async_put_group(group)
    return LightcurveCoordinator(hass, store), group


async def test_ordinary_use_is_never_throttled(hass, member_attributes):
    """A person pressing a button, or a handful of automations, must be unaffected."""
    coordinator, group = await build(hass, member_attributes)
    calls = async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        for _ in range(STORM_LIMIT):
            await coordinator.async_turn_on(group)
    assert len(calls) == STORM_LIMIT * len(MEMBERS)
    assert coordinator.runtime(group.id).storm_until == 0.0


async def test_a_command_storm_is_cut_off(hass, member_attributes):
    coordinator, group = await build(hass, member_attributes)
    calls = async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        for _ in range(STORM_LIMIT * 5):
            await coordinator.async_turn_on(group)

    sent = len(calls) // len(MEMBERS)
    assert sent <= STORM_LIMIT + 1, f"{sent} commands got through; the loop was not cut"
    assert coordinator.runtime(group.id).storm_until > 0.0


async def test_the_cut_off_explains_itself(hass, member_attributes, caplog):
    """A silent circuit breaker is its own mystery. The log has to name the likely
    cause, because the user cannot see the loop."""
    coordinator, group = await build(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        for _ in range(STORM_LIMIT * 3):
            await coordinator.async_turn_on(group)
    assert "Adaptive Lighting" in caplog.text
    assert "commanded more than" in caplog.text


async def test_commands_resume_after_the_cooldown(hass, member_attributes):
    """The breaker must reset, or one burst disables the light until a restart."""
    coordinator, group = await build(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        for _ in range(STORM_LIMIT * 3):
            await coordinator.async_turn_on(group)

        runtime = coordinator.runtime(group.id)
        assert runtime.storm_until > 0.0
        # Pretend the cooldown has elapsed.
        runtime.storm_until = time.monotonic() - 1

        calls = async_mock_service(hass, "light", "turn_on")
        await coordinator.async_turn_on(group)
    assert calls, "the light must work again once the storm has passed"


async def test_spread_out_commands_never_trip_it(hass, member_attributes):
    """The window is a rate, not a total: a busy but sane house stays working."""
    coordinator, group = await build(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC) as frozen:
        for _ in range(STORM_LIMIT * 4):
            await coordinator.async_turn_on(group)
            frozen.tick(2)  # well inside the window, far below the rate
    assert coordinator.runtime(group.id).storm_until == 0.0


async def test_the_scheduler_still_drives_the_curve_during_a_storm(
    hass, member_attributes
):
    """The breaker guards the externally-facing path only. The curve itself is ours
    and cannot run away, so it must keep working."""
    coordinator, group = await build(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        for _ in range(STORM_LIMIT * 3):
            await coordinator.async_turn_on(group)
        calls = async_mock_service(hass, "light", "turn_on")
        await coordinator.async_apply(group, force=True)
    assert calls, "the scheduled curve should be unaffected by the breaker"


# --------------------------------------------------- naming the likely cause


async def test_adaptive_lighting_on_our_wrapper_is_reported_as_an_error(
    hass, hass_storage, member_attributes, caplog
):
    """The loop is a configuration only the user can fix, and it is invisible
    from the UI, so startup has to name it."""
    hass.states.async_set(
        "switch.adaptive_lighting_toilet",
        "on",
        {"lights": ["light.toilet_toilet_lights"]},
    )
    from custom_components.lightcurve.coordinator import LightcurveCoordinator
    from custom_components.lightcurve.store import LightcurveStore

    store = LightcurveStore(hass)
    await store.async_load()
    coordinator = LightcurveCoordinator(hass, store)

    from homeassistant.helpers import entity_registry as er

    registry = er.async_get(hass)
    registry.async_get_or_create(
        "light", "lightcurve", "lightcurve_g_toilet_light",
        suggested_object_id="toilet_toilet_lights",
    )
    coordinator._warn_about_competing_integrations()
    assert "will drive each other in a loop" in caplog.text


async def test_adaptive_lighting_on_a_member_is_reported_as_a_warning(
    hass, member_attributes, caplog
):
    coordinator, _group = await build(hass, member_attributes)
    hass.states.async_set(
        "switch.adaptive_lighting_toilet", "on", {"lights": [MEMBERS[0]]}
    )
    coordinator._warn_about_competing_integrations()
    assert "manual overrides" in caplog.text


async def test_no_warning_when_nothing_else_is_adapting(
    hass, member_attributes, caplog
):
    coordinator, _group = await build(hass, member_attributes)
    coordinator._warn_about_competing_integrations()
    assert "loop" not in caplog.text
