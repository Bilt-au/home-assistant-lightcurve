"""Service registration.

Services take a group, a wrapper light entity, or an area, so they work from the UI
and from YAML without the caller needing to know Lightcurve's internal group ids.
"""

from __future__ import annotations

import logging

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er

from .const import (
    CHANNELS,
    DOMAIN,
    SERVICE_APPLY_NOW,
    SERVICE_PAUSE,
    SERVICE_RESUME,
    SERVICE_SET_PROFILE,
)
from .coordinator import LightcurveCoordinator
from .store import Group

_LOGGER = logging.getLogger(__name__)

TARGET_SCHEMA = {
    vol.Optional("group_id"): cv.string,
    vol.Optional("entity_id"): cv.entity_ids,
    vol.Optional("area_id"): cv.string,
}

APPLY_NOW_SCHEMA = vol.Schema(TARGET_SCHEMA)
RESUME_SCHEMA = vol.Schema(TARGET_SCHEMA)
PAUSE_SCHEMA = vol.Schema(
    {
        **TARGET_SCHEMA,
        vol.Optional("duration_minutes"): vol.All(int, vol.Range(min=1)),
        vol.Optional("channels", default=CHANNELS): vol.All(
            cv.ensure_list, [vol.In(CHANNELS)]
        ),
    }
)
SET_PROFILE_SCHEMA = vol.Schema(
    {**TARGET_SCHEMA, vol.Required("profile_id"): cv.string}
)


def _resolve(coordinator: LightcurveCoordinator, call: ServiceCall) -> list[Group]:
    """Work out which groups a call refers to.

    An `entity_id` target is resolved through the entity registry, matching on the
    unique_id this integration assigned. The tempting alternative — checking whether
    a group's name appears in the entity id — mis-targets badly: a group called
    "Bath" would match `light.bathroom_ceiling`, and a service aimed at one room
    would quietly act on another.

    With no target at all the call applies to every group, which is the useful
    default for `apply_now` and `resume`.
    """
    groups = coordinator.groups
    group_id = call.data.get("group_id")
    if group_id:
        if group_id not in groups:
            _LOGGER.warning("no such Lightcurve group %r", group_id)
            return []
        return [groups[group_id]]

    area_id = call.data.get("area_id")
    if area_id:
        return [g for g in groups.values() if g.area_id == area_id]

    entity_ids = call.data.get("entity_id") or []
    if not entity_ids:
        return list(groups.values())

    wanted = set(entity_ids)
    registry = er.async_get(coordinator.hass)
    owned: set[str] = set()
    for entity_id in wanted:
        entry = registry.async_get(entity_id)
        if entry is None or entry.platform != DOMAIN:
            continue
        for group in groups.values():
            # The trailing underscore matters: it stops group "g_bath" claiming an
            # entity belonging to "g_bathroom".
            if entry.unique_id.startswith(f"{DOMAIN}_{group.id}_"):
                owned.add(group.id)

    matched = [
        group
        for group in groups.values()
        if group.id in owned or set(coordinator.members(group)) & wanted
    ]
    if not matched:
        _LOGGER.warning(
            "no Lightcurve group owns or contains %s", ", ".join(sorted(wanted))
        )
    return matched


def async_register_services(
    hass: HomeAssistant, coordinator: LightcurveCoordinator
) -> None:
    async def apply_now(call: ServiceCall) -> None:
        for group in _resolve(coordinator, call):
            await coordinator.async_apply(group, force=True)

    async def resume(call: ServiceCall) -> None:
        for group in _resolve(coordinator, call):
            await coordinator.async_resume(group)

    async def pause(call: ServiceCall) -> None:
        channels = call.data.get("channels") or CHANNELS
        duration = call.data.get("duration_minutes")
        for group in _resolve(coordinator, call):
            await coordinator.async_pause(group, list(channels), duration)

    async def set_profile(call: ServiceCall) -> None:
        profile_id = call.data["profile_id"]
        if profile_id not in coordinator.store.profiles:
            _LOGGER.warning("set_profile: no such profile %r", profile_id)
            return
        for group in _resolve(coordinator, call):
            group.profile_id = profile_id
            await coordinator.store.async_put_group(group)
            await coordinator.async_resume(group)

    hass.services.async_register(DOMAIN, SERVICE_APPLY_NOW, apply_now, APPLY_NOW_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_RESUME, resume, RESUME_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_PAUSE, pause, PAUSE_SCHEMA)
    hass.services.async_register(
        DOMAIN, SERVICE_SET_PROFILE, set_profile, SET_PROFILE_SCHEMA
    )


def async_unregister_services(hass: HomeAssistant) -> None:
    for service in (
        SERVICE_APPLY_NOW,
        SERVICE_RESUME,
        SERVICE_PAUSE,
        SERVICE_SET_PROFILE,
    ):
        hass.services.async_remove(DOMAIN, service)
