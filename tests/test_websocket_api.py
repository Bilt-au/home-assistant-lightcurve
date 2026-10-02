"""The WebSocket commands the editor panel runs on."""

from __future__ import annotations

import itertools

import pytest
from freezegun import freeze_time

from custom_components.lightcurve.const import DEFAULT_PROFILE_ID

MORNING_UTC = "2026-09-30 08:00:00"


_IDS = itertools.count(1)


async def call(client, command: dict) -> dict:
    """Send one command and return the whole reply, error or not."""
    await client.send_json({"id": next(_IDS), **command})
    return await client.receive_json()


@pytest.fixture
async def ws(hass, integration, hass_ws_client):
    return await hass_ws_client(hass)


# --------------------------------------------------------------------- profiles


async def test_profiles_list_reports_which_groups_use_each(ws):
    reply = await call(ws, {"type": "lightcurve/profiles/list"})
    assert reply["success"]
    profiles = reply["result"]["profiles"]
    assert [p["id"] for p in profiles] == [DEFAULT_PROFILE_ID]
    # The editor needs this to warn that an edit changes several rooms at once.
    assert profiles[0]["used_by"] == ["g_toilet"]
    assert profiles[0]["variants"] == ["default"]


async def test_profiles_get_returns_the_keyframes(ws):
    reply = await call(
        ws, {"type": "lightcurve/profiles/get", "profile_id": DEFAULT_PROFILE_ID}
    )
    assert reply["success"]
    keyframes = reply["result"]["profile"]["variants"]["default"]["keyframes"]
    assert len(keyframes) == 6
    assert any(k["colour"]["mode"] == "hs" for k in keyframes), "the red night section"


async def test_getting_an_unknown_profile_errors_cleanly(ws):
    reply = await call(ws, {"type": "lightcurve/profiles/get", "profile_id": "nope"})
    assert not reply["success"]
    assert reply["error"]["code"] == "not_found"


async def test_saving_a_profile_persists_it(hass, ws):
    profile = {
        "id": "p_simple",
        "name": "Simple",
        "variants": {
            "default": {
                "keyframes": [
                    {
                        "id": "a",
                        "time": {"type": "fixed", "value": "07:00"},
                        "colour": {"mode": "kelvin", "kelvin": 2700},
                        "brightness": 40,
                        "easing": "linear",
                    },
                    {
                        "id": "b",
                        "time": {"type": "fixed", "value": "19:00"},
                        "colour": {"mode": "kelvin", "kelvin": 2200},
                        "brightness": 10,
                        "easing": "linear",
                    },
                ]
            }
        },
    }
    reply = await call(ws, {"type": "lightcurve/profiles/save", "profile": profile})
    assert reply["success"], reply.get("error")

    listed = await call(ws, {"type": "lightcurve/profiles/list"})
    assert "p_simple" in [p["id"] for p in listed["result"]["profiles"]]


async def test_a_profile_with_one_keyframe_is_refused(ws):
    """Errors block the save; the editor should never be able to store a curve the
    scheduler cannot evaluate."""
    reply = await call(
        ws,
        {
            "type": "lightcurve/profiles/save",
            "profile": {
                "id": "p_thin",
                "name": "Thin",
                "variants": {
                    "default": {
                        "keyframes": [
                            {
                                "id": "a",
                                "time": {"type": "fixed", "value": "07:00"},
                                "colour": {"mode": "kelvin", "kelvin": 2700},
                                "brightness": 40,
                                "easing": "linear",
                            }
                        ]
                    }
                },
            },
        },
    )
    assert not reply["success"]
    assert reply["error"]["code"] == "invalid_profile"


async def test_validate_reports_warnings_without_saving(ws):
    """Warnings must not block: most are seasonal and the user cannot see them yet."""
    reply = await call(
        ws,
        {
            "type": "lightcurve/profiles/validate",
            "profile": {
                "id": "p_warn",
                "name": "Warn",
                "variants": {
                    "default": {
                        "keyframes": [
                            {
                                "id": "white",
                                "time": {"type": "fixed", "value": "08:00"},
                                "colour": {"mode": "kelvin", "kelvin": 2700},
                                "brightness": 40,
                                "easing": "linear",
                            },
                            {
                                "id": "red",
                                "time": {"type": "fixed", "value": "20:00"},
                                "colour": {"mode": "hs", "hs": [0, 100]},
                                "brightness": 3,
                                "easing": "linear",
                            },
                        ]
                    }
                },
            },
        },
    )
    assert reply["success"]
    issues = reply["result"]["issues"]
    assert any(i["code"] == "mode_switch" for i in issues)
    assert all(i["level"] == "warning" for i in issues)

    listed = await call(ws, {"type": "lightcurve/profiles/list"})
    assert "p_warn" not in [p["id"] for p in listed["result"]["profiles"]], (
        "validate must not persist anything"
    )


