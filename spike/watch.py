#!/usr/bin/env python3
"""Watch what actually hits the bus when Siri, the wall switch or an app touches a light.

The question this answers: does "Hey Siri, turn on the lounge lights" arrive as a
bare `turn_on`, or does HomeKit send a remembered brightness along with it? If it
does, Lightcurve's override rule (spec 9) would flag a brightness override on
every single voice turn-on, and the Phase 1 acceptance criterion fails.

Run it, then work through the phrases it prints, then read the service_data.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from datetime import datetime
from typing import Any

from ha_client import HAClient, HAError
from probe import HERE, load_env_file

PHRASES = [
    'Hey Siri, turn on the <room> lights',
    'Hey Siri, turn off the <room> lights',
    'Hey Siri, set the <room> lights to 40%',
    'Hey Siri, turn on the <room> lights   (again, after the 40% above)',
    'Hey Siri, make the <room> lights blue',
    'Tap the light on in the Home app',
    'Tap the wall switch',
    'Change the bulb from the Tapo app',
]


def stamp() -> str:
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]


def make_handlers(domains: set[str], entities: set[str] | None) -> tuple[Any, Any]:
    def on_call_service(event: dict) -> None:
        data = event.get("data") or {}
        if data.get("domain") not in domains:
            return
        target = (data.get("service_data") or {}).get("entity_id") or (
            (data.get("target") or {}).get("entity_id")
        )
        if entities and target:
            names = {target} if isinstance(target, str) else set(target)
            if not (names & entities):
                return
        ctx = event.get("context") or {}
        print(f"\n[{stamp()}] CALL {data.get('domain')}.{data.get('service')}")
        print(f"           data    {data.get('service_data')}")
        if data.get("target"):
            print(f"           target  {data.get('target')}")
        print(
            f"           context id={(ctx.get('id') or '-')[:8]}"
            f" parent={(ctx.get('parent_id') or '-')[:8]}"
            f" user={(ctx.get('user_id') or '-')[:8]}"
        )

    def on_state_changed(event: dict) -> None:
        data = event.get("data") or {}
        entity_id = data.get("entity_id") or ""
        if entity_id.split(".", 1)[0] not in domains:
            return
        if entities and entity_id not in entities:
            return
        new = data.get("new_state") or {}
        old = data.get("old_state") or {}
        attrs = new.get("attributes") or {}
        ctx = new.get("context") or {}
        brightness = attrs.get("brightness")
        pct = None if brightness is None else round(brightness / 255 * 100)
        print(
            f"[{stamp()}] STATE {entity_id}"
            f" {old.get('state')} -> {new.get('state')}"
            f" mode={attrs.get('color_mode')}"
            f" {attrs.get('color_temp_kelvin')}K"
            f" hs={attrs.get('hs_color')}"
            f" {pct}%"
            f" ctx={(ctx.get('id') or '-')[:8]}"
            f" parent={(ctx.get('parent_id') or '-')[:8]}"
        )

    return on_call_service, on_state_changed


async def run(args: argparse.Namespace) -> int:
    entities = {e.strip() for e in args.entities.split(",") if e.strip()} or None
    domains = {d.strip() for d in args.domains.split(",") if d.strip()}
    on_call, on_state = make_handlers(domains, entities)

    async with HAClient(args.url, args.token) as client:
        await client.subscribe_events("call_service", on_call)
        if not args.calls_only:
            await client.subscribe_events("state_changed", on_state)

        print(f"watching domains {sorted(domains)}", end="")
        print(f" for {sorted(entities)}" if entities else " (all entities)")
        print("\nwork through these one at a time, pausing between them:")
        for phrase in PHRASES:
            print(f"  - {phrase}")
        print("\nctrl-c when done.\n")

        while True:
            await asyncio.sleep(3600)


def main() -> int:
    load_env_file(HERE / ".env")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.environ.get("HA_URL", "http://homeassistant.local:8123"))
    parser.add_argument("--token", default=os.environ.get("HA_TOKEN", ""))
    parser.add_argument(
        "--entities",
        default=os.environ.get("LIGHTCURVE_SPIKE_ENTITIES", ""),
        help="restrict to these entity_ids; empty means every light",
    )
    parser.add_argument("--domains", default="light")
    parser.add_argument("--calls-only", action="store_true", help="hide state_changed noise")
    args = parser.parse_args()

    if not args.token:
        print("no token; set HA_TOKEN in spike/.env or pass --token")
        return 2
    try:
        return asyncio.run(run(args))
    except KeyboardInterrupt:
        print("\nstopped.")
        return 0
    except HAError as err:
        print(f"\nfailed: {err}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
