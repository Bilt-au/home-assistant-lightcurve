"""Config and options flow.

Groups are created from Home Assistant areas, so setup is a matter of ticking the
rooms you want rather than listing entity ids. The Adaptive Lighting check is not
decoration: Phase 0 lost a full round of measurements to another integration writing
to the same bulbs, and in normal operation those writes each raise an override and
stop the curve. Catching it here is much cheaper than diagnosing it later.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import selector

from .const import (
    DEFAULT_PROFILE_ID,
    DOMAIN,
)
from .coordinator import members_for_area
from .store import Group, LightcurveStore

_LOGGER = logging.getLogger(__name__)

CONF_AREAS = "areas"
CONF_POWER_RESTORE = "power_restore"


def slugify_group_id(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return f"g_{slug or 'group'}"


def find_conflicting_integrations(hass: HomeAssistant, members: set[str]) -> list[str]:
    """Other integrations that are adapting the same bulbs.

    Only Adaptive Lighting is detected by name, because it is the one that overlaps
    functionally and the one almost everyone has tried first. Its switches carry the
    lights they manage in attributes.
    """
    conflicts: list[str] = []
    for state in hass.states.async_all("switch"):
        if "adaptive_lighting" not in state.entity_id:
            continue
        configured = state.attributes.get("lights") or (
            state.attributes.get("configuration") or {}
        ).get("lights") or []
        if set(configured) & members:
            conflicts.append(state.entity_id)
    return conflicts


class LightcurveConfigFlow(ConfigFlow, domain=DOMAIN):
    """Single-instance setup: pick the areas to drive."""

    VERSION = 1

    def __init__(self) -> None:
        self._conflicts: list[str] = []
        self._areas: list[str] = []

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        areas = ar.async_get(self.hass)
        candidates = {
            area.id: area.name
            for area in areas.async_list_areas()
            if members_for_area(self.hass, area.id)
        }
        if not candidates:
            return self.async_abort(reason="no_areas_with_lights")

        if user_input is not None:
            self._areas = user_input[CONF_AREAS]
            members: set[str] = set()
            for area_id in self._areas:
                members.update(members_for_area(self.hass, area_id))
            self._conflicts = find_conflicting_integrations(self.hass, members)
            if self._conflicts:
                return await self.async_step_conflict()
            return await self._async_create(candidates)

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_AREAS): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            multiple=True,
                            options=[
                                selector.SelectOptionDict(value=area_id, label=name)
                                for area_id, name in sorted(
                                    candidates.items(), key=lambda kv: kv[1]
                                )
                            ],
                        )
                    )
                }
            ),
            description_placeholders={"count": str(len(candidates))},
        )

    async def async_step_conflict(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Make the user acknowledge a competing integration before continuing."""
        areas = ar.async_get(self.hass)
        candidates = {
            area.id: area.name
            for area in areas.async_list_areas()
            if members_for_area(self.hass, area.id)
        }
        if user_input is not None:
            return await self._async_create(candidates)
        return self.async_show_form(
            step_id="conflict",
            data_schema=vol.Schema({}),
            description_placeholders={"entities": ", ".join(self._conflicts)},
        )

    async def _async_create(self, candidates: dict[str, str]) -> ConfigFlowResult:
        store = LightcurveStore(self.hass)
        await store.async_load()
        for area_id in self._areas:
            name = candidates.get(area_id, area_id)
            group = Group(
                id=slugify_group_id(name),
                name=name,
                area_id=area_id,
                profile_id=DEFAULT_PROFILE_ID,
            )
            await store.async_put_group(group)
        return self.async_create_entry(title="Lightcurve", data={})

    @staticmethod
    @callback
    def async_get_options_flow(entry: ConfigEntry) -> LightcurveOptionsFlow:
        return LightcurveOptionsFlow()


