"""Themes: named settings held against the curve, reachable from HomeKit as scenes."""

from __future__ import annotations

import pytest
from freezegun import freeze_time
from pytest_homeassistant_custom_component.common import async_mock_service

from custom_components.lightcurve.const import (
    DEFAULT_PROFILE_ID,
    THEME_MODE_EFFECT,
    THEME_MODE_STATIC,
)
from custom_components.lightcurve.coordinator import LightcurveCoordinator
from custom_components.lightcurve.store import Group, LightcurveStore, StoreError, Theme

MEMBERS = ["light.toilet_1", "light.toilet_2"]
MORNING_UTC = "2026-09-30 08:00:00"


async def build(hass, member_attributes, effects=("Off", "Party", "Relax")):
    await hass.config.async_set_time_zone("Africa/Johannesburg")
    await hass.config.async_update(latitude=-29.8587, longitude=31.0218)
    attributes = dict(member_attributes)
    if effects is not None:
        attributes["effect_list"] = list(effects)
        attributes["effect"] = "off"
    for entity_id in MEMBERS:
        hass.states.async_set(entity_id, "on", attributes)

    store = LightcurveStore(hass)
    await store.async_load()
    group = Group(
        id="g_toilet", name="Toilet", members=list(MEMBERS), profile_id=DEFAULT_PROFILE_ID
    )
    await store.async_put_group(group)
    return LightcurveCoordinator(hass, store), group, store


# ------------------------------------------------------------------ the model


def test_a_static_look_needs_a_colour_and_a_brightness():
    with pytest.raises(StoreError):
        Theme(id="l", name="L", mode=THEME_MODE_STATIC, brightness=None)
    with pytest.raises(StoreError, match="colour"):
        Theme(id="l", name="L", mode=THEME_MODE_STATIC, brightness=40)


def test_an_effect_look_needs_an_effect_name():
    with pytest.raises(StoreError, match="effect"):
        Theme(id="l", name="L", mode=THEME_MODE_EFFECT)


def test_an_unknown_mode_is_refused():
    with pytest.raises(StoreError, match="mode"):
        Theme(id="l", name="L", mode="strobe")


async def test_the_default_looks_are_seeded(hass):
    store = LightcurveStore(hass)
    await store.async_load()
    themes = store.themes
    assert {theme.name for theme in themes.values()} == {"Mood", "Movie", "Disco"}
    assert themes["t_disco"].mode == THEME_MODE_EFFECT
    assert themes["t_disco"].effect == "Party"


async def test_looks_are_seeded_into_a_store_that_predates_them(hass, hass_storage):
    """Anyone who installed before themes existed must still get them."""
    from custom_components.lightcurve.const import (
        DEFAULT_PROFILE,
        SETTINGS_DEFAULTS,
        STORAGE_KEY,
    )

    hass_storage[STORAGE_KEY] = {
        "version": 1,
        "key": STORAGE_KEY,
        "data": {
            "version": 1,
            "settings": dict(SETTINGS_DEFAULTS),
            "profiles": {DEFAULT_PROFILE_ID: DEFAULT_PROFILE},
            "groups": {},
        },
    }
    store = LightcurveStore(hass)
    await store.async_load()
    assert len(store.themes) == 3


async def test_a_look_cannot_reference_an_unknown_group(hass):
    store = LightcurveStore(hass)
    await store.async_load()
    with pytest.raises(StoreError, match="unknown groups"):
        await store.async_put_theme(
            Theme(
                id="l_x",
                name="X",
                brightness=50,
                colour={"mode": "kelvin", "kelvin": 3000},
                groups=["g_nope"],
            )
        )


# ------------------------------------------------------------------- applying


async def test_a_static_look_sets_its_values(hass, member_attributes):
    coordinator, group, _ = await build(hass, member_attributes)
    calls = async_mock_service(hass, "light", "turn_on")
    theme = Theme(
        id="t_movie",
        name="Movie",
        brightness=5,
        colour={"mode": "kelvin", "kelvin": 2200},
        groups=[group.id],
    )

    with freeze_time(MORNING_UTC):
        applied = await coordinator.async_apply_theme(theme)

    assert applied == [group.id]
    assert calls
    assert calls[0].data["brightness_pct"] == 5
    assert calls[0].data["color_temp_kelvin"] == 2200


