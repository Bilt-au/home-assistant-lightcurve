"""End-to-end setup: does the integration load and produce entities?

This is the test that catches import errors, a bad manifest, platform wiring and
service registration — the failures that would otherwise show up as a red card in
the Home Assistant UI with a traceback in the log.
"""

from __future__ import annotations

from homeassistant.helpers import entity_registry as er

from custom_components.lightcurve.const import DEFAULT_PROFILE, DOMAIN


async def test_setup_creates_one_entity_per_platform(hass, integration):
    registry = er.async_get(hass)
    ours = [e for e in registry.entities.values() if e.platform == DOMAIN]
    domains = {entry.domain for entry in ours}
    assert domains == {
        "light",
        "switch",
        "sensor",
        "select",
        "binary_sensor",
        "scene",
    }, f"expected one entity per platform, got {sorted(domains)}"


async def test_the_looks_appear_as_scenes(hass, integration):
    """Scenes are how Siri reaches a theme: HomeKit Bridge exposes scene entities,
    so "Hey Siri, Movie" needs no HomeKit-specific code."""
    registry = er.async_get(hass)
    scenes = {
        entry.entity_id
        for entry in registry.entities.values()
        if entry.platform == DOMAIN and entry.domain == "scene"
    }
    assert len(scenes) == 3, f"expected Mood, Movie and Disco, got {sorted(scenes)}"
    names = {hass.states.get(e).attributes.get("friendly_name") for e in scenes}
    assert names == {"Mood", "Movie", "Disco"}


async def test_setup_registers_the_services(hass, integration):
    for service in ("apply_now", "resume", "pause", "set_profile"):
        assert hass.services.has_service(DOMAIN, service), f"{service} not registered"


async def test_the_editor_panel_is_registered(hass, integration):
    """The panel is optional by design, but with a bundle present it must appear."""
    from homeassistant.components import frontend

    panels = hass.data.get(frontend.DATA_PANELS, {})
    bundle_exists = (
        __import__("pathlib").Path(
            "custom_components/lightcurve/frontend/lightcurve-panel.js"
        ).is_file()
    )
    if bundle_exists:
        assert DOMAIN in panels, "panel should be registered when the bundle exists"
        assert panels[DOMAIN].require_admin is True
    else:
        assert DOMAIN not in panels, (
            "without a built bundle the panel must be skipped, not half-registered"
        )


async def test_the_wrapper_light_reports_the_curve_target(hass, integration, members):
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
    assert state.attributes["members"] == members
    assert state.attributes["profile"] == DEFAULT_PROFILE["name"]


async def test_unload_removes_entities_and_services(hass, integration):
    assert await hass.config_entries.async_unload(integration.entry_id)
    await hass.async_block_till_done()
    assert not hass.services.has_service(DOMAIN, "apply_now")
    assert DOMAIN not in hass.data
