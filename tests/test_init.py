"""End-to-end setup: does the integration load and produce entities?

This is the test that catches import errors, a bad manifest, platform wiring and
service registration — the failures that would otherwise show up as a red card in
the Home Assistant UI with a traceback in the log.
"""

from __future__ import annotations

import pytest
from freezegun import freeze_time
from homeassistant.config_entries import ConfigEntryState
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.lightcurve.const import (
    DEFAULT_PROFILE,
    DEFAULT_PROFILE_ID,
    DOMAIN,
    SETTINGS_DEFAULTS,
    STORAGE_KEY,
)

MEMBERS = ["light.toilet_1", "light.toilet_2"]


def seed_storage(hass_storage, **group_overrides) -> None:
    group = {
        "id": "g_toilet",
        "name": "Toilet",
        "profile_id": DEFAULT_PROFILE_ID,
        "area_id": None,
        "members": list(MEMBERS),
        "variant_schedule": "default",
        "sleep": None,
        "override_timeout_minutes": None,
        "power_restore": "apply_curve",
        "enabled": True,
        **group_overrides,
    }
    hass_storage[STORAGE_KEY] = {
        "version": 1,
        "key": STORAGE_KEY,
        "data": {
            "version": 1,
            "settings": dict(SETTINGS_DEFAULTS),
            "profiles": {DEFAULT_PROFILE_ID: DEFAULT_PROFILE},
            "groups": {"g_toilet": group},
        },
    }


async def setup_integration(hass, hass_storage, member_attributes) -> MockConfigEntry:
    await hass.config.async_set_time_zone("Africa/Johannesburg")
    await hass.config.async_update(latitude=-29.8587, longitude=31.0218)
    for entity_id in MEMBERS:
        hass.states.async_set(entity_id, "on", dict(member_attributes))
    seed_storage(hass_storage)

    entry = MockConfigEntry(domain=DOMAIN, data={}, title="Lightcurve")
    entry.add_to_hass(hass)
    with freeze_time("2026-09-30 08:00:00"):
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
    return entry


@pytest.fixture
async def integration(hass, hass_storage, member_attributes):
    """Set up the entry and always unload it, so cleanup is exercised every test."""
    entry = await setup_integration(hass, hass_storage, member_attributes)
    yield entry
    if entry.state is ConfigEntryState.LOADED:
        await hass.config_entries.async_unload(entry.entry_id)
        await hass.async_block_till_done()


async def test_setup_creates_one_entity_per_platform(hass, integration):
    registry = er.async_get(hass)
    ours = [
        entry
        for entry in registry.entities.values()
        if entry.platform == DOMAIN
    ]
    domains = {entry.domain for entry in ours}
    assert domains == {"light", "switch", "sensor", "select", "binary_sensor"}, (
        f"expected one entity per platform, got {sorted(domains)}"
    )


async def test_setup_registers_the_services(hass, integration):
    for service in ("apply_now", "resume", "pause", "set_profile"):
        assert hass.services.has_service(DOMAIN, service), f"{service} not registered"


async def test_the_wrapper_light_reports_the_curve_target(hass, integration):
    registry = er.async_get(hass)
    light_entity = next(
        entry.entity_id
        for entry in registry.entities.values()
        if entry.platform == DOMAIN and entry.domain == "light"
    )
    state = hass.states.get(light_entity)
    assert state is not None
    assert state.state == "on"  # a member is on
    assert state.attributes["target_brightness_pct"] is not None
    assert state.attributes["members"] == MEMBERS
    assert state.attributes["profile"] == DEFAULT_PROFILE["name"]


async def test_unload_removes_entities_and_services(hass, integration):
    assert await hass.config_entries.async_unload(integration.entry_id)
    await hass.async_block_till_done()
    assert not hass.services.has_service(DOMAIN, "apply_now")
    assert DOMAIN not in hass.data
