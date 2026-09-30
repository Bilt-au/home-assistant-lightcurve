#!/usr/bin/env python3
"""List every light in the house, grouped by Home Assistant area.

Answers the immediate question ("what are my toilet lights actually called?") and
doubles as a look at the data Lightcurve's area-based grouping will run on: which
areas have lights, what those lights can do, and whether their capabilities match
within an area.

    python discover.py                 # everything, grouped by area
    python discover.py --grep toilet   # just the ones matching
    python discover.py --area Toilet   # one area, with a pasteable .env line
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from typing import Any

from ha_client import TRANSITION_FEATURE, HAClient, HAError
from probe import HERE, load_env_file

NO_AREA = "(no area)"


async def load_registries(client: HAClient) -> tuple[dict, dict, dict]:
    """Area/device/entity registries. Needs an admin token; degrades if refused."""
    try:
        areas = {a["area_id"]: a for a in await client._command({"type": "config/area_registry/list"})}
        devices = {d["id"]: d for d in await client._command({"type": "config/device_registry/list"})}
        entities = {
            e["entity_id"]: e
            for e in await client._command({"type": "config/entity_registry/list"})
        }
        return areas, devices, entities
    except HAError as err:
        print(f"  (no registry access - {err}; falling back to a flat list)\n")
        return {}, {}, {}


def area_of(entity_id: str, devices: dict, entities: dict, areas: dict) -> str:
    entry = entities.get(entity_id) or {}
    area_id = entry.get("area_id")
    if not area_id and entry.get("device_id"):
        area_id = (devices.get(entry["device_id"]) or {}).get("area_id")
    if not area_id:
        return NO_AREA
    return (areas.get(area_id) or {}).get("name") or area_id


def describe(state: dict, entities: dict, devices: dict) -> dict[str, Any]:
    attrs = state.get("attributes") or {}
    entry = entities.get(state["entity_id"]) or {}
    device = devices.get(entry.get("device_id") or "") or {}
    features = attrs.get("supported_features") or 0
    modes = attrs.get("supported_color_modes") or []
    return {
        "entity_id": state["entity_id"],
        "name": attrs.get("friendly_name") or state["entity_id"],
        "state": state.get("state"),
        "platform": entry.get("platform") or "?",
        "model": device.get("model") or "",
        "modes": modes,
        "kelvin": (
            f"{attrs.get('min_color_temp_kelvin')}-{attrs.get('max_color_temp_kelvin')}"
            if "color_temp" in modes
            else "-"
        ),
        "transition": bool(features & TRANSITION_FEATURE),
        "capability_key": (tuple(sorted(modes)), attrs.get("min_color_temp_kelvin"),
                           attrs.get("max_color_temp_kelvin")),
    }


async def run(args: argparse.Namespace) -> int:
    async with HAClient(args.url, args.token) as client:
        areas, devices, entities = await load_registries(client)
        had_registry = bool(areas or devices or entities)
        states = [s for s in await client.get_states() if s["entity_id"].startswith("light.")]

    if not states:
        print("no light entities found at all - is this the right HA instance?")
        return 1

    grouped: dict[str, list[dict]] = {}
    for state in states:
        info = describe(state, entities, devices)
        needle = args.grep.lower() if args.grep else None
        if needle and needle not in info["entity_id"].lower() and needle not in info["name"].lower():
            continue
        area = area_of(state["entity_id"], devices, entities, areas)
        if args.area and area.lower() != args.area.lower():
            continue
        grouped.setdefault(area, []).append(info)

    if not grouped:
        print("nothing matched. Run without --grep/--area to see everything.")
        return 1

    total = 0
    for area in sorted(grouped, key=lambda a: (a == NO_AREA, a)):
        lights = sorted(grouped[area], key=lambda i: i["entity_id"])
        total += len(lights)
        print(f"\n{area}  ({len(lights)} light{'s' if len(lights) != 1 else ''})")
        for info in lights:
            flags = []
            if not info["transition"]:
                flags.append("no-transition")
            if "color_temp" not in info["modes"]:
                flags.append("no-CT")
            if not ({"hs", "rgb", "rgbw", "rgbww", "xy"} & set(info["modes"])):
                flags.append("no-colour")
            suffix = f"  [{', '.join(flags)}]" if flags else ""
            print(f"    {info['entity_id']}")
            print(
                f"        {info['name']}  ({info['state']})  {info['platform']}"
                f" {info['model']}".rstrip()
            )
            print(
                f"        modes={info['modes']}  kelvin={info['kelvin']}{suffix}"
            )
        # A group can only be driven as one unit if its members agree on capabilities.
        keys = {i["capability_key"] for i in lights}
        if len(keys) > 1:
            print("    !! members do NOT share capabilities - the wrapper would have")
            print("       to fall back to the intersection of what they all support")
        if args.area or args.grep:
            print(
                "\n    paste into spike/.env:\n"
                f"    LIGHTCURVE_SPIKE_ENTITIES={','.join(i['entity_id'] for i in lights)}"
            )

    areas_found = len(grouped)
    print(
        f"\n{total} light entit{'y' if total == 1 else 'ies'}"
        f" in {areas_found} area{'' if areas_found == 1 else 's'}"
    )
    # Without registry access everything lands in NO_AREA, which is a token
    # problem, not an HA configuration problem. Don't send them off to fix the
    # wrong thing.
    if not had_registry:
        print(
            "Areas were unavailable, so everything is listed as (no area). Use an"
            " admin token to see the real grouping."
        )
    elif NO_AREA in grouped:
        count = len(grouped[NO_AREA])
        subject, verb, obj = (
            ("light", "has", "it") if count == 1 else ("lights", "have", "them")
        )
        print(
            f"{count} {subject} {verb} no area. Assign {obj} in HA (Settings >"
            " Devices) - area-based grouping will skip it otherwise."
            if count == 1
            else f"{count} {subject} {verb} no area. Assign {obj} in HA (Settings >"
            " Devices) - area-based grouping will skip them otherwise."
        )
    return 0


def main() -> int:
    load_env_file(HERE / ".env")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.environ.get("HA_URL", "http://homeassistant.local:8123"))
    parser.add_argument("--token", default=os.environ.get("HA_TOKEN", ""))
    parser.add_argument("--grep", default="", help="filter by entity_id or friendly name")
    parser.add_argument("--area", default="", help="only this area, with a pasteable .env line")
    args = parser.parse_args()
    if not args.token:
        print("no token; set HA_TOKEN in spike/.env or pass --token")
        return 2
    try:
        return asyncio.run(run(args))
    except KeyboardInterrupt:
        return 130
    except HAError as err:
        print(f"failed: {err}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