async def test_the_profile_in_use_cannot_be_deleted(ws):
    reply = await call(
        ws, {"type": "lightcurve/profiles/delete", "profile_id": DEFAULT_PROFILE_ID}
    )
    assert not reply["success"]
    assert reply["error"]["code"] == "cannot_delete"


# ----------------------------------------------------------------------- groups


async def test_groups_list_includes_resolved_members_and_live_state(ws, members):
    reply = await call(ws, {"type": "lightcurve/groups/list"})
    assert reply["success"]
    group = reply["result"]["groups"][0]
    assert group["id"] == "g_toilet"
    assert group["members_resolved"] == members
    assert group["members_available"] == members
    assert group["is_on"] is True
    assert group["target"]["brightness_pct"] is not None


async def test_saving_a_group_with_an_unknown_profile_is_refused(ws):
    reply = await call(
        ws,
        {
            "type": "lightcurve/groups/save",
            "group": {
                "id": "g_new",
                "name": "New",
                "members": ["light.x"],
                "profile_id": "p_nope",
            },
        },
    )
    assert not reply["success"]
    assert reply["error"]["code"] == "invalid_group"


async def test_a_group_with_neither_area_nor_members_is_refused(ws):
    reply = await call(
        ws,
        {"type": "lightcurve/groups/save", "group": {"id": "g_empty", "name": "Empty"}},
    )
    assert not reply["success"]


# ----------------------------------------------------------------- graph feeds


async def test_evaluate_returns_samples_and_resolved_keyframes(ws):
    with freeze_time(MORNING_UTC):
        reply = await call(
            ws,
            {
                "type": "lightcurve/evaluate",
                "profile_id": DEFAULT_PROFILE_ID,
                "step_minutes": 30,
            },
        )
    assert reply["success"], reply.get("error")
    result = reply["result"]
    assert len(result["samples"]) == 48  # a full day at half-hour steps
    assert result["samples"][0]["minute"] == 0
    assert result["samples"][-1]["minute"] == 1410
    # Every sample carries the colour the engine computed, so the gradient strip is
    # not the browser's guess at what 2700 K themes like.
    assert all(s["rgb"] is not None for s in result["samples"])
    assert {k["id"] for k in result["keyframes"]} >= {"k_red_on", "k_noon"}


async def test_evaluate_covers_the_night_section_in_colour(ws):
    with freeze_time(MORNING_UTC):
        reply = await call(
            ws,
            {
                "type": "lightcurve/evaluate",
                "profile_id": DEFAULT_PROFILE_ID,
                "step_minutes": 60,
            },
        )
    samples = {s["minute"]: s for s in reply["result"]["samples"]}
    at_2200 = samples[22 * 60]
    assert at_2200["mode"] == "hs"
    assert at_2200["hs"][0] == pytest.approx(0, abs=1), "22:00 should be red"
    assert at_2200["brightness_pct"] == 3


async def test_sun_returns_every_marker_the_graph_draws(ws):
    with freeze_time(MORNING_UTC):
        reply = await call(ws, {"type": "lightcurve/sun"})
    assert reply["success"]
    events = reply["result"]["events"]
    assert set(events) == {"dawn", "sunrise", "solar_noon", "sunset", "dusk"}
    assert all(e is None or 0 <= e["minute"] < 1440 for e in events.values())


async def test_evaluating_an_unknown_profile_errors(ws):
    reply = await call(ws, {"type": "lightcurve/evaluate", "profile_id": "nope"})
    assert not reply["success"]
    assert reply["error"]["code"] == "not_found"


# --------------------------------------------------------------------- preview


