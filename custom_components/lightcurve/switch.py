"""Per-group switches: whether the curve drives the group, and sleep mode."""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import LightcurveCoordinator
from .entity import LightcurveEntity
from .store import Group


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: LightcurveCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list[SwitchEntity] = []
    for group in coordinator.groups.values():
        entities.append(LightcurveEnabledSwitch(coordinator, group))
    async_add_entities(entities)


class LightcurveEnabledSwitch(LightcurveEntity, SwitchEntity):
    """Turn the curve off for a group without losing its configuration.

    With this off the wrapper light still works, it just behaves like a plain light
    group — useful while decorating, or when something looks wrong and you want the
    curve out of the picture.
    """

    _attr_name = "Curve enabled"
    _attr_icon = "mdi:chart-bell-curve-cumulative"

    def __init__(self, coordinator: LightcurveCoordinator, group: Group) -> None:
        super().__init__(coordinator, group, "enabled")

    @property
    def is_on(self) -> bool:
        return self.group.enabled

    async def async_turn_on(self, **kwargs: Any) -> None:
        await self._async_set(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self._async_set(False)

    async def _async_set(self, enabled: bool) -> None:
        group = self.group
        group.enabled = enabled
        await self.coordinator.store.async_put_group(group)
        if enabled:
            # Re-enabling should take effect now, not at the next tick.
            await self.coordinator.async_resume(group)
        self.async_write_ha_state()
