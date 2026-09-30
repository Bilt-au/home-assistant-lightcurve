"""A per-group sensor exposing the current curve target."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    ATTR_SEGMENT,
    ATTR_TARGET_BRIGHTNESS_PCT,
    ATTR_TARGET_HS,
    ATTR_TARGET_KELVIN,
    DOMAIN,
)
from .coordinator import LightcurveCoordinator
from .entity import LightcurveEntity
from .store import Group


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: LightcurveCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        LightcurveTargetSensor(coordinator, group)
        for group in coordinator.groups.values()
    )


class LightcurveTargetSensor(LightcurveEntity, SensorEntity):
    """Target colour temperature, with the full target in attributes.

    The spec had this reporting either a kelvin number or the string `rgb`. A sensor
    that changes type breaks statistics and the recorder, so the state stays numeric
    and goes unknown during a colour section, where a colour temperature genuinely
    does not exist. The attributes always carry the whole target.
    """

    _attr_name = "Curve target"
    _attr_native_unit_of_measurement = UnitOfTemperature.KELVIN
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:thermometer"

    def __init__(self, coordinator: LightcurveCoordinator, group: Group) -> None:
        super().__init__(coordinator, group, "target")

    @property
    def native_value(self) -> int | None:
        target = self.coordinator.runtime(self.group.id).target
        if target is None or target.mode != "kelvin":
            return None
        return target.kelvin

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        target = self.coordinator.runtime(self.group.id).target
        return {
            "mode": target.mode if target else None,
            ATTR_TARGET_KELVIN: target.kelvin if target else None,
            ATTR_TARGET_HS: list(target.hs) if target and target.hs else None,
            ATTR_TARGET_BRIGHTNESS_PCT: target.brightness_pct if target else None,
            ATTR_SEGMENT: list(target.segment) if target else None,
        }
