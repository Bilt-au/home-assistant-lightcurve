"""The wrapper light: one per group, and the entity everything else talks to.

Its whole purpose is that turning it on issues a single command carrying the curve's
colour and brightness together, so the bulb never shows yesterday's setting first.
Members are driven through the coordinator; nothing here talks to bulbs directly.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_BRIGHTNESS_PCT,
    ATTR_COLOR_TEMP_KELVIN,
    ATTR_HS_COLOR,
    ATTR_SUPPORTED_COLOR_MODES,
    ColorMode,
    LightEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    ATTR_MEMBERS,
    ATTR_NEXT_KEYFRAME_AT,
    ATTR_OVERRIDE_BRIGHTNESS,
    ATTR_OVERRIDE_COLOUR,
    ATTR_PROFILE,
    ATTR_SEGMENT,
    ATTR_TARGET_BRIGHTNESS_PCT,
    ATTR_TARGET_HS,
    ATTR_TARGET_KELVIN,
    ATTR_UNAVAILABLE_MEMBERS,
    DOMAIN,
)
from .coordinator import RGB_MODES, LightcurveCoordinator
from .entity import LightcurveEntity
from .store import Group

FALLBACK_MIN_KELVIN = 2000
FALLBACK_MAX_KELVIN = 6535


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator: LightcurveCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        LightcurveGroupLight(coordinator, group)
        for group in coordinator.groups.values()
    )


class LightcurveGroupLight(LightcurveEntity, LightEntity):
    """A group of bulbs, presented as one light that follows a curve."""

    _attr_name = None  # the device name is the light's name

    def __init__(self, coordinator: LightcurveCoordinator, group: Group) -> None:
        super().__init__(coordinator, group, "light")

    # --- capabilities ----------------------------------------------------------

    @property
    def supported_color_modes(self) -> set[ColorMode]:
        """Only what every member can do, so a command never fails on one bulb."""
        modes: set[ColorMode] | None = None
        for entity_id in self.coordinator.available_members(self.curve_group):
            state = self.hass.states.get(entity_id)
            if state is None:
                continue
            reported = {
                ColorMode(mode)
                for mode in state.attributes.get(ATTR_SUPPORTED_COLOR_MODES) or []
                if mode in tuple(ColorMode)
            }
            modes = reported if modes is None else (modes & reported)
        usable = {ColorMode.COLOR_TEMP, *RGB_MODES}
        narrowed = {m for m in (modes or set()) if m in usable}
        # An empty set is invalid for a LightEntity, and brightness-only is the
        # honest fallback when members disagree or none are available yet.
        return narrowed or {ColorMode.BRIGHTNESS}

    @property
    def min_color_temp_kelvin(self) -> int:
        low, _ = self.coordinator.kelvin_range(self.curve_group)
        return low or FALLBACK_MIN_KELVIN

    @property
    def max_color_temp_kelvin(self) -> int:
        _, high = self.coordinator.kelvin_range(self.curve_group)
        return high or FALLBACK_MAX_KELVIN

    # --- state -----------------------------------------------------------------

    @property
    def available(self) -> bool:
        return bool(self.coordinator.available_members(self.curve_group))

    @property
    def is_on(self) -> bool:
        return self.coordinator.is_on(self.curve_group)

    @property
    def color_mode(self) -> ColorMode:
        target = self.coordinator.runtime(self.curve_group.id).target
        supported = self.supported_color_modes
        if target is None:
            return next(iter(supported))
        if target.mode == "kelvin" and ColorMode.COLOR_TEMP in supported:
            return ColorMode.COLOR_TEMP
        if target.mode == "hs" and ColorMode.HS in supported:
            return ColorMode.HS
        return next(iter(supported))

    @property
    def brightness(self) -> int | None:
        target = self.coordinator.runtime(self.curve_group.id).target
        if target is None:
            return None
        return round(target.brightness_pct / 100 * 255)

    @property
    def color_temp_kelvin(self) -> int | None:
        target = self.coordinator.runtime(self.curve_group.id).target
        return target.kelvin if target and target.mode == "kelvin" else None

    @property
    def hs_color(self) -> tuple[float, float] | None:
        target = self.coordinator.runtime(self.curve_group.id).target
        return target.hs if target and target.mode == "hs" else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        group = self.curve_group
        runtime = self.coordinator.runtime(group.id)
        target = runtime.target
        members = self.coordinator.members(group)
        available = set(self.coordinator.available_members(group))
        profile = self.coordinator.store.profiles.get(group.profile_id) or {}
        return {
            ATTR_PROFILE: profile.get("name", group.profile_id),
            ATTR_TARGET_KELVIN: target.kelvin if target else None,
            ATTR_TARGET_HS: list(target.hs) if target and target.hs else None,
            ATTR_TARGET_BRIGHTNESS_PCT: target.brightness_pct if target else None,
            ATTR_SEGMENT: list(target.segment) if target else None,
            ATTR_OVERRIDE_COLOUR: runtime.override_colour,
            ATTR_OVERRIDE_BRIGHTNESS: runtime.override_brightness,
            ATTR_NEXT_KEYFRAME_AT: None,
            ATTR_MEMBERS: members,
            ATTR_UNAVAILABLE_MEMBERS: sorted(set(members) - available),
        }

    # --- commands --------------------------------------------------------------

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Hand the request to the coordinator, translating HA's brightness scale.

        HA offers brightness in 0-255; the curve works in percent. Converting here
        keeps the percentage the single representation everywhere inside.
        """
        forwarded: dict[str, Any] = {}
        if ATTR_BRIGHTNESS in kwargs:
            forwarded[ATTR_BRIGHTNESS_PCT] = max(
                1, round(kwargs[ATTR_BRIGHTNESS] / 255 * 100)
            )
        if ATTR_BRIGHTNESS_PCT in kwargs:
            forwarded[ATTR_BRIGHTNESS_PCT] = kwargs[ATTR_BRIGHTNESS_PCT]
        if ATTR_COLOR_TEMP_KELVIN in kwargs:
            forwarded[ATTR_COLOR_TEMP_KELVIN] = kwargs[ATTR_COLOR_TEMP_KELVIN]
        if ATTR_HS_COLOR in kwargs:
            forwarded[ATTR_HS_COLOR] = list(kwargs[ATTR_HS_COLOR])
        await self.coordinator.async_turn_on(self.curve_group, **forwarded)

    async def async_turn_off(self, **kwargs: Any) -> None:
        await self.coordinator.async_turn_off(self.curve_group)
