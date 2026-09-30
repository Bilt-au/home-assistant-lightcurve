"""Shared base for Lightcurve's entities.

Each group is presented as one HA device so its wrapper light, switches and sensors
sit together in the UI rather than scattered across the entity list.
"""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity import Entity

from .const import DOMAIN
from .coordinator import LightcurveCoordinator
from .store import Group


class LightcurveEntity(Entity):
    """Common wiring: device identity and re-render on coordinator updates."""

    _attr_should_poll = False
    _attr_has_entity_name = True

    def __init__(
        self, coordinator: LightcurveCoordinator, group: Group, key: str
    ) -> None:
        self.coordinator = coordinator
        self._group_id = group.id
        self._attr_unique_id = f"{DOMAIN}_{group.id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, group.id)},
            name=group.name,
            manufacturer="Lightcurve",
            model="Curve group",
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def curve_group(self) -> Group:
        """Re-read from the store so edits are picked up without recreating entities.

        Deliberately not called `group`: Home Assistant reserves that name on Entity,
        and shadowing it makes the framework warn on every entity and is slated to
        stop working in 2027.2.
        """
        return self.coordinator.store.group(self._group_id)

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self.coordinator.async_add_listener(self._handle_update))

    def _handle_update(self) -> None:
        if self.hass is not None:
            self.async_write_ha_state()