async def test_preview_drives_the_lights_and_stops_the_scheduler(hass, ws):
    from pytest_homeassistant_custom_component.common import async_mock_service

    calls = async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        reply = await call(
            ws,
            {
                "type": "lightcurve/preview/start",
                "group_id": "g_toilet",
                "minute": 22 * 60,
            },
        )
    assert reply["success"], reply.get("error")
    assert reply["result"]["target"]["mode"] == "hs"  # 22:00 is the red section
    assert calls, "preview must actually reach the bulbs"

    coordinator = next(iter(hass.data["lightcurve"].values()))
    assert coordinator.runtime("g_toilet").previewing is True, (
        "the scheduler must stand back while the scrubber is driving"
    )


async def test_stopping_preview_returns_the_group_to_the_curve(hass, ws):
    from pytest_homeassistant_custom_component.common import async_mock_service

    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await call(
            ws,
            {"type": "lightcurve/preview/start", "group_id": "g_toilet", "minute": 60},
        )
        reply = await call(
            ws, {"type": "lightcurve/preview/stop", "group_id": "g_toilet"}
        )
    assert reply["success"]
    coordinator = next(iter(hass.data["lightcurve"].values()))
    assert coordinator.runtime("g_toilet").previewing is False


async def test_preview_on_an_unknown_group_errors(ws):
    reply = await call(
        ws, {"type": "lightcurve/preview/start", "group_id": "nope", "minute": 0}
    )
    assert not reply["success"]
    assert reply["error"]["code"] == "not_found"


# ------------------------------------------------------------------ permissions


async def test_commands_require_an_admin(
    hass, integration, hass_ws_client, hass_read_only_access_token
):
    """Profiles drive real lights, so a read-only user must not be able to edit."""
    client = await hass_ws_client(hass, hass_read_only_access_token)
    reply = await call(client, {"type": "lightcurve/profiles/list"})
    assert not reply["success"]
    assert reply["error"]["code"] == "unauthorized"


# ----------------------------------------------------------------------- themes


async def test_looks_list_says_what_each_one_covers(ws):
    reply = await call(ws, {"type": "lightcurve/themes/list"})
    assert reply["success"]
    themes = {theme["name"]: theme for theme in reply["result"]["themes"]}
    assert set(themes) == {"Mood", "Movie", "Disco"}
    # The seeded themes cover no group explicitly, which means all of them.
    assert themes["Movie"]["covers"] == ["Toilet"]
    assert themes["Disco"]["effect"] == "Party"
    assert themes["Movie"]["holding"] is False


async def test_applying_a_look_reaches_the_lights(hass, ws):
    from pytest_homeassistant_custom_component.common import async_mock_service

    calls = async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        reply = await call(ws, {"type": "lightcurve/themes/apply", "theme_id": "t_movie"})
    assert reply["success"], reply.get("error")
    assert reply["result"]["applied"] == ["g_toilet"]
    assert calls[0].data["brightness_pct"] == 5


async def test_an_applied_look_shows_as_holding(hass, ws):
    from pytest_homeassistant_custom_component.common import async_mock_service

    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await call(ws, {"type": "lightcurve/themes/apply", "theme_id": "t_mood"})
        reply = await call(ws, {"type": "lightcurve/themes/list"})
    holding = {theme["name"]: theme["holding"] for theme in reply["result"]["themes"]}
    assert holding["Mood"] is True


async def test_releasing_hands_the_lights_back_to_the_curve(hass, ws):
    from pytest_homeassistant_custom_component.common import async_mock_service

    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await call(ws, {"type": "lightcurve/themes/apply", "theme_id": "t_mood"})
        reply = await call(ws, {"type": "lightcurve/themes/release"})
    assert reply["success"]
    coordinator = next(iter(hass.data["lightcurve"].values()))
    assert coordinator.runtime("g_toilet").overridden is False


async def test_a_look_that_reaches_nothing_reports_an_error(hass, ws):
    """A button that silently does nothing is worse than one that says why."""
    from pytest_homeassistant_custom_component.common import async_mock_service

    async_mock_service(hass, "light", "turn_on")
    # Disco needs the Party effect, which these test bulbs do not advertise.
    with freeze_time(MORNING_UTC):
        reply = await call(ws, {"type": "lightcurve/themes/apply", "theme_id": "t_disco"})
    assert not reply["success"]
    assert reply["error"]["code"] == "not_applied"
    assert "effect" in reply["error"]["message"]


async def test_applying_an_unknown_look_errors(ws):
    reply = await call(ws, {"type": "lightcurve/themes/apply", "theme_id": "nope"})
    assert not reply["success"]
    assert reply["error"]["code"] == "not_found"


