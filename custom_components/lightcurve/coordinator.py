"""The scheduler, override detection and power-restore logic.

Design notes that are not obvious from the code, all traceable to Phase 0
measurements in docs/spec.md Appendix C:

* No `transition` is sent. The L630 advertises the feature and ignores it, so
  smoothness comes from small frequent steps instead, and the thresholds are set
  low enough not to reintroduce the steps they were meant to smooth.
* Colour and brightness go in one `light.turn_on`. That was verified to land
  atomically once another integration was stopped from overwriting it.
* Override detection branches on `color_mode` before comparing. In colour-temperature
  mode the TP-Link integration still reports a synthesised `hs_color`, so comparing
  hue unconditionally would flag every CT-mode light as carrying a colour.
* Any other integration adapting these bulbs will fight this one. Its writes are
  foreign by definition, so each one raises an override and the group stops
  following the curve. The config flow warns about this; there is no fix here.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any

from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_BRIGHTNESS_PCT,
    ATTR_COLOR_MODE,
    ATTR_COLOR_TEMP_KELVIN,
    ATTR_EFFECT,
    ATTR_EFFECT_LIST,
    ATTR_HS_COLOR,
    ATTR_MAX_COLOR_TEMP_KELVIN,
    ATTR_MIN_COLOR_TEMP_KELVIN,
    ATTR_SUPPORTED_COLOR_MODES,
    ColorMode,
)
from homeassistant.const import (
    ATTR_ENTITY_ID,
    SERVICE_TURN_OFF,
    SERVICE_TURN_ON,
    STATE_ON,
    STATE_UNAVAILABLE,
    STATE_UNKNOWN,
)
from homeassistant.core import Context, Event, HomeAssistant, callback
from homeassistant.helpers.event import (
    async_track_state_change_event,
    async_track_time_interval,
)
from homeassistant.helpers.sun import get_astral_event_date
from homeassistant.util import dt as dt_util

from .const import (
    CHANNEL_BRIGHTNESS,
    CHANNEL_COLOUR,
    DOMAIN,
    POWER_RESTORE_APPLY_CURVE,
    POWER_RESTORE_RESTORE_PREVIOUS,
    POWER_RESTORE_TURN_OFF,
    THEME_MODE_EFFECT,
)
from .engine import (
    CurveError,
    ResolvedKeyframe,
    Target,
    clamp_target,
    evaluate,
    kelvin_to_mired,
    resolve_window,
)
from .store import Group, LightcurveStore, StoreError, Theme

_LOGGER = logging.getLogger(__name__)

#: The spec names solar noon `solar_noon`; astral, and therefore HA, calls it `noon`.
SUN_EVENTS: dict[str, str] = {
    "dawn": "dawn",
    "sunrise": "sunrise",
    "solar_noon": "noon",
    "sunset": "sunset",
    "dusk": "dusk",
}

RGB_MODES = {ColorMode.HS, ColorMode.RGB, ColorMode.RGBW, ColorMode.RGBWW, ColorMode.XY}

#: A wrapper light being commanded faster than this is not a person pressing a
#: button. It is another integration reacting to the state change our own command
#: produced, and us reacting to it in turn. Left alone that loop allocates service
#: calls and contexts until Home Assistant is killed, so it is capped here rather
#: than trusted not to happen.
STORM_WINDOW_SECONDS = 10.0
STORM_LIMIT = 20
STORM_COOLDOWN_SECONDS = 60.0

#: How many of our own command contexts to remember for override detection.
MAX_REMEMBERED_CONTEXTS = 512


@dataclass
class AppliedState:
    """What we last sent to a member, so a later state report can be compared."""

    at: float  # time.monotonic()
    mode: str
    kelvin: int | None
    hs: tuple[float, float] | None
    brightness_pct: int


@dataclass
class GroupRuntime:
    """Per-group state that is rebuilt on restart rather than persisted."""

    target: Target | None = None
    override_colour: bool = False
    override_brightness: bool = False
    override_until: datetime | None = None
    applied: dict[str, AppliedState] = field(default_factory=dict)
    last_command_at: dict[str, float] = field(default_factory=dict)
    suppress_until: dict[str, float] = field(default_factory=dict)
    pre_outage: dict[str, dict[str, Any]] = field(default_factory=dict)
    warned: set[str] = field(default_factory=set)
    #: Which theme is currently showing, if any. Inferring this from the override
    #: flags does not work: every theme covering a room would report itself active
    #: the moment any one of them was applied.
    active_theme: str | None = None
    #: Timestamps of recent externally-initiated turn_on calls, for storm detection.
    recent_turn_ons: deque[float] = field(default_factory=lambda: deque(maxlen=64))
    storm_until: float = 0.0
    #: While the editor's scrubber is driving this group, the scheduler stands back
    #: rather than fighting it for control of the same bulbs.
    previewing: bool = False

    @property
    def overridden(self) -> bool:
        return self.override_colour or self.override_brightness

    def clear_overrides(self) -> None:
        self.override_colour = False
        self.override_brightness = False
        self.override_until = None
        self.active_theme = None


class LightcurveCoordinator:
    """Owns the tick, the member commands and all runtime state."""

    logger = _LOGGER

    def __init__(self, hass: HomeAssistant, store: LightcurveStore) -> None:
        self.hass = hass
        self.store = store
        self._runtime: dict[str, GroupRuntime] = {}
        # An insertion-ordered mapping used as an ordered set, so pruning can evict
        # the oldest rather than an arbitrary member. A plain set prunes in hash
        # order, which can drop a context whose command is still in flight; that
        # command's own state change then looks foreign and raises a false override —
        # the precise failure this bookkeeping exists to prevent.
        self._contexts: dict[str, None] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._listeners: list[Callable[[], None]] = []
        self._unsubscribers: list[Callable[[], None]] = []
        self._restore_handles: dict[str, asyncio.Task[None]] = {}

    # --- lifecycle -------------------------------------------------------------

    async def async_setup(self) -> None:
        interval = timedelta(seconds=int(self.store.setting("tick_seconds")))
        self._unsubscribers.append(
            async_track_time_interval(self.hass, self._async_tick, interval)
        )
        self._resubscribe_members()
        self._warn_about_competing_integrations()
        await self.async_apply_all(force=True)

    async def async_shutdown(self) -> None:
        for unsubscribe in self._unsubscribers:
            unsubscribe()
        self._unsubscribers.clear()
        for task in self._restore_handles.values():
            task.cancel()
        self._restore_handles.clear()

    @callback
    def async_add_listener(self, update: Callable[[], None]) -> Callable[[], None]:
        """Entities subscribe here to be told when to re-render."""
        self._listeners.append(update)

        def remove() -> None:
            if update in self._listeners:
                self._listeners.remove(update)

        return remove

    @callback
    def _notify(self) -> None:
        for update in list(self._listeners):
            update()

    def _warn_about_competing_integrations(self) -> None:
        """Say so at startup when something else is driving the same lights.

        Two cases, and they are not equally bad. Another integration adapting our
        *member bulbs* fights the curve: its writes read as manual changes and the
        group stops following within a tick. Another integration adapting our
        *wrapper* is worse, because it is a loop — it commands the wrapper, we
        command the bulbs, we publish our state, and it reacts to that. The circuit
        breaker keeps that from exhausting memory, but the cause is a configuration
        only the user can fix, and it is invisible unless we name it.
        """
        from homeassistant.helpers import entity_registry as er

        registry = er.async_get(self.hass)
        wrappers = {
            entry.entity_id
            for entry in registry.entities.values()
            if entry.platform == DOMAIN and entry.domain == "light"
        }
        members: set[str] = set()
        for group in self.groups.values():
            members.update(self.members(group))

        for state in self.hass.states.async_all("switch"):
            if "adaptive_lighting" not in state.entity_id:
                continue
            configured = set(state.attributes.get("lights") or [])
            clashing_wrappers = sorted(configured & wrappers)
            if clashing_wrappers:
                _LOGGER.error(
                    "%s is configured to control %s, which is a Lightcurve wrapper"
                    " light. The two will drive each other in a loop. Remove %s from"
                    " that integration",
                    state.entity_id,
                    ", ".join(clashing_wrappers),
                    ", ".join(clashing_wrappers),
                )
            clashing_members = sorted(configured & members)
            if clashing_members:
                _LOGGER.warning(
                    "%s is also adapting %s, which Lightcurve drives. Its changes"
                    " count as manual overrides, so the curve will stop within about"
                    " a minute of a light coming on",
                    state.entity_id,
                    ", ".join(clashing_members),
                )

    def _resubscribe_members(self) -> None:
        """Watch every current member light for foreign changes."""
        entities: set[str] = set()
        for group in self.store.groups.values():
            entities.update(self.members(group))
        if not entities:
            return
        self._unsubscribers.append(
            async_track_state_change_event(
                self.hass, sorted(entities), self._handle_member_state
            )
        )

    # --- groups and members ----------------------------------------------------

    @property
    def groups(self) -> dict[str, Group]:
        return self.store.groups

    @property
    def runtime_states(self) -> dict[str, GroupRuntime]:
        """Every runtime that exists, for callers that need to scan them."""
        return self._runtime

    def runtime(self, group_id: str) -> GroupRuntime:
        return self._runtime.setdefault(group_id, GroupRuntime())

    def members(self, group: Group) -> list[str]:
        """Resolve a group's member lights.

        An explicit member list always wins, so a group can override its area. When
        only an area is set, membership is derived live from the registry, which is
        what makes a newly added bulb join its room without reconfiguration.

        Our own wrapper lights are always excluded. A wrapper that ended up in its
        own group would command itself: the service call routes straight back into
        async_turn_on, which sends to the members, which include the wrapper — an
        unbounded chain of awaited service calls that exhausts memory in seconds.
        A wrapper landing in the area it drives is not exotic, it is the obvious
        thing for someone tidying up their device list to do.
        """
        if group.members:
            candidates = list(group.members)
        elif group.area_id:
            candidates = members_for_area(self.hass, group.area_id)
        else:
            return []
        return [e for e in candidates if not self.owns_entity(e)]

    def owns_entity(self, entity_id: str) -> bool:
        """Is this one of Lightcurve's own entities?"""
        from homeassistant.helpers import entity_registry as er

        entry = er.async_get(self.hass).async_get(entity_id)
        return entry is not None and entry.platform == DOMAIN

    def available_members(self, group: Group) -> list[str]:
        out = []
        for entity_id in self.members(group):
            state = self.hass.states.get(entity_id)
            if state and state.state not in (STATE_UNAVAILABLE, STATE_UNKNOWN):
                out.append(entity_id)
        return out

    def is_on(self, group: Group) -> bool:
        return any(
            (state := self.hass.states.get(entity_id)) and state.state == STATE_ON
            for entity_id in self.members(group)
        )

    # --- target computation ----------------------------------------------------

    def _sun_lookup(self) -> Callable[[date, str], datetime | None]:
        def lookup(day: date, event: str) -> datetime | None:
            astral_event = SUN_EVENTS.get(event)
            if astral_event is None:
                return None
            result = get_astral_event_date(self.hass, astral_event, day)
            return dt_util.as_local(result) if result else None

        return lookup

    def target_for(self, group: Group, now: datetime | None = None) -> Target | None:
        """The curve's target for a group, already clamped to what its bulbs can do."""
        now = now or dt_util.now()
        try:
            keyframes = self.store.profile_keyframes(
                group.profile_id, group.variant_schedule
            )
            resolved = resolve_window(
                keyframes, now.date(), self._sun_lookup(), now.tzinfo
            )
            target = evaluate(resolved, now)
        except (StoreError, CurveError) as err:
            self._warn_once(group, f"target: {err}", err)
            return None
        low, high = self.kelvin_range(group)
        if low and high:
            target = clamp_target(target, low, high)
        return target

    def kelvin_range(self, group: Group) -> tuple[int | None, int | None]:
        """The intersection of what the members support, per §7.3."""
        lows, highs = [], []
        for entity_id in self.available_members(group):
            state = self.hass.states.get(entity_id)
            if not state:
                continue
            low = state.attributes.get(ATTR_MIN_COLOR_TEMP_KELVIN)
            high = state.attributes.get(ATTR_MAX_COLOR_TEMP_KELVIN)
            if low and high:
                lows.append(low)
                highs.append(high)
        if not lows:
            return (None, None)
        return (max(lows), min(highs))

    def clamp_for(
        self, group: Group, resolved: list[ResolvedKeyframe], moment: datetime
    ) -> Target:
        """Evaluate an already-resolved curve at one instant, clamped to the group.

        Used by the editor, which resolves a profile the store may not hold yet.
        """
        target = evaluate(resolved, moment)
        low, high = self.kelvin_range(group)
        return clamp_target(target, low, high) if low and high else target

    # --- themes -----------------------------------------------------------------

    async def async_apply_theme(
        self, theme: Theme, only_groups: list[str] | None = None
    ) -> list[str]:
        """Put the groups a theme covers into that theme.

        `only_groups` narrows it to part of its usual reach, so a theme covering the
        whole house can be sent to one room without needing a duplicate theme per
        room. Rooms the theme does not cover are still ignored: narrowing is a
        restriction, never a way to reach somewhere the theme was not meant for.

        Applying sets both channel overrides, which is the whole mechanism: without
        them the next tick would put the curve straight back. Switching the room off
        and on clears the overrides, so a theme needs no explicit exit.

        Returns the groups it reached, so a scene can report doing nothing rather
        than silently succeeding.
        """
        applied: list[str] = []
        targets = theme.groups or list(self.groups)
        if only_groups is not None:
            targets = [group_id for group_id in targets if group_id in only_groups]
        for group_id in targets:
            try:
                group = self.store.group(group_id)
            except StoreError:
                _LOGGER.warning(
                    "theme %s references missing group %s", theme.id, group_id
                )
                continue

            members = self.available_members(group)
            if theme.mode == THEME_MODE_EFFECT:
                members = [m for m in members if self._supports_effect(m, theme.effect)]
                if not members:
                    self._warn_once(
                        group,
                        f"no member supports the {theme.effect!r} effect,"
                        f" so the {theme.name!r} theme does nothing here",
                        None,
                    )
                    continue
                data: dict[str, Any] = {ATTR_EFFECT: theme.effect}
            else:
                data = {ATTR_BRIGHTNESS_PCT: theme.brightness}
                colour = theme.colour or {}
                if colour.get("mode") == "kelvin":
                    data[ATTR_COLOR_TEMP_KELVIN] = colour.get("kelvin")
                elif colour.get("hs"):
                    data[ATTR_HS_COLOR] = list(colour["hs"])

            if not members:
                continue
            await self._async_send_raw(group, members, data)

            runtime = self.runtime(group.id)
            runtime.override_colour = True
            runtime.override_brightness = True
            runtime.active_theme = theme.id
            runtime.override_until = (
                dt_util.utcnow() + timedelta(minutes=theme.hold_minutes)
                if theme.hold_minutes
                else None
            )
            applied.append(group.id)

        self._notify()
        return applied

    def _supports_effect(self, entity_id: str, effect: str | None) -> bool:
        """Effect names are device-specific, so check rather than assume.

        A bulb without the named effect would otherwise be sent a command it
        rejects, and the whole theme would theme broken because of one member.
        """
        if not effect:
            return False
        state = self.hass.states.get(entity_id)
        if state is None:
            return False
        available = state.attributes.get(ATTR_EFFECT_LIST) or []
        return effect in available

    # --- preview ---------------------------------------------------------------

    async def async_preview(self, group: Group, target: Target) -> None:
        """Drive a group to an arbitrary target for the editor.

        Bypasses the rate limiter on purpose. That limiter exists to stop a
        background scheduler stacking commands on a slow bulb; the scrubber is direct
        manipulation and has to keep up with a finger.
        """
        runtime = self.runtime(group.id)
        runtime.previewing = True
        data: dict[str, Any] = {ATTR_BRIGHTNESS_PCT: target.brightness_pct}
        if target.mode == "kelvin":
            data[ATTR_COLOR_TEMP_KELVIN] = target.kelvin
        elif target.hs:
            data[ATTR_HS_COLOR] = list(target.hs)
        await self._async_send_raw(group, self.available_members(group), data)

    async def async_end_preview(self, group: Group) -> None:
        """Hand the group back to the curve."""
        runtime = self.runtime(group.id)
        if not runtime.previewing:
            return
        runtime.previewing = False
        await self.async_apply(group, force=True)

    # --- applying --------------------------------------------------------------

    async def async_apply_all(self, force: bool = False) -> None:
        for group in self.groups.values():
            if group.enabled:
                await self.async_apply(group, force=force)

    async def async_apply(
        self,
        group: Group,
        target: Target | None = None,
        force: bool = False,
        only_members: list[str] | None = None,
    ) -> None:
        """Push the curve to a group's members, honouring thresholds and overrides."""
        runtime = self.runtime(group.id)
        target = target or self.target_for(group)
        if target is None:
            return
        runtime.target = target

        members = only_members or self.available_members(group)
        members = [e for e in members if not self.owns_entity(e)]
        if not members:
            return

        sends = [
            self._async_send(group, entity_id, target, force)
            for entity_id in members
        ]
        results = await asyncio.gather(*sends, return_exceptions=True)
        for entity_id, result in zip(members, results, strict=True):
            if isinstance(result, BaseException):
                self._warn_once(group, f"send to {entity_id}", result)
        self._notify()

    async def _async_send(
        self, group: Group, entity_id: str, target: Target, force: bool
    ) -> None:
        runtime = self.runtime(group.id)
        data = self._build_payload(group, entity_id, target, runtime, force=force)
        if data is None:
            return

        now = time.monotonic()
        minimum = float(self.store.setting("min_command_interval_seconds"))
        last = runtime.last_command_at.get(entity_id)
        if not force and last is not None and now - last < minimum:
            return

        lock = self._locks.setdefault(entity_id, asyncio.Lock())
        async with lock:
            context = Context()
            self._remember_context(context)
            suppression = float(self.store.setting("command_suppression_seconds"))
            runtime.suppress_until[entity_id] = time.monotonic() + suppression
            runtime.last_command_at[entity_id] = time.monotonic()
            await self.hass.services.async_call(
                "light",
                SERVICE_TURN_ON,
                {ATTR_ENTITY_ID: entity_id, **data},
                blocking=True,
                context=context,
            )
            runtime.applied[entity_id] = AppliedState(
                at=time.monotonic(),
                mode=target.mode,
                kelvin=target.kelvin,
                hs=target.hs,
                brightness_pct=data.get(ATTR_BRIGHTNESS_PCT, target.brightness_pct),
            )

    def _build_payload(
        self,
        group: Group,
        entity_id: str,
        target: Target,
        runtime: GroupRuntime,
        force: bool = False,
    ) -> dict[str, Any] | None:
        """Assemble one `light.turn_on`, or None when nothing perceptible changed.

        Overridden channels are simply left out, which is what makes a Siri dim keep
        following the curve in colour while holding the brightness the user asked for.
        """
        supported = self._supported_modes(entity_id)
        data: dict[str, Any] = {}

        if not runtime.override_colour:
            if target.mode == "kelvin" and ColorMode.COLOR_TEMP in supported:
                data[ATTR_COLOR_TEMP_KELVIN] = target.kelvin
            elif target.mode == "hs" and supported & RGB_MODES:
                data[ATTR_HS_COLOR] = list(target.hs or (0, 0))
            elif target.mode == "hs" and ColorMode.COLOR_TEMP in supported:
                # A colour section on a white-only bulb: hold the warmest it can do
                # rather than dropping the group's colour handling entirely.
                low, _ = self.kelvin_range(group)
                if low:
                    data[ATTR_COLOR_TEMP_KELVIN] = low
                self._warn_once(
                    group,
                    f"{entity_id} cannot show colours; using its warmest white",
                    None,
                )

        if not runtime.override_brightness:
            data[ATTR_BRIGHTNESS_PCT] = target.brightness_pct

        if not data:
            return None
        if not force and not self._perceptible(runtime, entity_id, target, data):
            return None
        return data

    def _perceptible(
        self,
        runtime: GroupRuntime,
        entity_id: str,
        target: Target,
        data: dict[str, Any],
    ) -> bool:
        """Is this worth a command? Compared in mireds, which is where perception is."""
        applied = runtime.applied.get(entity_id)
        if applied is None:
            return True
        if applied.mode != target.mode:
            return True

        if ATTR_BRIGHTNESS_PCT in data:
            threshold = float(self.store.setting("brightness_threshold_pct"))
            if abs(data[ATTR_BRIGHTNESS_PCT] - applied.brightness_pct) >= threshold:
                return True
        if ATTR_COLOR_TEMP_KELVIN in data and applied.kelvin:
            kelvin_threshold = float(self.store.setting("kelvin_threshold"))
            # Express the kelvin threshold in mireds at the current point on the
            # curve, so it means the same thing at 2200 K as at 6500 K.
            allowed_mired = abs(
                kelvin_to_mired(applied.kelvin)
                - kelvin_to_mired(applied.kelvin + kelvin_threshold)
            )
            moved = abs(
                kelvin_to_mired(data[ATTR_COLOR_TEMP_KELVIN])
                - kelvin_to_mired(applied.kelvin)
            )
            if moved >= allowed_mired:
                return True
        if ATTR_HS_COLOR in data and applied.hs:
            hue_threshold = float(self.store.setting("hue_tolerance"))
            if abs(data[ATTR_HS_COLOR][0] - applied.hs[0]) >= hue_threshold:
                return True
            if abs(data[ATTR_HS_COLOR][1] - applied.hs[1]) >= hue_threshold:
                return True
        return False

    def _supported_modes(self, entity_id: str) -> set[str]:
        state = self.hass.states.get(entity_id)
        if not state:
            return set()
        return set(state.attributes.get(ATTR_SUPPORTED_COLOR_MODES) or [])

    # --- turn on / off, driven by the wrapper light -----------------------------

    def _is_storm(self, group: Group) -> bool:
        """Is something driving this wrapper in a feedback loop?

        Two adaptive systems pointed at the same light will each react to the other's
        writes. Nothing downstream of that is safe to keep doing, so the wrapper stops
        accepting commands for a cooldown and says why. Dropping a command is a far
        better failure than exhausting memory and taking Home Assistant down.
        """
        runtime = self.runtime(group.id)
        now = time.monotonic()
        if now < runtime.storm_until:
            return True

        runtime.recent_turn_ons.append(now)
        cutoff = now - STORM_WINDOW_SECONDS
        while runtime.recent_turn_ons and runtime.recent_turn_ons[0] < cutoff:
            runtime.recent_turn_ons.popleft()

        if len(runtime.recent_turn_ons) <= STORM_LIMIT:
            return False

        runtime.storm_until = now + STORM_COOLDOWN_SECONDS
        runtime.recent_turn_ons.clear()
        self._warn_once(
            group,
            f"ignoring commands for {STORM_COOLDOWN_SECONDS:.0f}s: this light was"
            f" commanded more than {STORM_LIMIT} times in"
            f" {STORM_WINDOW_SECONDS:.0f}s, which usually means another integration"
            " such as Adaptive Lighting is also driving it and the two are reacting"
            " to each other. Remove this light from the other integration",
            None,
        )
        return True

    async def async_turn_on(self, group: Group, **kwargs: Any) -> None:
        """Turn a group on, applying the curve unless explicit values were given.

        Explicit values create an override on that channel only, so "set the lounge
        to 40 %" holds the brightness while colour keeps tracking the curve.
        """
        if self._is_storm(group):
            return
        runtime = self.runtime(group.id)
        target = self.target_for(group)

        if not kwargs:
            runtime.clear_overrides()
            await self.async_apply(group, target, force=True)
            return

        if ATTR_BRIGHTNESS_PCT in kwargs or ATTR_BRIGHTNESS in kwargs:
            runtime.override_brightness = True
        if ATTR_COLOR_TEMP_KELVIN in kwargs or ATTR_HS_COLOR in kwargs:
            runtime.override_colour = True
        # Whatever theme was showing is not showing any more.
        runtime.active_theme = None
        self._set_override_deadline(group, runtime)

        data = dict(kwargs)
        if target is not None:
            if not runtime.override_brightness:
                data[ATTR_BRIGHTNESS_PCT] = target.brightness_pct
            if not runtime.override_colour:
                if target.mode == "kelvin":
                    data[ATTR_COLOR_TEMP_KELVIN] = target.kelvin
                elif target.hs:
                    data[ATTR_HS_COLOR] = list(target.hs)

        await self._async_send_raw(group, self.available_members(group), data)
        self._notify()

    async def async_turn_off(self, group: Group, **kwargs: Any) -> None:
        runtime = self.runtime(group.id)
        runtime.clear_overrides()
        members = self.available_members(group)
        if not members:
            return
        context = Context()
        self._remember_context(context)
        for entity_id in members:
            runtime.suppress_until[entity_id] = time.monotonic() + float(
                self.store.setting("command_suppression_seconds")
            )
        await self.hass.services.async_call(
            "light",
            SERVICE_TURN_OFF,
            {ATTR_ENTITY_ID: members, **kwargs},
            blocking=True,
            context=context,
        )
        self._notify()

    async def _async_send_raw(
        self, group: Group, members: list[str], data: dict[str, Any]
    ) -> None:
        """Send an explicit payload, bypassing thresholds and the rate limit.

        One command per bulb, matching the scheduled path: a group can contain bulbs
        with different capabilities, and a single fan-out call would have to send all
        of them the same payload.
        """
        members = [e for e in members if not self.owns_entity(e)]
        if not members:
            return
        runtime = self.runtime(group.id)
        context = Context()
        self._remember_context(context)
        suppression = float(self.store.setting("command_suppression_seconds"))

        async def send(entity_id: str) -> None:
            runtime.suppress_until[entity_id] = time.monotonic() + suppression
            runtime.last_command_at[entity_id] = time.monotonic()
            await self.hass.services.async_call(
                "light",
                SERVICE_TURN_ON,
                {ATTR_ENTITY_ID: entity_id, **data},
                blocking=True,
                context=context,
            )
            runtime.applied[entity_id] = AppliedState(
                at=time.monotonic(),
                mode="hs" if ATTR_HS_COLOR in data else "kelvin",
                kelvin=data.get(ATTR_COLOR_TEMP_KELVIN),
                hs=tuple(data[ATTR_HS_COLOR]) if ATTR_HS_COLOR in data else None,
                brightness_pct=data.get(ATTR_BRIGHTNESS_PCT, 0),
            )

        results = await asyncio.gather(
            *(send(entity_id) for entity_id in members), return_exceptions=True
        )
        for entity_id, result in zip(members, results, strict=True):
            if isinstance(result, BaseException):
                self._warn_once(group, f"send to {entity_id}", result)

    # --- overrides -------------------------------------------------------------

    def _set_override_deadline(self, group: Group, runtime: GroupRuntime) -> None:
        minutes = group.override_timeout_minutes
        runtime.override_until = (
            dt_util.utcnow() + timedelta(minutes=minutes) if minutes else None
        )

    async def async_resume(self, group: Group) -> None:
        """Drop overrides and put the group back on the curve."""
        self.runtime(group.id).clear_overrides()
        await self.async_apply(group, force=True)

    async def async_pause(
        self, group: Group, channels: list[str], duration_minutes: int | None = None
    ) -> None:
        runtime = self.runtime(group.id)
        if CHANNEL_COLOUR in channels:
            runtime.override_colour = True
        if CHANNEL_BRIGHTNESS in channels:
            runtime.override_brightness = True
        runtime.active_theme = None
        runtime.override_until = (
            dt_util.utcnow() + timedelta(minutes=duration_minutes)
            if duration_minutes
            else None
        )
        self._notify()

    def _remember_context(self, context: Context) -> None:
        self._contexts[context.id] = None
        # Unbounded growth would be a slow leak; a tick only creates a handful, so a
        # few hundred is ample. Oldest out first.
        while len(self._contexts) > MAX_REMEMBERED_CONTEXTS:
            self._contexts.pop(next(iter(self._contexts)))

    def _is_ours(self, context: Context | None) -> bool:
        if context is None:
            return False
        return context.id in self._contexts or (
            context.parent_id is not None and context.parent_id in self._contexts
        )

    # --- state watching --------------------------------------------------------

    @callback
    def _handle_member_state(self, event: Event) -> None:
        entity_id: str = event.data[ATTR_ENTITY_ID]
        new_state = event.data.get("new_state")
        old_state = event.data.get("old_state")
        group = self._group_for_member(entity_id)
        if group is None:
            return
        runtime = self.runtime(group.id)

        if new_state is None or new_state.state == STATE_UNAVAILABLE:
            if old_state is not None and old_state.state not in (
                STATE_UNAVAILABLE,
                STATE_UNKNOWN,
            ):
                runtime.pre_outage[entity_id] = {
                    "state": old_state.state,
                    "attributes": dict(old_state.attributes),
                }
            return

        came_back = old_state is None or old_state.state in (
            STATE_UNAVAILABLE,
            STATE_UNKNOWN,
        )
        if came_back:
            self._schedule_power_restore(group, entity_id)
            return

        if self._is_ours(new_state.context):
            return
        if time.monotonic() < runtime.suppress_until.get(entity_id, 0.0):
            return
        # A member switching off while its neighbours stay on is not an override.
        if new_state.state != STATE_ON:
            return

        colour_changed, brightness_changed = self._diff_from_applied(
            runtime, entity_id, new_state
        )
        if not colour_changed and not brightness_changed:
            return
        if colour_changed:
            runtime.override_colour = True
        if brightness_changed:
            runtime.override_brightness = True
        # Someone has changed these lights by hand, so the theme is gone.
        runtime.active_theme = None
        self._set_override_deadline(group, runtime)
        _LOGGER.debug(
            "%s: foreign change on %s (colour=%s brightness=%s)",
            group.name,
            entity_id,
            colour_changed,
            brightness_changed,
        )
        self._notify()

    def _diff_from_applied(
        self, runtime: GroupRuntime, entity_id: str, state: Any
    ) -> tuple[bool, bool]:
        """Compare reported state against what we sent, per channel.

        Branching on `color_mode` first is essential: in colour-temperature mode the
        TP-Link integration reports a synthesised `hs_color` derived from the kelvin
        value, so comparing hue unconditionally would flag every CT light as coloured.
        """
        applied = runtime.applied.get(entity_id)
        if applied is None:
            return (False, False)

        attributes = state.attributes
        colour_changed = False
        mode = attributes.get(ATTR_COLOR_MODE)

        if mode == ColorMode.COLOR_TEMP and applied.kelvin is not None:
            reported = attributes.get(ATTR_COLOR_TEMP_KELVIN)
            tolerance = float(self.store.setting("kelvin_tolerance"))
            if reported is not None and abs(reported - applied.kelvin) > tolerance:
                colour_changed = True
        elif mode in RGB_MODES and applied.hs is not None:
            reported = attributes.get(ATTR_HS_COLOR)
            tolerance = float(self.store.setting("hue_tolerance"))
            if reported is not None and (
                abs(reported[0] - applied.hs[0]) > tolerance
                or abs(reported[1] - applied.hs[1]) > tolerance
            ):
                colour_changed = True
        elif mode is not None and applied.mode == "kelvin" and mode in RGB_MODES:
            colour_changed = True  # something switched it out of white mode
        elif mode is not None and applied.mode == "hs" and mode == ColorMode.COLOR_TEMP:
            colour_changed = True

        brightness_changed = False
        reported_brightness = attributes.get(ATTR_BRIGHTNESS)
        if reported_brightness is not None:
            reported_pct = round(reported_brightness / 255 * 100)
            tolerance = float(self.store.setting("brightness_tolerance_pct"))
            if abs(reported_pct - applied.brightness_pct) > tolerance:
                brightness_changed = True

        return (colour_changed, brightness_changed)

    def _group_for_member(self, entity_id: str) -> Group | None:
        for group in self.groups.values():
            if entity_id in self.members(group):
                return group
        return None

    # --- power restore ---------------------------------------------------------

    def _schedule_power_restore(self, group: Group, entity_id: str) -> None:
        """Debounce, because bulbs reconnect in waves after a grid restore."""
        existing = self._restore_handles.pop(entity_id, None)
        if existing:
            existing.cancel()

        async def run() -> None:
            delay = float(self.store.setting("power_restore_debounce_seconds"))
            try:
                await asyncio.sleep(delay)
            except asyncio.CancelledError:
                return
            await self._async_power_restore(group, entity_id)
            self._restore_handles.pop(entity_id, None)

        self._restore_handles[entity_id] = self.hass.async_create_task(run())

    async def _async_power_restore(self, group: Group, entity_id: str) -> None:
        state = self.hass.states.get(entity_id)
        if state is None or state.state == STATE_UNAVAILABLE:
            return
        runtime = self.runtime(group.id)
        previous = runtime.pre_outage.pop(entity_id, None)
        mode = group.power_restore

        if mode == POWER_RESTORE_TURN_OFF:
            if state.state == STATE_ON:
                await self.async_turn_off(group)
            return
        if mode == POWER_RESTORE_RESTORE_PREVIOUS and previous is not None:
            if previous["state"] != STATE_ON:
                await self.async_turn_off(group)
                return
            attributes = previous["attributes"]
            data: dict[str, Any] = {}
            if attributes.get(ATTR_BRIGHTNESS) is not None:
                data[ATTR_BRIGHTNESS] = attributes[ATTR_BRIGHTNESS]
            if attributes.get(ATTR_COLOR_TEMP_KELVIN):
                data[ATTR_COLOR_TEMP_KELVIN] = attributes[ATTR_COLOR_TEMP_KELVIN]
            elif attributes.get(ATTR_HS_COLOR):
                data[ATTR_HS_COLOR] = list(attributes[ATTR_HS_COLOR])
            await self._async_send_raw(group, [entity_id], data)
            return
        if mode == POWER_RESTORE_APPLY_CURVE and state.state == STATE_ON:
            await self.async_apply(group, force=True, only_members=[entity_id])

    # --- tick ------------------------------------------------------------------

    async def _async_tick(self, now: datetime) -> None:
        for group in self.groups.values():
            if not group.enabled:
                continue
            runtime = self.runtime(group.id)
            if runtime.override_until and dt_util.utcnow() >= runtime.override_until:
                _LOGGER.debug("%s: override expired", group.name)
                runtime.clear_overrides()
            if runtime.previewing:
                continue
            if not self.is_on(group):
                # Keep the published target current even while off, so the sensor and
                # the wrapper's attributes stay meaningful.
                runtime.target = self.target_for(group)
                continue
            if runtime.override_colour and runtime.override_brightness:
                continue
            await self.async_apply(group)
        self._notify()

    # --- logging ---------------------------------------------------------------

    def _warn_once(self, group: Group, what: str, err: BaseException | None) -> None:
        """One line per distinct cause, not one per tick (§19)."""
        runtime = self.runtime(group.id)
        key = f"{what}:{type(err).__name__ if err else ''}"
        if key in runtime.warned:
            return
        runtime.warned.add(key)
        if err is None:
            _LOGGER.warning("%s: %s", group.name, what)
        else:
            _LOGGER.warning("%s: %s (%s)", group.name, what, err)


def members_for_area(hass: HomeAssistant, area_id: str) -> list[str]:
    """Light entities in an area, including those inheriting it from their device.

    The entity registry only records an area directly when it has been overridden,
    so a device-level area has to be followed too; otherwise most bulbs theme
    area-less.
    """
    from homeassistant.helpers import device_registry as dr
    from homeassistant.helpers import entity_registry as er

    entities = er.async_get(hass)
    devices = dr.async_get(hass)
    out: list[str] = []
    for entry in entities.entities.values():
        if entry.domain != "light" or entry.disabled_by is not None:
            continue
        # Never return our own wrapper lights: a group containing its own wrapper
        # would drive itself in an unbounded loop. See LightcurveCoordinator.members.
        if entry.platform == DOMAIN:
            continue
        effective = entry.area_id
        if effective is None and entry.device_id:
            device = devices.async_get(entry.device_id)
            effective = device.area_id if device else None
        if effective == area_id:
            out.append(entry.entity_id)
    return sorted(out)