async def test_a_look_holds_against_the_curve(hass, member_attributes):
    """Without both overrides the next tick would put the curve straight back, and
    Movie mode would last about a minute."""
    coordinator, group, _ = await build(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    theme = Theme(
        id="t_movie",
        name="Movie",
        brightness=5,
        colour={"mode": "kelvin", "kelvin": 2200},
        groups=[group.id],
    )

    with freeze_time(MORNING_UTC):
        await coordinator.async_apply_theme(theme)

    runtime = coordinator.runtime(group.id)
    assert runtime.override_colour is True
    assert runtime.override_brightness is True

    calls = async_mock_service(hass, "light", "turn_on")
    with freeze_time("2026-09-30 09:00:00"):
        await coordinator.async_apply(group)
    assert calls == [], "the curve must not overwrite a theme"


async def test_turning_the_room_off_and_on_releases_the_look(hass, member_attributes):
    """A theme needs no explicit exit: cycling the room is the release."""
    coordinator, group, _ = await build(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    async_mock_service(hass, "light", "turn_off")
    theme = Theme(
        id="t_mood",
        name="Mood",
        brightness=25,
        colour={"mode": "kelvin", "kelvin": 2200},
        groups=[group.id],
    )
    with freeze_time(MORNING_UTC):
        await coordinator.async_apply_theme(theme)
        await coordinator.async_turn_off(group)

    assert coordinator.runtime(group.id).overridden is False


async def test_an_effect_look_sends_the_effect(hass, member_attributes):
    """Disco runs on the bulb. At ~640 ms per command an HA-side loop would manage
    about one colour change a second, which is not disco."""
    coordinator, group, _ = await build(hass, member_attributes)
    calls = async_mock_service(hass, "light", "turn_on")
    theme = Theme(
        id="t_disco", name="Disco", mode=THEME_MODE_EFFECT, effect="Party",
        groups=[group.id],
    )

    with freeze_time(MORNING_UTC):
        applied = await coordinator.async_apply_theme(theme)

    assert applied == [group.id]
    assert calls[0].data["effect"] == "Party"
    assert "brightness_pct" not in calls[0].data


async def test_an_effect_the_bulbs_do_not_have_is_skipped(hass, member_attributes):
    """Effect names are device-specific. Sending one a bulb rejects would make the
    whole theme appear broken because of a single member."""
    coordinator, group, _ = await build(hass, member_attributes, effects=("Off", "Relax"))
    calls = async_mock_service(hass, "light", "turn_on")
    theme = Theme(
        id="t_disco", name="Disco", mode=THEME_MODE_EFFECT, effect="Party",
        groups=[group.id],
    )

    with freeze_time(MORNING_UTC):
        applied = await coordinator.async_apply_theme(theme)

    assert applied == [], "a theme that cannot run should report doing nothing"
    assert calls == []


async def test_a_look_with_no_groups_covers_them_all(hass, member_attributes):
    coordinator, group, _ = await build(hass, member_attributes)
    calls = async_mock_service(hass, "light", "turn_on")
    theme = Theme(
        id="l_all", name="All", brightness=40,
        colour={"mode": "kelvin", "kelvin": 3000}, groups=[],
    )

    with freeze_time(MORNING_UTC):
        applied = await coordinator.async_apply_theme(theme)

    assert applied == [group.id]
    assert calls


async def test_a_hold_timeout_sets_a_deadline(hass, member_attributes):
    coordinator, group, _ = await build(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    theme = Theme(
        id="l_t", name="Timed", brightness=40,
        colour={"mode": "kelvin", "kelvin": 3000}, groups=[group.id],
        hold_minutes=90,
    )
    with freeze_time(MORNING_UTC):
        await coordinator.async_apply_theme(theme)
    assert coordinator.runtime(group.id).override_until is not None


async def test_a_look_naming_a_missing_group_does_not_break_the_rest(
    hass, member_attributes
):
    coordinator, group, _ = await build(hass, member_attributes)
    async_mock_service(hass, "light", "turn_on")
    theme = Theme(
        id="l_x", name="X", brightness=30,
        colour={"mode": "kelvin", "kelvin": 3000},
        groups=["g_gone", group.id],
    )
    with freeze_time(MORNING_UTC):
        applied = await coordinator.async_apply_theme(theme)
    assert applied == [group.id]


# --------------------------------------------------------------- scene entity


async def test_activating_the_scene_applies_the_look(hass, integration):
    calls = async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await hass.services.async_call(
            "scene", "turn_on", {"entity_id": "scene.movie"}, blocking=True
        )
    assert calls, "activating the scene should reach the bulbs"
    assert calls[0].data["brightness_pct"] == 5


async def test_the_scene_is_named_exactly_the_look(hass, integration):
    """Siri matches on the friendly name, so "Movie" must be "Movie" and not
    "Lightcurve themes Movie"."""
    state = hass.states.get("scene.movie")
    assert state is not None
    assert state.attributes["friendly_name"] == "Movie"