async def test_only_the_applied_look_shows_as_holding(hass, ws):
    """The bug this guards: every theme covering the room lit up as soon as any one
    of them was applied, because "holding" was derived from the override flags
    rather than from which theme was actually showing."""
    from pytest_homeassistant_custom_component.common import async_mock_service

    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await call(ws, {"type": "lightcurve/themes/apply", "theme_id": "t_movie"})
        reply = await call(ws, {"type": "lightcurve/themes/list"})

    holding = {theme["name"]: theme["holding"] for theme in reply["result"]["themes"]}
    assert holding == {"Movie": True, "Mood": False, "Disco": False}


async def test_switching_look_moves_the_highlight(hass, ws):
    from pytest_homeassistant_custom_component.common import async_mock_service

    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await call(ws, {"type": "lightcurve/themes/apply", "theme_id": "t_movie"})
        await call(ws, {"type": "lightcurve/themes/apply", "theme_id": "t_mood"})
        reply = await call(ws, {"type": "lightcurve/themes/list"})

    holding = {theme["name"]: theme["holding"] for theme in reply["result"]["themes"]}
    assert holding["Mood"] is True
    assert holding["Movie"] is False


async def test_a_manual_change_clears_the_highlight(hass, ws):
    """Once someone dims the room by hand, the theme is not what is showing."""
    from pytest_homeassistant_custom_component.common import async_mock_service

    async_mock_service(hass, "light", "turn_on")
    coordinator = next(iter(hass.data["lightcurve"].values()))
    group = coordinator.store.group("g_toilet")

    with freeze_time(MORNING_UTC):
        await call(ws, {"type": "lightcurve/themes/apply", "theme_id": "t_mood"})
        await coordinator.async_turn_on(group, brightness_pct=70)
        reply = await call(ws, {"type": "lightcurve/themes/list"})

    assert all(not theme["holding"] for theme in reply["result"]["themes"])


async def test_releasing_clears_the_highlight(hass, ws):
    from pytest_homeassistant_custom_component.common import async_mock_service

    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        await call(ws, {"type": "lightcurve/themes/apply", "theme_id": "t_mood"})
        await call(ws, {"type": "lightcurve/themes/release"})
        reply = await call(ws, {"type": "lightcurve/themes/list"})
    assert all(not theme["holding"] for theme in reply["result"]["themes"])


async def test_a_custom_theme_can_be_saved_and_applied(hass, ws):
    from pytest_homeassistant_custom_component.common import async_mock_service

    reply = await call(
        ws,
        {
            "type": "lightcurve/themes/save",
            "theme": {
                "id": "t_reading",
                "name": "Reading",
                "mode": "static",
                "colour": {"mode": "hs", "hs": [40, 30]},
                "brightness": 80,
                "groups": ["g_toilet"],
                "hold_minutes": None,
            },
        },
    )
    assert reply["success"], reply.get("error")

    calls = async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        applied = await call(
            ws, {"type": "lightcurve/themes/apply", "theme_id": "t_reading"}
        )
    assert applied["success"]
    assert calls[0].data["hs_color"] == [40, 30]
    assert calls[0].data["brightness_pct"] == 80


async def test_an_unusable_theme_is_refused_at_save_time(ws):
    """Better to refuse it here than to let someone press a button that can never
    work."""
    reply = await call(
        ws,
        {
            "type": "lightcurve/themes/save",
            "theme": {
                "id": "t_broken",
                "name": "Broken",
                "mode": "static",
                "colour": None,
                "brightness": 50,
                "groups": [],
            },
        },
    )
    assert not reply["success"]
    assert reply["error"]["code"] == "invalid_theme"


async def test_deleting_a_theme_releases_the_lights_it_was_holding(hass, ws):
    """Otherwise the room stays held with nothing left to release it but an
    off/on cycle."""
    from pytest_homeassistant_custom_component.common import async_mock_service

    async_mock_service(hass, "light", "turn_on")
    coordinator = next(iter(hass.data["lightcurve"].values()))
    with freeze_time(MORNING_UTC):
        await call(ws, {"type": "lightcurve/themes/apply", "theme_id": "t_mood"})
        assert coordinator.runtime("g_toilet").active_theme == "t_mood"
        reply = await call(
            ws, {"type": "lightcurve/themes/delete", "theme_id": "t_mood"}
        )
    assert reply["success"]
    assert coordinator.runtime("g_toilet").overridden is False

    listed = await call(ws, {"type": "lightcurve/themes/list"})
    assert "Mood" not in {t["name"] for t in listed["result"]["themes"]}


