"""A per-group profile selector.

This is what answers the spec's open question about needing a dashboard card for
quick profile switching: as an entity, any dashboard, automation or voice assistant
can change a group's profile with no extra UI to build.
"""

from __future__ import annotations

from homeassistant.components.select import SelectEntity
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
    async_add_entities(
        LightcurveProfileSelect(coordinator, group)
        for group in coordinator.groups.values()
    )


class LightcurveProfileSelect(LightcurveEntity, SelectEntity):
    """Which profile drives this group."""

    _attr_name = "Profile"
    _attr_icon = "mdi:chart-line"

    def __init__(self, coordinator: LightcurveCoordinator, group: Group) -> None:
        super().__init__(coordinator, group, "profile")

    def _by_name(self) -> dict[str, str]:
        """Profile names shown to the user, mapped back to their ids."""
        return {
            (profile.get("name") or profile_id): profile_id
            for profile_id, profile in self.coordinator.store.profiles.items()
        }

    @property
    def options(self) -> list[str]:
        return sorted(self._by_name())

    @property
    def current_option(self) -> str | None:
        group = self.group
        profile = self.coordinator.store.profiles.get(group.profile_id)
        if profile is None:
            return None
        return profile.get("name") or group.profile_id

    async def async_select_option(self, option: str) -> None:
        profile_id = self._by_name().get(option)
        if profile_id is None:
            return
        group = self.group
        group.profile_id = profile_id
        await self.coordinator.store.async_put_group(group)
        # Switching profile should be visible immediately, and it invalidates any
        # override, which was against the old curve.
        await self.coordinator.async_resume(group)
        self.async_write_ha_state()
