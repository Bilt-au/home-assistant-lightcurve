"""One scene entity per theme.

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

from .const import DOMAIN, THEME_MODE_EFFECT
from .coordinator import LightcurveCoordinator
from .store import Theme


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: LightcurveCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        LightcurveThemeScene(coordinator, theme)
        for theme in coordinator.store.themes.values()
    )


class LightcurveThemeScene(Scene):
    """Activating this holds a theme against the curve until the room is cycled."""

    _attr_should_poll = False
    # No device, and no entity-name composition.
    #
    # Home Assistant prepends the device name to an entity's friendly name, so a
    # scene attached to a device comes out as "Lightcurve themes Movie". Siri matches
    # on the friendly name, so that breaks the one thing these entities exist for.
    # Grouping them under a device in the UI is not worth "Hey Siri, Movie" failing,
    # so they deliberately have none.
    _attr_has_entity_name = False

    def __init__(self, coordinator: LightcurveCoordinator, theme: Theme) -> None:
        self.coordinator = coordinator
        self._theme_id = theme.id
        self._attr_unique_id = f"{DOMAIN}_look_{theme.id}"
        self._attr_name = theme.name

    @property
    def theme(self) -> Theme:
        """Re-read from the store so edits apply without recreating the entity."""
        return self.coordinator.store.theme(self._theme_id)

    @property
    def icon(self) -> str:
        return (
            "mdi:party-popper"
            if self.theme.mode == THEME_MODE_EFFECT
            else "mdi:lightbulb-on-outline"
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        theme = self.theme
        return {
            "mode": theme.mode,
            "effect": theme.effect,
            "brightness_pct": theme.brightness,
            "groups": theme.groups or ["(all groups)"],
            "hold_minutes": theme.hold_minutes,
        }

    async def async_activate(self, **kwargs: Any) -> None:
        applied = await self.coordinator.async_apply_theme(self.theme)
        if not applied:
            # Silence here would theme like success. A theme covering only rooms whose
            # bulbs are unavailable, or asking for an effect none of them have, has
            # done nothing and should say so.
            self.coordinator.logger.warning(
                "theme %r reached no groups: check its rooms are available%s",
                self.theme.name,
                " and that the bulbs offer that effect"
                if self.theme.mode == THEME_MODE_EFFECT
                else "",
            )
