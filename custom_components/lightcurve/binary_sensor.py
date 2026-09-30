"""A per-group binary sensor that is on while any channel is overridden."""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import ATTR_OVERRIDE_BRIGHTNESS, ATTR_OVERRIDE_COLOUR, DOMAIN
from .coordinator import LightcurveCoordinator
from .entity import LightcurveEntity
from .store import Group


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: LightcurveCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        LightcurveOverrideSensor(coordinator, group)
        for group in coordinator.groups.values()
    )


class LightcurveOverrideSensor(LightcurveEntity, BinarySensorEntity):
    """Whether this group has stopped following the curve, and on which channel."""

    _attr_name = "Curve overridden"
    _attr_icon = "mdi:hand-back-right"

    def __init__(self, coordinator: LightcurveCoordinator, group: Group) -> None:
        super().__init__(coordinator, group, "override")

    @property
    def is_on(self) -> bool:
        return self.coordinator.runtime(self.group.id).overridden

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        runtime = self.coordinator.runtime(self.group.id)
        return {
            ATTR_OVERRIDE_COLOUR: runtime.override_colour,
            ATTR_OVERRIDE_BRIGHTNESS: runtime.override_brightness,
            "override_until": runtime.override_until,
        }
