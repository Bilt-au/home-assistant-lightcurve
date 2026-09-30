"""A group must never contain its own wrapper light.

If it does, applying the curve calls `light.turn_on` on the wrapper, which routes
straight back into the wrapper's own `async_turn_on`, which sends to the group's
members, which include the wrapper. Each hop awaits the next, so the chain never
unwinds and memory climbs until Home Assistant is killed.

A wrapper landing in the area it drives is not an exotic misconfiguration: it is
what happens when someone tidies up their device list and files the Lightcurve
device under the room it controls.
"""

from __future__ import annotations

from freezegun import freeze_time
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.lightcurve.const import DEFAULT_PROFILE_ID, DOMAIN
from custom_components.lightcurve.coordinator import (
    LightcurveCoordinator,
    members_for_area,
)
from custom_components.lightcurve.store import Group, LightcurveStore

MORNING_UTC = "2026-09-30 08:00:00"


def register_light(hass, platform: str, object_id: str, area_id: str) -> str:
    """Register a light and put it in an area, as a real integration would."""
    entities = er.async_get(hass)
    entry = entities.async_get_or_create(
        "light", platform, f"unique_{platform}_{object_id}", suggested_object_id=object_id
    )
    entities.async_update_entity(entry.entity_id, area_id=area_id)
    return entry.entity_id


async def build(hass, area_id: str) -> tuple[LightcurveCoordinator, Group]:
    store = LightcurveStore(hass)
    await store.async_load()
    group = Group(
        id="g_toilet", name="Toilet", area_id=area_id, profile_id=DEFAULT_PROFILE_ID
    )
    await store.async_put_group(group)
    return LightcurveCoordinator(hass, store), group


async def test_members_for_area_excludes_our_own_wrapper(hass):
    areas = ar.async_get(hass)
    area = areas.async_get_or_create("Toilet")
    bulb = register_light(hass, "tplink", "toilet_1", area.id)
    wrapper = register_light(hass, DOMAIN, "toilet", area.id)

    found = members_for_area(hass, area.id)
    assert bulb in found
    assert wrapper not in found, (
        "the wrapper light must never be returned as a member of its own area"
    )


async def test_a_group_never_lists_its_own_wrapper_as_a_member(hass):
    areas = ar.async_get(hass)
    area = areas.async_get_or_create("Toilet")
    bulb = register_light(hass, "tplink", "toilet_1", area.id)
    wrapper = register_light(hass, DOMAIN, "toilet", area.id)

    coordinator, group = await build(hass, area.id)
    members = coordinator.members(group)
    assert members == [bulb]
    assert wrapper not in members


async def test_an_explicit_member_list_cannot_name_our_own_entity(hass):
    """Hand-edited storage, or a group saved before this guard existed."""
    areas = ar.async_get(hass)
    area = areas.async_get_or_create("Toilet")
    bulb = register_light(hass, "tplink", "toilet_1", area.id)
    wrapper = register_light(hass, DOMAIN, "toilet", area.id)

    store = LightcurveStore(hass)
    await store.async_load()
    group = Group(
        id="g_bad",
        name="Bad",
        members=[bulb, wrapper],
        profile_id=DEFAULT_PROFILE_ID,
    )
    await store.async_put_group(group)
    coordinator = LightcurveCoordinator(hass, store)

    assert coordinator.members(group) == [bulb], (
        "a stored member list naming our own entity must be filtered, not trusted"
    )


async def test_applying_never_commands_our_own_wrapper(hass, member_attributes):
    """The end-to-end guard: the loop starts with a command to ourselves."""
    await hass.config.async_set_time_zone("Africa/Johannesburg")
    await hass.config.async_update(latitude=-29.8587, longitude=31.0218)
    areas = ar.async_get(hass)
    area = areas.async_get_or_create("Toilet")
    bulb = register_light(hass, "tplink", "toilet_1", area.id)
    wrapper = register_light(hass, DOMAIN, "toilet", area.id)
    hass.states.async_set(bulb, "on", dict(member_attributes))
    hass.states.async_set(wrapper, "on", dict(member_attributes))

    coordinator, group = await build(hass, area.id)
    calls = async_mock_service(hass, "light", "turn_on")

    with freeze_time(MORNING_UTC):
        await coordinator.async_apply(group, force=True)
        await coordinator.async_turn_on(group)

    assert calls, "the real bulb should still be driven"
    targeted = {call.data["entity_id"] for call in calls}
    assert wrapper not in targeted, (
        f"commanded its own wrapper light: {targeted}. This is the recursion that"
        " exhausts memory."
    )
    assert bulb in targeted


async def test_a_device_level_area_also_excludes_the_wrapper(hass):
    """Entities usually inherit their area from their device, which is the path
    members_for_area follows — and the path the wrapper arrives by too."""
    areas = ar.async_get(hass)
    devices = dr.async_get(hass)
    entities = er.async_get(hass)
    area = areas.async_get_or_create("Toilet")

    from pytest_homeassistant_custom_component.common import MockConfigEntry

    entry = MockConfigEntry(domain=DOMAIN)
    entry.add_to_hass(hass)
    device = devices.async_get_or_create(
        config_entry_id=entry.entry_id, identifiers={(DOMAIN, "g_toilet")}
    )
    devices.async_update_device(device.id, area_id=area.id)
    wrapper = entities.async_get_or_create(
        "light", DOMAIN, "lightcurve_g_toilet_light", device_id=device.id,
        suggested_object_id="toilet",
    )

    assert wrapper.entity_id not in members_for_area(hass, area.id)