async def test_a_room_can_be_pointed_at_a_different_curve(hass, ws):
    """The bathroom wanting a different day from the lounge is the ordinary case."""
    await call(
        ws,
        {
            "type": "lightcurve/profiles/save",
            "profile": {
                "id": "p_dim",
                "name": "Dim",
                "variants": {
                    "default": {
                        "keyframes": [
                            {
                                "id": "a",
                                "time": {"type": "fixed", "value": "07:00"},
                                "colour": {"mode": "kelvin", "kelvin": 2200},
                                "brightness": 10,
                                "easing": "linear",
                            },
                            {
                                "id": "b",
                                "time": {"type": "fixed", "value": "21:00"},
                                "colour": {"mode": "kelvin", "kelvin": 2200},
                                "brightness": 5,
                                "easing": "linear",
                            },
                        ]
                    }
                },
            },
        },
    )
    reply = await call(
        ws,
        {
            "type": "lightcurve/groups/set_profile",
            "group_id": "g_toilet",
            "profile_id": "p_dim",
        },
    )
    assert reply["success"], reply.get("error")
    assert reply["result"]["group"]["profile_id"] == "p_dim"


async def test_changing_a_rooms_curve_keeps_its_other_settings(hass, ws):
    """Round-tripping a whole group to change one field is how power_restore and the
    override timeout get silently reset."""
    coordinator = next(iter(hass.data["lightcurve"].values()))
    group = coordinator.store.group("g_toilet")
    group.power_restore = "turn_off"
    group.override_timeout_minutes = 120
    await coordinator.store.async_put_group(group)

    await call(
        ws,
        {
            "type": "lightcurve/profiles/save",
            "profile": {
                "id": "p_other",
                "name": "Other",
                "variants": {
                    "default": {
                        "keyframes": [
                            {
                                "id": "a",
                                "time": {"type": "fixed", "value": "07:00"},
                                "colour": {"mode": "kelvin", "kelvin": 2700},
                                "brightness": 40,
                                "easing": "linear",
                            },
                            {
                                "id": "b",
                                "time": {"type": "fixed", "value": "21:00"},
                                "colour": {"mode": "kelvin", "kelvin": 2200},
                                "brightness": 10,
                                "easing": "linear",
                            },
                        ]
                    }
                },
            },
        },
    )
    await call(
        ws,
        {
            "type": "lightcurve/groups/set_profile",
            "group_id": "g_toilet",
            "profile_id": "p_other",
        },
    )

    after = coordinator.store.group("g_toilet")
    assert after.profile_id == "p_other"
    assert after.power_restore == "turn_off"
    assert after.override_timeout_minutes == 120


async def test_pointing_a_room_at_an_unknown_profile_is_refused(ws):
    reply = await call(
        ws,
        {
            "type": "lightcurve/groups/set_profile",
            "group_id": "g_toilet",
            "profile_id": "p_nope",
        },
    )
    assert not reply["success"]
    assert reply["error"]["code"] == "not_found"


async def test_a_theme_holds_even_when_some_rooms_are_unreachable(hass, ws, members):
    """A theme skips rooms whose bulbs are unreachable — a wall switch turned off is
    enough. Requiring every room to have it meant a theme plainly showing in two
    rooms reported itself as not holding, which also disabled the way back."""
    from pytest_homeassistant_custom_component.common import async_mock_service

    coordinator = next(iter(hass.data["lightcurve"].values()))
    from custom_components.lightcurve.store import Group

    await coordinator.store.async_put_group(
        Group(
            id="g_dark", name="Dark room", members=["light.dark_1"],
            profile_id="p_default",
        )
    )
    hass.states.async_set("light.dark_1", "unavailable", {})

    async_mock_service(hass, "light", "turn_on")
    with freeze_time(MORNING_UTC):
        reply = await call(ws, {"type": "lightcurve/themes/apply", "theme_id": "t_mood"})
    assert reply["success"]
    assert "g_dark" not in reply["result"]["applied"]

    listed = await call(ws, {"type": "lightcurve/themes/list"})
    mood = next(t for t in listed["result"]["themes"] if t["name"] == "Mood")
    assert mood["holding"] is True, "it is showing in the reachable room"
    assert mood["holding_in"] == ["Toilet"]
    assert "Dark room" in mood["covers"], "it still covers the room it could not reach"
