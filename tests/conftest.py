"""Shared fixtures for the Home Assistant integration tests."""

from __future__ import annotations

import pytest
from freezegun import freeze_time
from homeassistant.config_entries import ConfigEntryState
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.lightcurve.const import (
    DEFAULT_PROFILE,
    DEFAULT_PROFILE_ID,
    DOMAIN,
    SETTINGS_DEFAULTS,
    STORAGE_KEY,
)

pytest_plugins = "pytest_homeassistant_custom_component"

MEMBERS = ["light.toilet_1", "light.toilet_2"]

# Local 10:00 in Africa/Johannesburg: inside the morning->noon segment, so the target
# is a colour temperature rather than the red night section.
MORNING_UTC = "2026-09-30 08:00:00"
# Local 22:00: inside the red section.
NIGHT_UTC = "2026-09-30 20:00:00"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Without this, HA refuses to load anything from custom_components."""
    yield


@pytest.fixture
def members() -> list[str]:
    """The member lights the fixtures create. A fixture rather than an import,
    because tests/ is not a package and conftest is not importable by name."""
    return list(MEMBERS)


@pytest.fixture
def member_attributes() -> dict:
    """Attributes matching a real Tapo L630, as measured in Phase 0."""
    return {
        "supported_color_modes": ["color_temp", "hs"],
        "min_color_temp_kelvin": 2200,
        "max_color_temp_kelvin": 6500,
        "supported_features": 36,
        "color_mode": "color_temp",
        "color_temp_kelvin": 3000,
        "brightness": 128,
        "friendly_name": "Member",
    }


def seed_storage(hass_storage, **group_overrides) -> None:
    """Put one group and the default profile into storage before setup."""
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


async def async_setup_integration(hass, hass_storage, member_attributes):
    """Coordinates and timezone must agree; see test_coordinator for why."""
    await hass.config.async_set_time_zone("Africa/Johannesburg")
    await hass.config.async_update(latitude=-29.8587, longitude=31.0218)
    for entity_id in MEMBERS:
        hass.states.async_set(entity_id, "on", dict(member_attributes))
    seed_storage(hass_storage)

    entry = MockConfigEntry(domain=DOMAIN, data={}, title="Lightcurve")
    entry.add_to_hass(hass)
    with freeze_time(MORNING_UTC):
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
    return entry


@pytest.fixture
async def integration(hass, hass_storage, member_attributes):
    """A fully set up integration, always unloaded afterwards."""
    entry = await async_setup_integration(hass, hass_storage, member_attributes)
    yield entry
    if entry.state is ConfigEntryState.LOADED:
        await hass.config_entries.async_unload(entry.entry_id)
        await hass.async_block_till_done()
