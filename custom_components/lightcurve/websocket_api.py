"""WebSocket commands backing the editor panel.

Everything here is admin-only. The commands are deliberately thin: profile shape is
validated by the engine, persistence by the store, so this layer only translates
between the wire format and those two.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Any

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .coordinator import SUN_EVENTS, LightcurveCoordinator
from .engine import CurveError, resolve_window, sample, validate
from .store import Group, StoreError, Theme, keyframe_from_dict

_LOGGER = logging.getLogger(__name__)

MAX_SAMPLES = 2880  # a full day at 30-second resolution; more is never useful


def async_register(hass: HomeAssistant) -> None:
    for handler in (
        profiles_list,
        profiles_get,
        profiles_save,
        profiles_delete,
        profile_validate,
        groups_list,
        groups_save,
        groups_delete,
        groups_set_profile,
        themes_list,
        themes_apply,
        themes_release,
        themes_save,
        themes_delete,
        evaluate_profile,
        sun_times,
        preview_start,
        preview_stop,
    ):
        websocket_api.async_register_command(hass, handler)


def _signal_themes_changed(hass: HomeAssistant) -> None:
    """Scenes follow themes, so they have to appear and disappear with them rather
    than only at a restart."""
    from homeassistant.helpers.dispatcher import async_dispatcher_send

    from .scene import SIGNAL_THEMES_CHANGED

    async_dispatcher_send(hass, SIGNAL_THEMES_CHANGED)


def _coordinator(hass: HomeAssistant) -> LightcurveCoordinator | None:
    entries = hass.data.get(DOMAIN) or {}
    return next(iter(entries.values()), None)


def _with_coordinator(func):
    """Reject commands that arrive before setup rather than raising KeyError."""

    async def wrapper(hass, connection, msg):
        coordinator = _coordinator(hass)
        if coordinator is None:
            connection.send_error(
                msg["id"], "not_loaded", "Lightcurve is not set up yet"
            )
            return
        await func(hass, connection, msg, coordinator)

    wrapper.__name__ = func.__name__
    return wrapper


def _parse_day(raw: str | None) -> date:
    if not raw:
        return dt_util.now().date()
    return date.fromisoformat(raw)


# --------------------------------------------------------------------- profiles


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "lightcurve/profiles/list"})
@websocket_api.async_response
@_with_coordinator
async def profiles_list(hass, connection, msg, coordinator) -> None:
    profiles = coordinator.store.profiles
    in_use: dict[str, list[str]] = {}
    for group in coordinator.store.groups.values():
        in_use.setdefault(group.profile_id, []).append(group.id)
    connection.send_result(
        msg["id"],
        {
            "profiles": [
                {
                    "id": profile_id,
                    "name": profile.get("name", profile_id),
                    "variants": sorted((profile.get("variants") or {}).keys()),
                    # The panel needs this to explain why a delete is refused, and to
                    # warn that an edit will change several rooms at once.
                    "used_by": in_use.get(profile_id, []),
                }
                for profile_id, profile in sorted(profiles.items())
            ]
        },
    )


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "lightcurve/profiles/get",
        vol.Required("profile_id"): str,
    }
)
@websocket_api.async_response
@_with_coordinator
async def profiles_get(hass, connection, msg, coordinator) -> None:
    try:
        connection.send_result(
            msg["id"], {"profile": coordinator.store.profile(msg["profile_id"])}
        )
    except StoreError as err:
        connection.send_error(msg["id"], "not_found", str(err))


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "lightcurve/profiles/save",
        vol.Required("profile"): dict,
    }
)
@websocket_api.async_response
@_with_coordinator
async def profiles_save(hass, connection, msg, coordinator) -> None:
    """Create or replace a profile, refusing anything the engine calls an error."""
    profile = msg["profile"]
    issues = _validate_profile(hass, coordinator, profile)
    if any(issue["level"] == "error" for issue in issues):
        connection.send_error(
            msg["id"],
            "invalid_profile",
            "; ".join(i["message"] for i in issues if i["level"] == "error"),
        )
        return
    try:
        await coordinator.store.async_put_profile(profile)
    except StoreError as err:
        connection.send_error(msg["id"], "invalid_profile", str(err))
        return
    # A saved profile should reach the lights now, not at the next tick.
    for group in coordinator.groups.values():
        if group.profile_id == profile.get("id") and group.enabled:
            await coordinator.async_apply(group, force=True)
    connection.send_result(msg["id"], {"profile": profile, "issues": issues})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "lightcurve/profiles/delete",
        vol.Required("profile_id"): str,
    }
)
@websocket_api.async_response
@_with_coordinator
async def profiles_delete(hass, connection, msg, coordinator) -> None:
    try:
        await coordinator.store.async_delete_profile(msg["profile_id"])
    except StoreError as err:
        connection.send_error(msg["id"], "cannot_delete", str(err))
        return
    connection.send_result(msg["id"], {})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "lightcurve/profiles/validate",
        vol.Required("profile"): dict,
        vol.Optional("date"): str,
    }
)
@websocket_api.async_response
@_with_coordinator
async def profile_validate(hass, connection, msg, coordinator) -> None:
    """Validate without saving, so the editor can warn while the user types."""
    connection.send_result(
        msg["id"],
        {"issues": _validate_profile(hass, coordinator, msg["profile"], msg.get("date"))},
    )


def _validate_profile(
    hass: HomeAssistant,
    coordinator: LightcurveCoordinator,
    profile: dict[str, Any],
    day: str | None = None,
) -> list[dict[str, Any]]:
    variants = profile.get("variants") or {}
    if not variants:
        return [
            {
                "level": "error",
                "code": "no_variants",
                "message": "A profile needs at least one variant.",
                "keyframe_ids": [],
            }
        ]
    issues: list[dict[str, Any]] = []
    reference = _parse_day(day)
    for name, variant in variants.items():
        try:
            keyframes = [
                keyframe_from_dict(raw) for raw in variant.get("keyframes", [])
            ]
        except StoreError as err:
            issues.append(
                {
                    "level": "error",
                    "code": "bad_keyframe",
                    "message": f"{name}: {err}",
                    "keyframe_ids": [],
                }
            )
            continue
        for issue in validate(
            keyframes, coordinator._sun_lookup(), dt_util.get_default_time_zone(),
            reference,
        ):
            entry = issue.as_dict()
            if len(variants) > 1:
                entry["message"] = f"{name}: {entry['message']}"
            issues.append(entry)
    return issues


# ----------------------------------------------------------------------- groups


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "lightcurve/groups/list"})
@websocket_api.async_response
@_with_coordinator
async def groups_list(hass, connection, msg, coordinator) -> None:
    out = []
    for group in coordinator.groups.values():
        runtime = coordinator.runtime(group.id)
        target = runtime.target
        out.append(
            {
                **group.to_dict(),
                "members_resolved": coordinator.members(group),
                "members_available": coordinator.available_members(group),
                "is_on": coordinator.is_on(group),
                "override_colour": runtime.override_colour,
                "override_brightness": runtime.override_brightness,
                "target": _target_dict(target),
            }
        )
    connection.send_result(msg["id"], {"groups": out})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "lightcurve/groups/save", vol.Required("group"): dict}
)
@websocket_api.async_response
@_with_coordinator
async def groups_save(hass, connection, msg, coordinator) -> None:
    try:
        group = Group.from_dict(msg["group"])
        await coordinator.store.async_put_group(group)
    except StoreError as err:
        connection.send_error(msg["id"], "invalid_group", str(err))
        return
    await coordinator.async_apply(group, force=True)
    connection.send_result(msg["id"], {"group": group.to_dict()})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "lightcurve/groups/set_profile",
        vol.Required("group_id"): str,
        vol.Required("profile_id"): str,
    }
)
@websocket_api.async_response
@_with_coordinator
async def groups_set_profile(hass, connection, msg, coordinator) -> None:
    """Point one room at a different curve.

    Narrow on purpose. Round-tripping a whole group through groups/save to change
    one field invites the caller to omit the rest — power_restore, the sleep values,
    the override timeout — and silently reset them.
    """
    try:
        group = coordinator.store.group(msg["group_id"])
    except StoreError as err:
        connection.send_error(msg["id"], "not_found", str(err))
        return
    if msg["profile_id"] not in coordinator.store.profiles:
        connection.send_error(
            msg["id"], "not_found", f"no such profile {msg['profile_id']!r}"
        )
        return

    group.profile_id = msg["profile_id"]
    await coordinator.store.async_put_group(group)
    # Switching curve should be visible now, and it invalidates any override, which
    # was against the old curve.
    await coordinator.async_resume(group)
    connection.send_result(msg["id"], {"group": group.to_dict()})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "lightcurve/groups/delete", vol.Required("group_id"): str}
)
@websocket_api.async_response
@_with_coordinator
async def groups_delete(hass, connection, msg, coordinator) -> None:
    await coordinator.store.async_delete_group(msg["group_id"])
    connection.send_result(msg["id"], {})


# ------------------------------------------------------------------------ themes


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "lightcurve/themes/list"})
@websocket_api.async_response
@_with_coordinator
async def themes_list(hass, connection, msg, coordinator) -> None:
    """Themes, with enough detail for the panel to render a button that explains
    itself: what it will do, and where."""
    names = {group_id: group.name for group_id, group in coordinator.groups.items()}
    out = []
    for theme in coordinator.store.themes.values():
        covered = theme.groups or list(names)
        out.append(
            {
                **theme.to_dict(),
                "covers": [names.get(g, g) for g in covered],
                # Which theme is showing, not merely whether something is. Deriving
                # this from the override flags lit up every theme that covered the
                # room as soon as any one of them was applied.
                "holding": bool(covered)
                and all(
                    coordinator.runtime(g).active_theme == theme.id
                    for g in covered
                    if g in names
                ),
            }
        )
    connection.send_result(msg["id"], {"themes": out})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "lightcurve/themes/apply",
        vol.Required("theme_id"): str,
        # Narrows a theme to part of its usual reach for this activation only.
        vol.Optional("group_ids"): [str],
    }
)
@websocket_api.async_response
@_with_coordinator
async def themes_apply(hass, connection, msg, coordinator) -> None:
    try:
        theme = coordinator.store.theme(msg["theme_id"])
    except StoreError as err:
        connection.send_error(msg["id"], "not_found", str(err))
        return
    applied = await coordinator.async_apply_theme(theme, msg.get("group_ids"))
    if not applied:
        # Reporting success here would leave the user tapping a button that does
        # nothing, with no clue why.
        connection.send_error(
            msg["id"],
            "not_applied",
            f"{theme.name} reached no lights. Check the rooms it covers are"
            " available"
            + (
                f" and that their bulbs offer the {theme.effect!r} effect"
                if theme.effect
                else ""
            ),
        )
        return
    connection.send_result(msg["id"], {"applied": applied})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "lightcurve/themes/release",
        vol.Optional("group_id"): str,
    }
)
@websocket_api.async_response
@_with_coordinator
async def themes_release(hass, connection, msg, coordinator) -> None:
    """Hand the lights back to the curve without switching them off and on."""
    group_id = msg.get("group_id")
    targets = (
        [coordinator.store.group(group_id)]
        if group_id
        else list(coordinator.groups.values())
    )
    for group in targets:
        await coordinator.async_resume(group)
    connection.send_result(msg["id"], {"released": [g.id for g in targets]})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "lightcurve/themes/save", vol.Required("theme"): dict}
)
@websocket_api.async_response
@_with_coordinator
async def themes_save(hass, connection, msg, coordinator) -> None:
    """Create or replace a theme.

    Validation lives in the Theme model, so a theme that cannot be applied — a
    static one with no colour, an effect one with no effect name — is refused here
    rather than failing silently the first time someone presses its button.
    """
    try:
        theme = Theme.from_dict(msg["theme"])
        await coordinator.store.async_put_theme(theme)
    except StoreError as err:
        connection.send_error(msg["id"], "invalid_theme", str(err))
        return
    _signal_themes_changed(hass)
    connection.send_result(msg["id"], {"theme": theme.to_dict()})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "lightcurve/themes/delete", vol.Required("theme_id"): str}
)
@websocket_api.async_response
@_with_coordinator
async def themes_delete(hass, connection, msg, coordinator) -> None:
    theme_id = msg["theme_id"]
    # A theme currently on the lights would otherwise leave them held with nothing
    # to release them but an off/on cycle.
    for group_id, runtime in coordinator.runtime_states.items():
        if runtime.active_theme == theme_id:
            await coordinator.async_resume(coordinator.store.group(group_id))
    await coordinator.store.async_delete_theme(theme_id)
    _signal_themes_changed(hass)
    connection.send_result(msg["id"], {})


# -------------------------------------------------------------- graph and sun


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "lightcurve/evaluate",
        vol.Required("profile_id"): str,
        vol.Optional("variant", default="default"): str,
        vol.Optional("date"): str,
        vol.Optional("step_minutes", default=5): vol.All(int, vol.Range(min=1, max=180)),
    }
)
@websocket_api.async_response
@_with_coordinator
async def evaluate_profile(hass, connection, msg, coordinator) -> None:
    """Sampled targets across one day: this is what draws the graph."""
    try:
        keyframes = coordinator.store.profile_keyframes(
            msg["profile_id"], msg["variant"]
        )
    except StoreError as err:
        connection.send_error(msg["id"], "not_found", str(err))
        return

    tz = dt_util.get_default_time_zone()
    day = _parse_day(msg.get("date"))
    start = datetime.combine(day, datetime.min.time(), tzinfo=tz)
    end = start + timedelta(days=1)
    try:
        resolved = resolve_window(keyframes, day, coordinator._sun_lookup(), tz)
        targets = sample(resolved, start, end, msg["step_minutes"])
    except CurveError as err:
        connection.send_error(msg["id"], "invalid_profile", str(err))
        return

    connection.send_result(
        msg["id"],
        {
            "date": day.isoformat(),
            "samples": [
                {
                    "at": target.evaluated_at.isoformat(),
                    "minute": int(
                        (target.evaluated_at - start).total_seconds() // 60
                    ),
                    **_target_dict(target),
                }
                for target in targets[:MAX_SAMPLES]
            ],
            "keyframes": [
                {
                    "id": keyframe.id,
                    "at": keyframe.at.isoformat(),
                    "minute": int((keyframe.at - start).total_seconds() // 60),
                    "brightness_pct": keyframe.brightness_pct,
                    "mode": keyframe.colour.mode,
                    "kelvin": keyframe.colour.kelvin,
                    "hs": list(keyframe.colour.hs) if keyframe.colour.hs else None,
                    "easing": keyframe.easing,
                }
                for keyframe in resolved
                if start <= keyframe.at < end
            ],
        },
    )


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "lightcurve/sun", vol.Optional("date"): str}
)
@websocket_api.async_response
@_with_coordinator
async def sun_times(hass, connection, msg, coordinator) -> None:
    """Sun event markers for the graph's x axis."""
    tz = dt_util.get_default_time_zone()
    day = _parse_day(msg.get("date"))
    start = datetime.combine(day, datetime.min.time(), tzinfo=tz)
    lookup = coordinator._sun_lookup()
    events = {}
    for name in SUN_EVENTS:
        when = lookup(day, name)
        events[name] = (
            {
                "at": when.isoformat(),
                "minute": int((when - start).total_seconds() // 60),
            }
            if when
            else None
        )
    connection.send_result(msg["id"], {"date": day.isoformat(), "events": events})


# ---------------------------------------------------------------------- preview


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "lightcurve/preview/start",
        vol.Required("group_id"): str,
        vol.Required("minute"): vol.All(int, vol.Range(min=0, max=1439)),
        vol.Optional("profile_id"): str,
        vol.Optional("variant", default="default"): str,
    }
)
@websocket_api.async_response
@_with_coordinator
async def preview_start(hass, connection, msg, coordinator) -> None:
    """Show a given time of day on real bulbs.

    Deliberately bypasses the rate limiter: the scrubber is a direct manipulation and
    has to keep up with a finger, where the limiter exists to stop a background
    scheduler stacking commands.
    """
    try:
        group = coordinator.store.group(msg["group_id"])
        profile_id = msg.get("profile_id") or group.profile_id
        keyframes = coordinator.store.profile_keyframes(profile_id, msg["variant"])
    except StoreError as err:
        connection.send_error(msg["id"], "not_found", str(err))
        return

    tz = dt_util.get_default_time_zone()
    day = dt_util.now().date()
    moment = datetime.combine(day, datetime.min.time(), tzinfo=tz) + timedelta(
        minutes=msg["minute"]
    )
    try:
        resolved = resolve_window(keyframes, day, coordinator._sun_lookup(), tz)
        target = coordinator.clamp_for(group, resolved, moment)
    except CurveError as err:
        connection.send_error(msg["id"], "invalid_profile", str(err))
        return

    await coordinator.async_preview(group, target)
    connection.send_result(msg["id"], {"target": _target_dict(target)})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "lightcurve/preview/stop", vol.Required("group_id"): str}
)
@websocket_api.async_response
@_with_coordinator
async def preview_stop(hass, connection, msg, coordinator) -> None:
    """Put the group back on the curve after previewing."""
    try:
        group = coordinator.store.group(msg["group_id"])
    except StoreError as err:
        connection.send_error(msg["id"], "not_found", str(err))
        return
    await coordinator.async_end_preview(group)
    connection.send_result(msg["id"], {})


@callback
def _target_dict(target) -> dict[str, Any]:
    if target is None:
        return {
            "mode": None,
            "kelvin": None,
            "hs": None,
            "brightness_pct": None,
            "rgb": None,
        }
    from .engine import Colour, colour_to_rgb

    colour = (
        Colour.from_kelvin(target.kelvin)
        if target.mode == "kelvin"
        else Colour.from_hs(*target.hs)
    )
    return {
        "mode": target.mode,
        "kelvin": target.kelvin,
        "hs": list(target.hs) if target.hs else None,
        "brightness_pct": target.brightness_pct,
        # The panel draws the gradient strip from this, so the colour it shows is the
        # colour the engine computed rather than one the browser guesses at.
        "rgb": [round(c) for c in colour_to_rgb(colour)],
    }
