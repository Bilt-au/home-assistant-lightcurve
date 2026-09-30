"""Adding and removing rooms after setup.

Lightcurve is one config entry holding many groups, so "add another room" is an edit
to this entry rather than a second one. Without it, the areas ticked at install were
permanent.
"""

from __future__ import annotations

from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from custom_components.lightcurve.const import DOMAIN
from custom_components.lightcurve.store import LightcurveStore


def make_area_with_light(hass, area_name: str, object_id: str) -> str:
    areas = ar.async_get(hass)
    entities = er.async_get(hass)
    area = areas.async_get_or_create(area_name)
    entry = entities.async_get_or_create(
        "light", "tplink", f"unique_{object_id}", suggested_object_id=object_id
    )
    entities.async_update_entity(entry.entity_id, area_id=area.id)
    return area.id


async def open_rooms(hass, integration):
    result = await hass.config_entries.options.async_init(integration.entry_id)
    assert result["type"] is FlowResultType.MENU
    assert set(result["menu_options"]) == {"rooms", "settings"}
    return await hass.config_entries.options.async_configure(
        result["flow_id"], {"next_step_id": "rooms"}
    )


async def test_the_options_menu_offers_rooms_and_settings(hass, integration):
    result = await hass.config_entries.options.async_init(integration.entry_id)
    assert result["type"] is FlowResultType.MENU


async def test_a_new_area_can_be_added_as_a_room(hass, integration):
    lounge = make_area_with_light(hass, "Lounge", "lounge_1")
    form = await open_rooms(hass, integration)
    assert form["step_id"] == "rooms"

    await hass.config_entries.options.async_configure(
        form["flow_id"], {"areas": [lounge]}
    )
    await hass.async_block_till_done()

    store = LightcurveStore(hass)
    await store.async_load()
    assert "g_lounge" in store.groups
    assert store.groups["g_lounge"].area_id == lounge


async def test_unticking_an_area_removes_its_group(hass, integration, hass_storage):
    lounge = make_area_with_light(hass, "Lounge", "lounge_1")
    form = await open_rooms(hass, integration)
    await hass.config_entries.options.async_configure(
        form["flow_id"], {"areas": [lounge]}
    )
    await hass.async_block_till_done()

    form = await open_rooms(hass, integration)
    await hass.config_entries.options.async_configure(form["flow_id"], {"areas": []})
    await hass.async_block_till_done()

    store = LightcurveStore(hass)
    await store.async_load()
    assert "g_lounge" not in store.groups


async def test_removing_a_room_takes_its_entities_with_it(hass, integration):
    """A removed group's entities can never come back, so leaving them in the
    registry is litter the user has to clean up by hand."""
    lounge = make_area_with_light(hass, "Lounge", "lounge_1")
    form = await open_rooms(hass, integration)
    await hass.config_entries.options.async_configure(
        form["flow_id"], {"areas": [lounge]}
    )
    await hass.async_block_till_done()

    devices = dr.async_get(hass)
    assert (
        devices.async_get_device_by_identifier(
            (DOMAIN, "g_lounge"), integration.entry_id
        )
        is not None
    )

    form = await open_rooms(hass, integration)
    await hass.config_entries.options.async_configure(form["flow_id"], {"areas": []})
    await hass.async_block_till_done()

    assert (
        devices.async_get_device_by_identifier(
            (DOMAIN, "g_lounge"), integration.entry_id
        )
        is None
    )


async def test_a_manually_configured_group_is_left_alone(hass, integration):
    """The seeded group uses an explicit member list, so it is not represented in
    the area picker and must survive an unrelated edit."""
    lounge = make_area_with_light(hass, "Lounge", "lounge_1")
    form = await open_rooms(hass, integration)
    assert "none" not in form["description_placeholders"]["manual"]

    await hass.config_entries.options.async_configure(
        form["flow_id"], {"areas": [lounge]}
    )
    await hass.async_block_till_done()

    store = LightcurveStore(hass)
    await store.async_load()
    assert "g_toilet" in store.groups, "a hand-configured group must not be removed"


async def test_settings_still_save(hass, integration):
    result = await hass.config_entries.options.async_init(integration.entry_id)
    form = await hass.config_entries.options.async_configure(
        result["flow_id"], {"next_step_id": "settings"}
    )
    assert form["step_id"] == "settings"
    await hass.config_entries.options.async_configure(
        form["flow_id"],
        {
            "tick_seconds": 45,
            "kelvin_threshold": 12,
            "brightness_threshold_pct": 2,
            "min_command_interval_seconds": 5,
            "kelvin_tolerance": 25,
            "brightness_tolerance_pct": 2,
            "default_transition_seconds": 0,
        },
    )
    await hass.async_block_till_done()

    store = LightcurveStore(hass)
    await store.async_load()
    assert store.settings["tick_seconds"] == 45
