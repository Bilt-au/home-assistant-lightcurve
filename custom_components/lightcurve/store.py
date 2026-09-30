"""Persistence for profiles, groups and settings.

Stored data is plain JSON-safe dicts; the engine works in dataclasses. The
conversion lives here so that a malformed stored profile fails at load with a clear
message rather than deep inside a scheduler tick.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    DEFAULT_PROFILE,
    DEFAULT_PROFILE_ID,
    DEFAULT_THEMES,
    POWER_RESTORE_APPLY_CURVE,
    POWER_RESTORE_MODES,
    SETTINGS_DEFAULTS,
    STORAGE_KEY,
    STORAGE_VERSION,
    THEME_MODE_EFFECT,
    THEME_MODE_STATIC,
)
from .engine import Colour, CurveError, Keyframe, KeyframeTime

_LOGGER = logging.getLogger(__name__)


class StoreError(Exception):
    """Stored data could not be read or is not valid."""


@dataclass
class Group:
    """A set of lights driven together by one profile.

    `area_id` is the normal case: members are derived from the Home Assistant area
    at runtime, so a bulb added to that area joins automatically. `members` is for
    groups that are not rooms — "outdoor", "downstairs" — and, when both are set,
    overrides the area entirely.
    """

    id: str
    name: str
    profile_id: str = DEFAULT_PROFILE_ID
    area_id: str | None = None
    members: list[str] = field(default_factory=list)
    variant_schedule: str = "default"
    sleep: dict[str, Any] | None = None
    override_timeout_minutes: int | None = None
    power_restore: str = POWER_RESTORE_APPLY_CURVE
    enabled: bool = True

    def __post_init__(self) -> None:
        if not self.area_id and not self.members:
            raise StoreError(f"group {self.id} has neither an area nor any members")
        if self.power_restore not in POWER_RESTORE_MODES:
            raise StoreError(
                f"group {self.id} has unknown power_restore {self.power_restore!r}"
            )

    @property
    def derives_members_from_area(self) -> bool:
        return bool(self.area_id) and not self.members

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "profile_id": self.profile_id,
            "area_id": self.area_id,
            "members": list(self.members),
            "variant_schedule": self.variant_schedule,
            "sleep": self.sleep,
            "override_timeout_minutes": self.override_timeout_minutes,
            "power_restore": self.power_restore,
            "enabled": self.enabled,
        }

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> Group:
        try:
            return cls(
                id=raw["id"],
                name=raw["name"],
                profile_id=raw.get("profile_id", DEFAULT_PROFILE_ID),
                area_id=raw.get("area_id"),
                members=list(raw.get("members") or []),
                variant_schedule=raw.get("variant_schedule", "default"),
                sleep=raw.get("sleep"),
                override_timeout_minutes=raw.get("override_timeout_minutes"),
                power_restore=raw.get("power_restore", POWER_RESTORE_APPLY_CURVE),
                enabled=raw.get("enabled", True),
            )
        except KeyError as err:
            raise StoreError(f"group is missing {err}") from err


@dataclass
class Theme:
    """A named set of values held against the curve.

    Either static — a colour and brightness — or an effect name the bulb runs
    itself. `groups` is which groups it covers, so one scene entity can put a whole
    selection of rooms into Movie with a single request.
    """

    id: str
    name: str
    mode: str = THEME_MODE_STATIC
    colour: dict[str, Any] | None = None
    brightness: int | None = None
    effect: str | None = None
    groups: list[str] = field(default_factory=list)
    #: None means hold until the room is switched off and on again.
    hold_minutes: int | None = None

    def __post_init__(self) -> None:
        if self.mode not in (THEME_MODE_STATIC, THEME_MODE_EFFECT):
            raise StoreError(f"theme {self.id} has unknown mode {self.mode!r}")
        if self.mode == THEME_MODE_EFFECT and not self.effect:
            raise StoreError(f"theme {self.id} is an effect theme with no effect name")
        if self.mode == THEME_MODE_STATIC:
            if self.brightness is None or not 1 <= self.brightness <= 100:
                raise StoreError(
                    f"theme {self.id} needs a brightness between 1 and 100"
                )
            if not self.colour:
                raise StoreError(f"theme {self.id} needs a colour")

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "mode": self.mode,
            "colour": self.colour,
            "brightness": self.brightness,
            "effect": self.effect,
            "groups": list(self.groups),
            "hold_minutes": self.hold_minutes,
        }

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> Theme:
        try:
            return cls(
                id=raw["id"],
                name=raw["name"],
                mode=raw.get("mode", THEME_MODE_STATIC),
                colour=raw.get("colour"),
                brightness=raw.get("brightness"),
                effect=raw.get("effect"),
                groups=list(raw.get("groups") or []),
                hold_minutes=raw.get("hold_minutes"),
            )
        except KeyError as err:
            raise StoreError(f"theme is missing {err}") from err


def keyframe_from_dict(raw: dict[str, Any]) -> Keyframe:
    """Convert one stored keyframe into the engine's form.

    Raises StoreError rather than CurveError so callers have a single exception type
    for "the stored data is wrong".
    """
    try:
        time_raw = raw["time"]
        colour_raw = raw["colour"]
        when = KeyframeTime(
            type=time_raw["type"],
            value=time_raw.get("value"),
            event=time_raw.get("event"),
            offset_min=int(time_raw.get("offset_min", 0)),
        )
        if colour_raw["mode"] == "kelvin":
            colour = Colour.from_kelvin(int(colour_raw["kelvin"]))
        else:
            hue, saturation = colour_raw["hs"]
            colour = Colour.from_hs(float(hue), float(saturation))
        return Keyframe(
            id=raw["id"],
            time=when,
            colour=colour,
            brightness_pct=int(raw["brightness"]),
            easing=raw.get("easing", "linear"),
        )
    except (KeyError, TypeError, ValueError) as err:
        raise StoreError(f"bad keyframe {raw.get('id', '?')}: {err}") from err
    except CurveError as err:
        raise StoreError(f"invalid keyframe {raw.get('id', '?')}: {err}") from err


class _MigratingStore(Store[dict[str, Any]]):
    """Home Assistant owns storage migration, so it has to happen here.

    Store.async_load raises NotImplementedError when the stored major version is
    older than the current one and this hook is not overridden — a hand-rolled
    migration after load never gets the chance to run.
    """

    async def _async_migrate_func(
        self, old_major_version: int, old_minor_version: int, old_data: dict[str, Any]
    ) -> dict[str, Any]:
        if old_major_version < 2 and "looks" in old_data:
            # Themes were called "looks" in 0.2.0 to 0.2.4. Renamed rather than
            # re-seeded, so anything already saved survives the change.
            #
            # Only when looks were actually present: writing an empty "themes" key
            # here would look like "the user has no themes" rather than "this store
            # predates themes", and the defaults would never be seeded.
            renamed: dict[str, Any] = {}
            for key, theme in (old_data.pop("looks") or {}).items():
                if isinstance(theme, dict) and str(theme.get("id", "")).startswith("l_"):
                    theme["id"] = "t_" + theme["id"][2:]
                renamed[theme.get("id", key) if isinstance(theme, dict) else key] = theme
            old_data["themes"] = renamed
        return old_data


class LightcurveStore:
    """Thin wrapper over HA's Store with defaults, validation and accessors."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = _MigratingStore(
            hass, STORAGE_VERSION, STORAGE_KEY
        )
        self._data: dict[str, Any] = {}
        self._loaded = False

    # --- lifecycle -------------------------------------------------------------

    async def async_load(self) -> None:
        raw = await self._store.async_load()
        if raw is None:
            _LOGGER.debug("no stored data; seeding defaults")
            self._data = self._seed()
            await self._store.async_save(self._data)
        else:
            self._data = self._migrate(raw)
        # Settings gain keys as the integration grows; fill in anything missing so an
        # older store does not need a migration for every new knob.
        settings = self._data.setdefault("settings", {})
        for key, value in SETTINGS_DEFAULTS.items():
            settings.setdefault(key, value)
        self._data.setdefault("profiles", {})
        self._data.setdefault("groups", {})
        # Themes arrived after the first release, so an existing store has none.
        # Seeding here rather than in a migration keeps them appearing for anyone
        # who installed before they existed.
        if "themes" not in self._data:
            self._data["themes"] = {k: dict(v) for k, v in DEFAULT_THEMES.items()}
        self._loaded = True

    async def async_save(self) -> None:
        self._require_loaded()
        await self._store.async_save(self._data)

    def _seed(self) -> dict[str, Any]:
        return {
            "version": STORAGE_VERSION,
            "settings": dict(SETTINGS_DEFAULTS),
            "profiles": {DEFAULT_PROFILE_ID: DEFAULT_PROFILE},
            "groups": {},
            "themes": {k: dict(v) for k, v in DEFAULT_THEMES.items()},
        }

    def _migrate(self, raw: dict[str, Any]) -> dict[str, Any]:
        """Bring stored data up to STORAGE_VERSION."""
        version = raw.get("version", STORAGE_VERSION)
        if version > STORAGE_VERSION:
            raise StoreError(
                f"stored data is version {version}, this build understands"
                f" {STORAGE_VERSION} — downgrade is not supported"
            )

        raw["version"] = STORAGE_VERSION
        return raw

    def _require_loaded(self) -> None:
        if not self._loaded:
            raise StoreError("store used before async_load()")

    # --- settings --------------------------------------------------------------

    @property
    def settings(self) -> dict[str, Any]:
        self._require_loaded()
        return self._data["settings"]

    def setting(self, key: str) -> Any:
        return self.settings.get(key, SETTINGS_DEFAULTS.get(key))

    async def async_update_settings(self, values: dict[str, Any]) -> None:
        self.settings.update(values)
        await self.async_save()

    # --- profiles --------------------------------------------------------------

    @property
    def profiles(self) -> dict[str, dict[str, Any]]:
        self._require_loaded()
        return self._data["profiles"]

    def profile(self, profile_id: str) -> dict[str, Any]:
        try:
            return self.profiles[profile_id]
        except KeyError as err:
            raise StoreError(f"no such profile {profile_id!r}") from err

    def profile_keyframes(
        self, profile_id: str, variant: str = "default"
    ) -> list[Keyframe]:
        """Stored keyframes for a profile variant, as engine objects.

        Falls back to the `default` variant when the requested one is absent, which
        keeps a group working if its variant is deleted out from under it.
        """
        profile = self.profile(profile_id)
        variants = profile.get("variants") or {}
        chosen = variants.get(variant) or variants.get("default")
        if not chosen:
            raise StoreError(f"profile {profile_id!r} has no usable variant")
        keyframes = [keyframe_from_dict(raw) for raw in chosen.get("keyframes", [])]
        if len(keyframes) < 2:
            raise StoreError(
                f"profile {profile_id!r} variant {variant!r} has"
                f" {len(keyframes)} keyframes; at least 2 are needed"
            )
        return keyframes

    async def async_put_profile(self, profile: dict[str, Any]) -> None:
        if "id" not in profile:
            raise StoreError("profile needs an id")
        self.profiles[profile["id"]] = profile
        await self.async_save()

    async def async_delete_profile(self, profile_id: str) -> None:
        if profile_id == DEFAULT_PROFILE_ID:
            raise StoreError("the default profile cannot be deleted")
        in_use = [g.id for g in self.groups.values() if g.profile_id == profile_id]
        if in_use:
            raise StoreError(f"profile {profile_id!r} is still used by {in_use}")
        self.profiles.pop(profile_id, None)
        await self.async_save()

    # --- groups ----------------------------------------------------------------

    @property
    def groups(self) -> dict[str, Group]:
        self._require_loaded()
        out: dict[str, Group] = {}
        for group_id, raw in self._data["groups"].items():
            try:
                out[group_id] = Group.from_dict(raw)
            except StoreError as err:
                _LOGGER.error("skipping unreadable group %s: %s", group_id, err)
        return out

    def group(self, group_id: str) -> Group:
        try:
            return self.groups[group_id]
        except KeyError as err:
            raise StoreError(f"no such group {group_id!r}") from err

    async def async_put_group(self, group: Group) -> None:
        if group.profile_id not in self.profiles:
            raise StoreError(
                f"group {group.id!r} references unknown profile {group.profile_id!r}"
            )
        self._data["groups"][group.id] = group.to_dict()
        await self.async_save()

    async def async_delete_group(self, group_id: str) -> None:
        self._data["groups"].pop(group_id, None)
        await self.async_save()

    # --- themes -----------------------------------------------------------------

    @property
    def themes(self) -> dict[str, Theme]:
        self._require_loaded()
        out: dict[str, Theme] = {}
        for theme_id, raw in (self._data.get("themes") or {}).items():
            try:
                out[theme_id] = Theme.from_dict(raw)
            except StoreError as err:
                _LOGGER.error("skipping unreadable theme %s: %s", theme_id, err)
        return out

    def theme(self, theme_id: str) -> Theme:
        try:
            return self.themes[theme_id]
        except KeyError as err:
            raise StoreError(f"no such theme {theme_id!r}") from err

    async def async_put_theme(self, theme: Theme) -> None:
        known = set(self.groups)
        unknown = [g for g in theme.groups if g not in known]
        if unknown:
            raise StoreError(f"theme {theme.id!r} references unknown groups {unknown}")
        self._data.setdefault("themes", {})[theme.id] = theme.to_dict()
        await self.async_save()

    async def async_delete_theme(self, theme_id: str) -> None:
        (self._data.get("themes") or {}).pop(theme_id, None)
        await self.async_save()

    # --- diagnostics -----------------------------------------------------------

    def as_dict(self) -> dict[str, Any]:
        self._require_loaded()
        return dict(self._data)
