"""Scene entities, one per theme per room, plus a whole-house one.

Home Assistant's HomeKit Bridge exposes scene entities to HomeKit, which is what
makes "Hey Siri, Movie" work with no HomeKit-specific code here.

The shape matters for voice. HomeKit disambiguates by the room an *accessory* sits
in, not by how a scene is configured, so "Red light district in the bedroom" needs a
separate accessory in the bedroom carrying that name. One scene covering several
rooms cannot be addressed that way however it is set up.

So each theme produces a scene per room it covers, all named after the theme and
each placed in its own room, plus one named "<Theme> everywhere" when it covers more
than one.
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.scene import Scene
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import async_generate_entity_id
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, THEME_MODE_EFFECT
from .coordinator import LightcurveCoordinator
from .store import Group, Theme

_LOGGER = logging.getLogger(__name__)

#: Fired when themes change, so scenes appear and disappear without a reload.
SIGNAL_THEMES_CHANGED = f"{DOMAIN}_themes_changed"


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: LightcurveCoordinator = hass.data[DOMAIN][entry.entry_id]
    known: set[str] = set()

    @callback
    def sync_scenes() -> None:
        """Create scenes for anything new; drop registry entries for what is gone."""
        wanted = _wanted_scenes(coordinator)
        fresh = [
            scene for key, scene in wanted.items() if key not in known
        ]
        for key in wanted:
            known.add(key)
        if fresh:
            async_add_entities(fresh)

        registry = er.async_get(hass)
        for entry_ in list(registry.entities.values()):
            if entry_.platform != DOMAIN or entry_.domain != "scene":
                continue
            if entry_.unique_id in wanted:
                continue
            # Any scene of ours that is no longer wanted goes, not merely the ones
            # created in this session. Renaming looks to themes changed every
            # unique_id, which orphaned the old entities rather than replacing them
            # — leaving two accessories with the same name for Siri to choose
            # between, and a voice command that silently does nothing.
            _LOGGER.debug("removing stale theme scene %s", entry_.entity_id)
            known.discard(entry_.unique_id)
            registry.async_remove(entry_.entity_id)

    sync_scenes()
    entry.async_on_unload(
        async_dispatcher_connect(hass, SIGNAL_THEMES_CHANGED, sync_scenes)
    )


def _wanted_scenes(coordinator: LightcurveCoordinator) -> dict[str, Scene]:
    """Every scene that should exist right now, keyed by unique_id."""
    groups = coordinator.groups
    wanted: dict[str, Scene] = {}
    for theme in coordinator.store.themes.values():
        covered = [
            groups[group_id]
            for group_id in (theme.groups or list(groups))
            if group_id in groups
        ]
        for group in covered:
            key = f"{DOMAIN}_theme_{theme.id}_{group.id}"
            wanted[key] = LightcurveThemeScene(coordinator, theme, group)
        if len(covered) > 1:
            key = f"{DOMAIN}_theme_{theme.id}"
            wanted[key] = LightcurveThemeScene(coordinator, theme, None)
    return wanted


class LightcurveThemeScene(Scene):
    """A theme, optionally scoped to one room.

    Carries no device. Home Assistant composes an entity's friendly name from its
    device, which turned "Movie" into "Lightcurve themes Movie" — and Siri matches on
    the friendly name, so that breaks the one thing these exist for.
    """

    _attr_should_poll = False
    _attr_has_entity_name = False

    def __init__(
        self,
        coordinator: LightcurveCoordinator,
        theme: Theme,
        group: Group | None,
    ) -> None:
        self.coordinator = coordinator
        self._theme_id = theme.id
        self._group_id = group.id if group else None
        self._area_id = group.area_id if group else None
        self._attr_unique_id = (
            f"{DOMAIN}_theme_{theme.id}_{group.id}"
            if group
            else f"{DOMAIN}_theme_{theme.id}"
        )
        # Every per-room scene carries the theme's own name so the spoken phrase is
        # the theme, with the room doing the disambiguating. The house-wide one is
        # named differently because two accessories called the same thing, one of
        # them everywhere, is a coin toss for Siri.
        self._attr_name = theme.name if group else f"{theme.name} everywhere"
        self.entity_id = async_generate_entity_id(
            "scene.{}",
            f"{theme.name} {group.name}" if group else f"{theme.name} everywhere",
            hass=coordinator.hass,
        )

    @property
    def theme(self) -> Theme:
        """Re-read from the store so edits apply without recreating the entity."""
        return self.coordinator.store.theme(self._theme_id)

    @property
    def available(self) -> bool:
        # A theme can be deleted while its entity is still registered.
        return self._theme_id in self.coordinator.store.themes

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
            "theme": theme.name,
            "mode": theme.mode,
            "effect": theme.effect,
            "brightness_pct": theme.brightness,
            "room": self._group_id or "(all rooms it covers)",
        }

    async def async_added_to_hass(self) -> None:
        """Put a per-room scene in its room, so HomeKit can tell them apart.

        Only when the entity has no area yet: a user who has moved it has made a
        decision, and re-asserting ours on every restart would undo it.
        """
        await super().async_added_to_hass()
        if not self._area_id:
            return
        registry = er.async_get(self.hass)
        entry = registry.async_get(self.entity_id)
        if entry is not None and entry.area_id is None:
            registry.async_update_entity(self.entity_id, area_id=self._area_id)

    async def async_activate(self, **kwargs: Any) -> None:
        theme = self.theme
        only = [self._group_id] if self._group_id else None
        applied = await self.coordinator.async_apply_theme(theme, only)
        if not applied:
            # Silence would look like success. A theme covering only unavailable
            # rooms, or asking for an effect the bulbs lack, has done nothing.
            _LOGGER.warning(
                "theme %r reached no lights%s: check the rooms are available%s",
                theme.name,
                f" in {self._group_id}" if self._group_id else "",
                " and that the bulbs offer that effect"
                if theme.mode == THEME_MODE_EFFECT
                else "",
            )
