"""Storage: defaults, validation and conversion into engine objects."""

from __future__ import annotations

import pytest

from custom_components.lightcurve.const import DEFAULT_PROFILE_ID, SETTINGS_DEFAULTS
from custom_components.lightcurve.store import (
    Group,
    LightcurveStore,
    StoreError,
    keyframe_from_dict,
)


async def test_first_load_seeds_defaults(hass):
    store = LightcurveStore(hass)
    await store.async_load()
    assert store.settings["tick_seconds"] == SETTINGS_DEFAULTS["tick_seconds"]
    assert DEFAULT_PROFILE_ID in store.profiles
    assert store.groups == {}


async def test_missing_settings_are_backfilled_without_a_migration(hass):
    """A store written by an older build must gain new keys on load, not break."""
    store = LightcurveStore(hass)
    await store.async_load()
    del store.settings["kelvin_tolerance"]
    await store.async_save()

    reopened = LightcurveStore(hass)
    await reopened.async_load()
    assert reopened.settings["kelvin_tolerance"] == SETTINGS_DEFAULTS["kelvin_tolerance"]


async def test_using_the_store_before_loading_is_an_error(hass):
    with pytest.raises(StoreError):
        _ = LightcurveStore(hass).settings


async def test_newer_stored_version_is_refused_rather_than_guessed_at(hass):
    store = LightcurveStore(hass)
    await store.async_load()
    store._data["version"] = 99
    await store.async_save()

    with pytest.raises(StoreError, match="downgrade"):
        await LightcurveStore(hass).async_load()


async def test_default_profile_converts_to_engine_keyframes(hass):
    store = LightcurveStore(hass)
    await store.async_load()
    keyframes = store.profile_keyframes(DEFAULT_PROFILE_ID)
    assert len(keyframes) == 6
    modes = {k.colour.mode for k in keyframes}
    assert modes == {"kelvin", "hs"}  # the red night section and the daytime whites


async def test_unknown_variant_falls_back_to_default(hass):
    """A group pointing at a deleted variant should keep working."""
    store = LightcurveStore(hass)
    await store.async_load()
    assert store.profile_keyframes(DEFAULT_PROFILE_ID, "weekend")


async def test_profile_with_too_few_keyframes_is_rejected(hass):
    store = LightcurveStore(hass)
    await store.async_load()
    await store.async_put_profile(
        {
            "id": "p_thin",
            "name": "Thin",
            "variants": {"default": {"keyframes": [
                {"id": "a", "time": {"type": "fixed", "value": "00:00"},
                 "colour": {"mode": "kelvin", "kelvin": 2200}, "brightness": 10},
            ]}},
        }
    )
    with pytest.raises(StoreError, match="at least 2"):
        store.profile_keyframes("p_thin")


def test_bad_keyframe_reports_which_one():
    with pytest.raises(StoreError, match="k_bad"):
        keyframe_from_dict(
            {
                "id": "k_bad",
                "time": {"type": "fixed", "value": "00:00"},
                "colour": {"mode": "kelvin", "kelvin": 99999},
                "brightness": 10,
            }
        )


def test_group_needs_an_area_or_members():
    with pytest.raises(StoreError, match="neither an area nor any members"):
        Group(id="g", name="G")


def test_group_rejects_an_unknown_power_restore_mode():
    with pytest.raises(StoreError, match="power_restore"):
        Group(id="g", name="G", area_id="a", power_restore="explode")


def test_explicit_members_override_an_area():
    group = Group(id="g", name="G", area_id="a", members=["light.x"])
    assert not group.derives_members_from_area
    assert Group(id="g", name="G", area_id="a").derives_members_from_area


async def test_group_referencing_an_unknown_profile_is_refused(hass):
    store = LightcurveStore(hass)
    await store.async_load()
    with pytest.raises(StoreError, match="unknown profile"):
        await store.async_put_group(
            Group(id="g", name="G", members=["light.x"], profile_id="p_nope")
        )


async def test_default_profile_cannot_be_deleted(hass):
    store = LightcurveStore(hass)
    await store.async_load()
    with pytest.raises(StoreError):
        await store.async_delete_profile(DEFAULT_PROFILE_ID)


async def test_profile_in_use_cannot_be_deleted(hass):
    store = LightcurveStore(hass)
    await store.async_load()
    await store.async_put_profile({"id": "p_two", "name": "Two", "variants": {}})
    await store.async_put_group(
        Group(id="g", name="G", members=["light.x"], profile_id="p_two")
    )
    with pytest.raises(StoreError, match="still used by"):
        await store.async_delete_profile("p_two")


async def test_group_round_trips_through_storage(hass):
    store = LightcurveStore(hass)
    await store.async_load()
    original = Group(
        id="g_toilet",
        name="Toilet",
        area_id="toilet",
        override_timeout_minutes=120,
        power_restore="turn_off",
    )
    await store.async_put_group(original)

    reopened = LightcurveStore(hass)
    await reopened.async_load()
    restored = reopened.group("g_toilet")
    assert restored == original
