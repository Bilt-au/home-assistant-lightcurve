"""Config flow: area-based setup, and the Adaptive Lighting collision warning."""

from __future__ import annotations

from homeassistant.config_entries import SOURCE_USER
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.lightcurve.config_flow import slugify_group_id
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


def test_group_ids_are_slugified():
    assert slugify_group_id("Toilet") == "g_toilet"
    assert slugify_group_id("Living Room") == "g_living_room"
    assert slugify_group_id("Kids' Bedroom #2") == "g_kids_bedroom_2"
    assert slugify_group_id("!!!") == "g_group"


async def test_flow_aborts_when_no_area_has_lights(hass):
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "no_areas_with_lights"


async def test_flow_creates_a_group_per_chosen_area(hass):
    toilet = make_area_with_light(hass, "Toilet", "toilet_1")
    make_area_with_light(hass, "Lounge", "lounge_1")

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "user"

    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"areas": [toilet]}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY

    store = LightcurveStore(hass)
    await store.async_load()
    groups = store.groups
    assert list(groups) == ["g_toilet"], "only the chosen area should become a group"
    assert groups["g_toilet"].area_id == toilet
    assert groups["g_toilet"].members == [], "members come from the area, not a copy"


async def test_only_one_instance_is_allowed(hass):
    make_area_with_light(hass, "Toilet", "toilet_1")
    MockConfigEntry(domain=DOMAIN, data={}).add_to_hass(hass)

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"


async def test_adaptive_lighting_on_the_same_bulbs_raises_a_warning_step(hass):
    """The failure this catches cost a whole round of Phase 0 measurements.

    Two integrations adapting one bulb fight: Lightcurve reads the other one's writes
    as manual overrides, so the curve stops within about 90 seconds of a light coming
    on. Warning at setup is far cheaper than diagnosing it weeks later.
    """
    toilet = make_area_with_light(hass, "Toilet", "toilet_1")
    hass.states.async_set(
        "switch.adaptive_lighting_toilet",
        "on",
        {"lights": ["light.toilet_1"]},
    )

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"areas": [toilet]}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "conflict"
    assert "switch.adaptive_lighting_toilet" in result["description_placeholders"][
        "entities"
    ]

    # Acknowledging it continues, because it is a warning and not a veto.
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY


async def test_unrelated_adaptive_lighting_config_does_not_warn(hass):
    """An Adaptive Lighting profile covering other rooms is not a conflict."""
    toilet = make_area_with_light(hass, "Toilet", "toilet_1")
    hass.states.async_set(
        "switch.adaptive_lighting_lounge", "on", {"lights": ["light.somewhere_else"]}
    )

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"areas": [toilet]}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
