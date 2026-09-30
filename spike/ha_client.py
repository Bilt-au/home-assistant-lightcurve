"""Just enough of the Home Assistant WebSocket API to drive bulbs and watch the bus.

Deliberately dependency-light: this is throwaway spike tooling, not part of the
integration. Nothing here imports Home Assistant itself.
"""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import aiohttp

# homeassistant.components.light.LightEntityFeature.TRANSITION
TRANSITION_FEATURE = 32


class HAError(RuntimeError):
    """Home Assistant rejected a command, or the socket died."""


def _ws_url(base_url: str) -> str:
    url = base_url.rstrip("/")
    if url.startswith("https://"):
        url = "wss://" + url[len("https://") :]
    elif url.startswith("http://"):
        url = "ws://" + url[len("http://") :]
    elif not url.startswith(("ws://", "wss://")):
        url = "ws://" + url
    return url + "/api/websocket"


@dataclass
class Sample:
    """One state_changed event, flattened to the fields the spike cares about."""

    at: float  # time.monotonic()
    entity_id: str
    state: str | None
    kelvin: int | None
    brightness: int | None
    brightness_pct: int | None
    hs: list[float] | None
    color_mode: str | None
    context_id: str | None
    context_parent_id: str | None

    def summary(self) -> str:
        bits = [self.state or "?"]
        if self.color_mode:
            bits.append(self.color_mode)
        if self.kelvin is not None:
            bits.append(f"{self.kelvin}K")
        if self.hs:
            bits.append(f"hs({self.hs[0]:.0f},{self.hs[1]:.0f})")
        if self.brightness_pct is not None:
            bits.append(f"{self.brightness_pct}%")
        return " ".join(bits)


class StateRecorder:
    """Records state_changed events for a set of entities with monotonic timings."""

    def __init__(self, entities: list[str]) -> None:
        self._entities = set(entities)
        self._samples: dict[str, list[Sample]] = {e: [] for e in self._entities}

    def handle(self, event: dict) -> None:
        data = event.get("data") or {}
        entity_id = data.get("entity_id")
        if entity_id not in self._entities:
            return
        new_state = data.get("new_state")
        if not new_state:
            return
        attrs = new_state.get("attributes") or {}
        brightness = attrs.get("brightness")
        ctx = new_state.get("context") or {}
        self._samples[entity_id].append(
            Sample(
                at=time.monotonic(),
                entity_id=entity_id,
                state=new_state.get("state"),
                kelvin=attrs.get("color_temp_kelvin"),
                brightness=brightness,
                brightness_pct=None if brightness is None else round(brightness / 255 * 100),
                hs=attrs.get("hs_color"),
                color_mode=attrs.get("color_mode"),
                context_id=ctx.get("id"),
                context_parent_id=ctx.get("parent_id"),
            )
        )

    def samples(self, entity_id: str, since: float | None = None) -> list[Sample]:
        out = self._samples.get(entity_id) or []
        if since is not None:
            out = [s for s in out if s.at >= since]
        return list(out)

    def last_event_time(self, entity_id: str) -> float | None:
        items = self._samples.get(entity_id) or []
        return items[-1].at if items else None

    def latest(self, entity_id: str) -> Sample | None:
        items = self._samples.get(entity_id) or []
        return items[-1] if items else None


class HAClient:
    """Minimal authenticated WebSocket client."""

    def __init__(self, base_url: str, token: str) -> None:
        self._url = _ws_url(base_url)
        self._token = token
        self._session: aiohttp.ClientSession | None = None
        self._ws: aiohttp.ClientWebSocketResponse | None = None
        self._next_id = 1
        self._pending: dict[int, asyncio.Future[Any]] = {}
        self._handlers: dict[int, Callable[[dict], None]] = {}
        self._reader: asyncio.Task[None] | None = None

    async def __aenter__(self) -> HAClient:
        await self.connect()
        return self

    async def __aexit__(self, *_exc: object) -> None:
        await self.close()

    async def connect(self) -> None:
        self._session = aiohttp.ClientSession()
        self._ws = await self._session.ws_connect(self._url, heartbeat=30)
        hello = await self._ws.receive_json()
        if hello.get("type") != "auth_required":
            raise HAError(f"unexpected greeting from {self._url}: {hello}")
        await self._ws.send_json({"type": "auth", "access_token": self._token})
        reply = await self._ws.receive_json()
        if reply.get("type") != "auth_ok":
            raise HAError(f"authentication failed: {reply}")
        self._reader = asyncio.create_task(self._read_loop())

    async def close(self) -> None:
        if self._reader is not None:
            self._reader.cancel()
            try:
                await self._reader
            except asyncio.CancelledError:
                pass
        if self._ws is not None:
            await self._ws.close()
        if self._session is not None:
            await self._session.close()

    async def _read_loop(self) -> None:
        assert self._ws is not None
        try:
            async for msg in self._ws:
                if msg.type is not aiohttp.WSMsgType.TEXT:
                    continue
                data = json.loads(msg.data)
                kind = data.get("type")
                if kind == "result":
                    future = self._pending.pop(data.get("id"), None)
                    if future is not None and not future.done():
                        if data.get("success"):
                            future.set_result(data.get("result"))
                        else:
                            future.set_exception(HAError(str(data.get("error"))))
                elif kind == "event":
                    handler = self._handlers.get(data.get("id"))
                    if handler is not None:
                        handler(data.get("event") or {})
        except asyncio.CancelledError:
            raise
        except Exception as err:  # noqa: BLE001 - surface socket death to every waiter
            for future in self._pending.values():
                if not future.done():
                    future.set_exception(HAError(f"socket closed: {err}"))

    def _claim_id(self) -> tuple[int, asyncio.Future[Any]]:
        msg_id = self._next_id
        self._next_id += 1
        future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
        self._pending[msg_id] = future
        return msg_id, future

    async def _command(self, payload: dict[str, Any]) -> Any:
        assert self._ws is not None
        msg_id, future = self._claim_id()
        await self._ws.send_json({"id": msg_id, **payload})
        return await future

    async def get_states(self) -> list[dict]:
        return await self._command({"type": "get_states"})

    async def get_state(self, entity_id: str) -> dict:
        for state in await self.get_states():
            if state["entity_id"] == entity_id:
                return state
        raise HAError(f"no such entity: {entity_id}")

    async def call_service(
        self,
        domain: str,
        service: str,
        data: dict[str, Any] | None = None,
        target: dict[str, Any] | None = None,
    ) -> tuple[dict, float]:
        """Call a service and return (result, seconds).

        HA answers a call_service command only once the service has finished, so
        the elapsed time is a real end-to-end round trip through the integration
        to the device.
        """
        payload: dict[str, Any] = {"type": "call_service", "domain": domain, "service": service}
        if data:
            payload["service_data"] = data
        if target:
            payload["target"] = target
        started = time.monotonic()
        result = await self._command(payload)
        return (result or {}), time.monotonic() - started

    async def subscribe_events(
        self, event_type: str | None, handler: Callable[[dict], None]
    ) -> int:
        assert self._ws is not None
        msg_id, future = self._claim_id()
        self._handlers[msg_id] = handler  # must be live before the first event lands
        payload: dict[str, Any] = {"id": msg_id, "type": "subscribe_events"}
        if event_type:
            payload["event_type"] = event_type
        await self._ws.send_json(payload)
        await future
        return msg_id

    async def unsubscribe(self, subscription: int) -> None:
        self._handlers.pop(subscription, None)
        await self._command({"type": "unsubscribe_events", "subscription": subscription})
