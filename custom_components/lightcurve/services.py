"""Service registration.

Services take a group, a wrapper light entity, or an area, so they work from the UI
and from YAML without the caller needing to know Lightcurve's internal group ids.
"""

from __future__ import annotations

import logging

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv

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

    With no target at all the call applies to every group, which is the useful
    default for `apply_now` and `resume`.
    """
    groups = coordinator.groups
    group_id = call.data.get("group_id")
    if group_id:
        return [groups[group_id]] if group_id in groups else []

    area_id = call.data.get("area_id")
    if area_id:
        return [g for g in groups.values() if g.area_id == area_id]

    entity_ids = call.data.get("entity_id") or []
    if entity_ids:
        wanted = set(entity_ids)
        matched = []
        for group in groups.values():
            # Either the wrapper light itself, or one of the member bulbs.
            unique = f"{DOMAIN}_{group.id}_light"
            members = set(coordinator.members(group))
            if members & wanted or any(unique in entity for entity in wanted):
                matched.append(group)
        if matched:
            return matched
        # Fall back to matching on the group name appearing in the entity id, which
        # covers the common `light.<group>_curve` spelling.
        return [
            group
            for group in groups.values()
            if any(group.id in entity or group.name.lower().replace(" ", "_") in entity
                   for entity in wanted)
        ]

    return list(groups.values())


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
