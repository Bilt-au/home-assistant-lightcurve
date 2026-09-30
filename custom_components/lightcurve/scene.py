"""One scene entity per look.

Home Assistant's HomeKit Bridge exposes `scene` entities to HomeKit, which is what
makes "Hey Siri, Movie" work without any HomeKit-specific code here. The entity is
the whole integration point.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.scene import Scene
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, LOOK_MODE_EFFECT
from .coordinator import LightcurveCoordinator
from .store import Look


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: LightcurveCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        LightcurveLookScene(coordinator, look)
        for look in coordinator.store.looks.values()
    )


class LightcurveLookScene(Scene):
    """Activating this holds a look against the curve until the room is cycled."""

    _attr_should_poll = False
    # No device, and no entity-name composition.
    #
    # Home Assistant prepends the device name to an entity's friendly name, so a
    # scene attached to a device comes out as "Lightcurve looks Movie". Siri matches
    # on the friendly name, so that breaks the one thing these entities exist for.
    # Grouping them under a device in the UI is not worth "Hey Siri, Movie" failing,
    # so they deliberately have none.
    _attr_has_entity_name = False

    def __init__(self, coordinator: LightcurveCoordinator, look: Look) -> None:
        self.coordinator = coordinator
        self._look_id = look.id
        self._attr_unique_id = f"{DOMAIN}_look_{look.id}"
        self._attr_name = look.name

    @property
    def look(self) -> Look:
        """Re-read from the store so edits apply without recreating the entity."""
        return self.coordinator.store.look(self._look_id)

    @property
    def icon(self) -> str:
        return (
            "mdi:party-popper"
            if self.look.mode == LOOK_MODE_EFFECT
            else "mdi:lightbulb-on-outline"
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        look = self.look
        return {
            "mode": look.mode,
            "effect": look.effect,
            "brightness_pct": look.brightness,
            "groups": look.groups or ["(all groups)"],
            "hold_minutes": look.hold_minutes,
        }

    async def async_activate(self, **kwargs: Any) -> None:
        applied = await self.coordinator.async_apply_look(self.look)
        if not applied:
            # Silence here would look like success. A look covering only rooms whose
            # bulbs are unavailable, or asking for an effect none of them have, has
            # done nothing and should say so.
            self.coordinator.logger.warning(
                "look %r reached no groups: check its rooms are available%s",
                self.look.name,
                " and that the bulbs offer that effect"
                if self.look.mode == LOOK_MODE_EFFECT
                else "",
            )
