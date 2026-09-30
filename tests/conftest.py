"""Shared fixtures for the Home Assistant integration tests."""

from __future__ import annotations

import pytest

pytest_plugins = "pytest_homeassistant_custom_component"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Without this, HA refuses to load anything from custom_components."""
    yield


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