class LightcurveOptionsFlow(OptionsFlow):
    """Rooms and global settings after setup.

    Lightcurve is a single config entry holding many groups, so adding a room is not
    a matter of adding another entry — it is editing this one. Without this the areas
    ticked at install were permanent, which is a poor answer to "I want to drive all
    the lights in the house".
    """

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        return self.async_show_menu(step_id="init", menu_options=["rooms", "settings"])

    # --- rooms -----------------------------------------------------------------

    async def async_step_rooms(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        store = LightcurveStore(self.hass)
        await store.async_load()
        groups = store.groups

        areas = ar.async_get(self.hass)
        candidates = {
            area.id: area.name
            for area in areas.async_list_areas()
            if members_for_area(self.hass, area.id)
        }
        # An area that already has a group stays offered even if its lights have all
        # gone missing, or unticking it would be the only way to see it again.
        for group in groups.values():
            if group.area_id and group.area_id not in candidates:
                candidates[group.area_id] = group.name

        current = [g.area_id for g in groups.values() if g.area_id]

        if user_input is not None:
            chosen = set(user_input[CONF_AREAS])
            await self._async_sync_groups(store, groups, candidates, chosen)
            self.hass.async_create_task(
                self.hass.config_entries.async_reload(self.config_entry.entry_id)
            )
            return self.async_create_entry(title="", data={})

        if not candidates:
            return self.async_abort(reason="no_areas_with_lights")

        # Groups with a hand-picked member list are not represented here, so say how
        # many are being left alone rather than appearing to have lost them.
        manual = [g.name for g in groups.values() if not g.area_id]
        return self.async_show_form(
            step_id="rooms",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_AREAS, default=current): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            multiple=True,
                            options=[
                                selector.SelectOptionDict(value=area_id, label=name)
                                for area_id, name in sorted(
                                    candidates.items(), key=lambda kv: kv[1]
                                )
                            ],
                        )
                    )
                }
            ),
            description_placeholders={
                "manual": ", ".join(manual) if manual else "none",
            },
        )

    async def _async_sync_groups(
        self,
        store: LightcurveStore,
        groups: dict[str, Group],
        candidates: dict[str, str],
        chosen: set[str],
    ) -> None:
        """Add groups for newly ticked areas, remove those for unticked ones."""
        by_area = {g.area_id: g for g in groups.values() if g.area_id}

        for area_id in chosen - set(by_area):
            name = candidates.get(area_id, area_id)
            await store.async_put_group(
                Group(
                    id=slugify_group_id(name),
                    name=name,
                    area_id=area_id,
                    profile_id=DEFAULT_PROFILE_ID,
                )
            )

        for area_id in set(by_area) - chosen:
            group = by_area[area_id]
            await store.async_delete_group(group.id)
            # The group's entities hang off a device keyed by its id. Removing the
            # device takes them with it; leaving it behind would litter the registry
            # with entities that can never come back.
            devices = dr.async_get(self.hass)
            device = devices.async_get_device_by_identifier(
                (DOMAIN, group.id), self.config_entry.entry_id
            )
            if device is not None:
                devices.async_remove_device(device.id)

    # --- settings --------------------------------------------------------------

    async def async_step_settings(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        store = LightcurveStore(self.hass)
        await store.async_load()

        if user_input is not None:
            await store.async_update_settings(user_input)
            # Reload so a new tick interval actually takes effect.
            self.hass.async_create_task(
                self.hass.config_entries.async_reload(self.config_entry.entry_id)
            )
            return self.async_create_entry(title="", data={})

        current = store.settings
        return self.async_show_form(
            step_id="settings",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        "tick_seconds", default=current.get("tick_seconds")
                    ): vol.All(int, vol.Range(min=5, max=900)),
                    vol.Required(
                        "kelvin_threshold", default=current.get("kelvin_threshold")
                    ): vol.All(int, vol.Range(min=1, max=500)),
                    vol.Required(
                        "brightness_threshold_pct",
                        default=current.get("brightness_threshold_pct"),
                    ): vol.All(int, vol.Range(min=1, max=50)),
                    vol.Required(
                        "min_command_interval_seconds",
                        default=current.get("min_command_interval_seconds"),
                    ): vol.All(int, vol.Range(min=0, max=300)),
                    vol.Required(
                        "kelvin_tolerance", default=current.get("kelvin_tolerance")
                    ): vol.All(int, vol.Range(min=1, max=1000)),
                    vol.Required(
                        "brightness_tolerance_pct",
                        default=current.get("brightness_tolerance_pct"),
                    ): vol.All(int, vol.Range(min=1, max=50)),
                    vol.Required(
                        "default_transition_seconds",
                        default=current.get("default_transition_seconds"),
                    ): vol.All(int, vol.Range(min=0, max=300)),
                }
            ),
        )
