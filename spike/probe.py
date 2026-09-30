#!/usr/bin/env python3
"""Lightcurve hardware spike: measure what Tapo L630 bulbs actually do via HA.

Five numbers decide the Lightcurve scheduler design, and none of them can be
looked up:

  1. Does `transition` work at all?          -> tick length, smoothness strategy
  2. How slow is a command, alone and in a   -> per-bulb rate limit, gather width
     batch of N?
  3. How far does reported state drift from  -> override tolerances (spec 10.1)
     what was sent?
  4. Can colour + brightness + on land in    -> the whole no-flash premise
     one call with no intermediate state?
  5. Do post-command state writes carry our  -> whether context filtering alone
     context or a fresh one?                    can prevent false overrides

Run `probe.py all` for everything, or a single subcommand while iterating.
Every probe restores the lights to the state it found them in.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ha_client import TRANSITION_FEATURE, HAClient, HAError, Sample, StateRecorder

HERE = Path(__file__).parent
RESULTS_DIR = HERE / "results"


# --------------------------------------------------------------------------- env


def load_env_file(path: Path) -> None:
    """Read a KEY=value file into os.environ without pulling in python-dotenv."""
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


# ----------------------------------------------------------------------- helpers


async def settle(
    recorder: StateRecorder,
    entity_id: str,
    since: float,
    quiet: float = 1.5,
    timeout: float = 12.0,
) -> Sample | None:
    """Wait for a state write later than `since`, then for `quiet` seconds of silence.

    Returns None when no write arrived at all within `timeout`. That distinction
    matters: without it, "nothing has arrived yet" reads as "settled", and the
    caller records the *previous* value as though it were the device's answer —
    which would quietly corrupt the rounding numbers.
    """
    started = time.monotonic()
    saw_fresh = False
    while time.monotonic() - started < timeout:
        last = recorder.last_event_time(entity_id)
        if last is not None and last >= since:
            saw_fresh = True
            if time.monotonic() - last >= quiet:
                break
        await asyncio.sleep(0.2)
    return recorder.latest(entity_id) if saw_fresh else None


@dataclass
class Applied:
    """One command and the device state that followed it."""

    sent_at: float
    elapsed_ms: int
    context: str | None
    sample: Sample | None  # None means the device never reported back in time

    @property
    def confirmed(self) -> bool:
        return self.sample is not None


async def apply(
    client: HAClient, entity_id: str, **data: Any
) -> tuple[str | None, float]:
    """light.turn_on with transition 0 unless told otherwise; returns (context id, seconds)."""
    data.setdefault("transition", 0)
    result, elapsed = await client.call_service(
        "light", "turn_on", data, {"entity_id": entity_id}
    )
    context = (result.get("context") or {}).get("id")
    return context, elapsed


async def apply_many(
    client: HAClient, entities: list[str], **data: Any
) -> tuple[str | None, float]:
    """Send the same command to every entity concurrently.

    Driving the whole fixture matters for the probes judged by eye: one bulb
    changing while its neighbour sits at a different colour makes a brief flash
    much harder to see than both moving together.
    """
    started = time.monotonic()
    results = await asyncio.gather(
        *(apply(client, entity, **data) for entity in entities), return_exceptions=True
    )
    first = results[0]
    if isinstance(first, BaseException):
        raise first
    return first[0], time.monotonic() - started


async def turn_off_many(client: HAClient, entities: list[str]) -> float:
    sent_at = time.monotonic()
    await asyncio.gather(
        *(
            client.call_service("light", "turn_off", {"transition": 0}, {"entity_id": e})
            for e in entities
        ),
        return_exceptions=True,
    )
    return sent_at


async def apply_and_settle(
    client: HAClient,
    recorder: StateRecorder,
    entities: list[str],
    quiet: float = 1.5,
    **data: Any,
) -> Applied:
    """Send a command to every entity, then wait for the first one's answer."""
    sent_at = time.monotonic()
    context, elapsed = await apply_many(client, entities, **data)
    sample = await settle(recorder, entities[0], since=sent_at, quiet=quiet)
    return Applied(sent_at, round(elapsed * 1000), context, sample)


async def ask(question: str, skip: bool) -> str:
    """Some findings only eyes can settle. Returns '' when prompting is disabled."""
    if skip:
        return ""
    print(f"\n  ?? {question}")
    answer = await asyncio.to_thread(input, "     your answer: ")
    return answer.strip()


def serialise(samples: list[Sample], t0: float) -> list[dict]:
    """Samples for the JSON report, with times relative to the command."""
    rows = []
    for sample in samples:
        row = dict(sample.__dict__)
        row["offset_s"] = round(sample.at - t0, 3)
        row.pop("at", None)
        rows.append(row)
    return rows


def trace_table(
    samples: list[Sample], t0: float, leftover: set[int] | None = None
) -> list[str]:
    lines = ["      t(s)  state                         ctx"]
    for index, s in enumerate(samples):
        mark = "   (leftover)" if leftover and index in leftover else ""
        lines.append(
            f"     {s.at - t0:5.2f}  {s.summary():<28}  {(s.context_id or '-')[:8]}{mark}"
        )
    return lines


def pct_of_255(brightness: int | None) -> int | None:
    return None if brightness is None else round(brightness / 255 * 100)


# ------------------------------------------------------------------------ probe 1


async def probe_info(client: HAClient, entities: list[str]) -> dict:
    """Capabilities as HA sees them. Cheap, read-only, and it validates the setup."""
    print("\n=== capabilities ===")
    out: dict[str, Any] = {}
    for entity_id in entities:
        state = await client.get_state(entity_id)
        attrs = state.get("attributes") or {}
        features = attrs.get("supported_features") or 0
        info = {
            "state": state.get("state"),
            "supported_color_modes": attrs.get("supported_color_modes"),
            "min_color_temp_kelvin": attrs.get("min_color_temp_kelvin"),
            "max_color_temp_kelvin": attrs.get("max_color_temp_kelvin"),
            "supported_features": features,
            "supports_transition": bool(features & TRANSITION_FEATURE),
            "color_mode": attrs.get("color_mode"),
            "effect": attrs.get("effect"),
            "effect_list": attrs.get("effect_list"),
        }
        out[entity_id] = info
        print(f"  {entity_id}")
        print(f"    state           {info['state']} ({info['color_mode']})")
        print(f"    colour modes    {info['supported_color_modes']}")
        print(
            f"    kelvin range    {info['min_color_temp_kelvin']}"
            f"-{info['max_color_temp_kelvin']}"
        )
        print(
            f"    transition      {'YES' if info['supports_transition'] else 'NO'}"
            f"  (supported_features={features})"
        )
        # An active Tapo light effect overrides colour commands, so it would fight
        # everything Lightcurve does. Worth knowing before blaming the scheduler.
        # "off" is a *value* of the effect attribute, not the absence of one, so a
        # plain truthiness check reports every bulb as running an effect.
        active = info["effect"] not in (None, "", "off", "None")
        available = info["effect_list"] or []
        if active:
            print(f"    effect          {info['effect']}  <-- ACTIVE, will fight the curve")
        elif available:
            print(f"    effect          none active, {len(available)} available")
            print(f"                    {', '.join(str(e) for e in available)}")
        else:
            print("    effect          none active, none offered")
    return out


# ------------------------------------------------------------------------ probe 2


async def probe_onestep(
    client: HAClient, targets: list[str], recorder: StateRecorder, skip_prompts: bool
) -> dict:
    """The acceptance-critical test: on + colour + brightness in ONE call, no flash.

    Parks the bulb at a deliberately wrong colour, turns it off, then turns it on
    at the opposite end of the curve in a single service call. Any state_changed
    that reports `on` at the old colour before reaching the target is a flash HA
    can see; a flash HA cannot see still needs your eyes.
    """
    entity_id = targets[0]  # traces and analysis follow the first bulb
    print("\n=== one-call turn-on (no flash) ===")
    wrong = {"color_temp_kelvin": 6500, "brightness_pct": 100}
    target = {"color_temp_kelvin": 2200, "brightness_pct": 10}

    await apply_and_settle(client, recorder, targets, **wrong)
    off_at = await turn_off_many(client, targets)
    await settle(recorder, entity_id, since=off_at)

    t0 = time.monotonic()
    context, elapsed = await apply_many(client, targets, **target)
    print(f"  single call returned in {elapsed * 1000:.0f} ms")
    await asyncio.sleep(5.0)

    samples = recorder.samples(entity_id, since=t0)
    for line in trace_table(samples, t0):
        print(line)

    stale = [
        s
        for s in samples
        if s.state == "on" and s.kelvin is not None and abs(s.kelvin - 2200) > 400
    ]
    if stale:
        print(f"  !! {len(stale)} state write(s) reported ON at the OLD colour first")
    else:
        print("  -- no stale-colour state write observed")

    visible = await ask(
        "Did the bulb visibly flash bright/cool before settling to dim warm? (y/n/notes)",
        skip_prompts,
    )
    return {
        "call_ms": round(elapsed * 1000),
        "context": context,
        "trace": serialise(samples, t0),
        "stale_colour_writes": len(stale),
        "observed_flash": visible,
    }


async def probe_coldon(
    client: HAClient,
    targets: list[str],
    recorder: StateRecorder,
    skip_prompts: bool,
    window: float = 12.0,
) -> dict:
    """Does on + colour + brightness really land atomically from cold?

    `onestep` reported no stale-colour state write, yet the bulb visibly flashed.
    That points at the bulb restoring its previous on-state and only then applying
    the new one — a flash happening inside the firmware, below HA's visibility.

    The question that decides whether it can be mitigated: does the flash track
    the *difference* between the old state and the new target? If it does, keeping
    each bulb's stored state near the curve is a real fix. If it flashes even when
    old and new are identical, nothing Lightcurve does from the HA side will help.

    Scenario 1 also settles whether the bulb restores its last on-state at all: it
    turns on with no parameters and records where the bulb lands.
    """
    entity_id = targets[0]  # traces and analysis follow the first bulb
    print("\n=== cold turn-on, scenario by scenario ===")
    warm = {"color_temp_kelvin": 2200, "brightness_pct": 10}
    cool = {"color_temp_kelvin": 6500, "brightness_pct": 100}
    scenarios: list[tuple[str, dict, dict | None]] = [
        ("restore check", cool, None),  # bare turn_on: where does it go?
        ("identical", warm, dict(warm)),
        ("brightness only", {"color_temp_kelvin": 2200, "brightness_pct": 100}, dict(warm)),
        ("colour only", {"color_temp_kelvin": 6500, "brightness_pct": 10}, dict(warm)),
        ("both", cool, dict(warm)),
        ("both reversed", warm, dict(cool)),
    ]

    rows: list[dict] = []
    for label, pre, target in scenarios:
        print(f"\n  {label}: {pre} -> off -> {target or 'turn_on with no parameters'}")
        await apply_and_settle(client, recorder, targets, **pre)
        off_at = await turn_off_many(client, targets)
        await settle(recorder, entity_id, since=off_at)
        await asyncio.sleep(1.0)  # let the bulb sit off for a beat

        t0 = time.monotonic()
        _, elapsed = await apply_many(client, targets, **(target or {}))
        await asyncio.sleep(window)
        samples = [s for s in recorder.samples(entity_id, since=t0) if s.state == "on"]
        for line in trace_table(samples, t0):
            print(line)

        want_k = (target or pre)["color_temp_kelvin"]
        want_b = (target or pre)["brightness_pct"]
        k_dev = max((abs(s.kelvin - want_k) for s in samples if s.kelvin is not None), default=None)
        b_dev = max(
            (abs(s.brightness_pct - want_b) for s in samples if s.brightness_pct is not None),
            default=None,
        )
        # Tolerant rather than exact: this bulb reports faithfully, but a future
        # one may round, and "never settled" would then be a false alarm.
        settled = next(
            (
                s
                for s in samples
                if s.kelvin is not None
                and abs(s.kelvin - want_k) <= 60
                and s.brightness_pct is not None
                and abs(s.brightness_pct - want_b) <= 2
            ),
            None,
        )
        row = {
            "scenario": label,
            "pre": pre,
            "target": target,
            "call_ms": round(elapsed * 1000),
            "trace": serialise(samples, t0),
            "max_kelvin_deviation": k_dev,
            "max_brightness_deviation": b_dev,
            "reached_target_after_s": round(settled.at - t0, 2) if settled else None,
        }
        reached = row["reached_target_after_s"]
        print(
            f"    worst deviation from target: {k_dev}K, {b_dev}% brightness;"
            f" {f'settled after {reached}s' if reached is not None else 'NEVER reached target'}"
        )
        row["observed"] = await ask(
            f"[{label}] what did you SEE? (none / brief flash / obvious flash + notes)",
            skip_prompts,
        )
        rows.append(row)

    print("\n  summary")
    print("      scenario          worst dK  worst dB%  settled  you saw")
    for row in rows:
        print(
            f"     {row['scenario']:<16}  {str(row['max_kelvin_deviation']):>8}"
            f"  {str(row['max_brightness_deviation']):>9}"
            f"  {('never' if row['reached_target_after_s'] is None else str(row['reached_target_after_s'])):>7}"
            f"  {row['observed'][:28]}"
        )
    return {"window_s": window, "scenarios": rows}


async def probe_coldbrightness(
    client: HAClient,
    targets: list[str],
    recorder: StateRecorder,
    skip_prompts: bool,
    total: float = 90.0,
) -> dict:
    """After a cold turn-on, is the BULB wrong or only the REPORT?

    `coldon` found reported brightness pinned at 71 % after every cold turn-on,
    whatever was asked for, and never correcting inside 12 s — while kelvin came
    back exact. Two possibilities, with very different consequences:

      * the report is stale and the bulb is really at the requested brightness.
        Cosmetic, except that override detection would see a 61 % discrepancy and
        flag a false brightness override on every single turn-on.

      * the bulb genuinely ignores brightness on a cold turn-on. Then FR-9's
        "single command per bulb" is impossible and §9 needs a corrective second
        write after every turn-on.

    The test: turn on cold at 10 %, watch the report while forcing refreshes, then
    re-send the same 10 % with the bulb already on. If the bulb visibly dims at
    that moment it really was bright, and the first command did not take.
    """
    entity_id = targets[0]
    print("\n=== cold turn-on: is the bulb wrong, or the report? ===")

    await apply_and_settle(
        client, recorder, targets, color_temp_kelvin=6500, brightness_pct=100
    )
    off_at = await turn_off_many(client, targets)
    await settle(recorder, entity_id, since=off_at)
    await asyncio.sleep(1.0)

    t0 = time.monotonic()
    _, elapsed = await apply_many(client, targets, color_temp_kelvin=2200, brightness_pct=10)
    print(f"  cold turn-on at 2200K/10% took {elapsed * 1000:.0f} ms")

    # Force refreshes rather than waiting on the coordinator's own schedule.
    checkpoints = [2.0, 5.0, 10.0, 20.0, 40.0, 60.0, total]
    observations: list[dict] = []
    for when in checkpoints:
        remaining = when - (time.monotonic() - t0)
        if remaining > 0:
            await asyncio.sleep(remaining)
        try:
            await client.call_service(
                "homeassistant", "update_entity", {}, {"entity_id": entity_id}
            )
        except HAError as err:
            print(f"    (forced refresh refused: {err})")
        await asyncio.sleep(1.0)
        latest = recorder.latest(entity_id)
        row = {
            "at_s": round(when, 1),
            "reported_pct": latest.brightness_pct if latest else None,
            "kelvin": latest.kelvin if latest else None,
            "color_mode": latest.color_mode if latest else None,
        }
        observations.append(row)
        print(
            f"    +{row['at_s']:5.1f}s  reported {row['reported_pct']}%"
            f"  {row['kelvin']}K  mode={row['color_mode']}"
        )

    corrected_at = next(
        (
            o["at_s"]
            for o in observations
            if o["reported_pct"] is not None and abs(o["reported_pct"] - 10) <= 2
        ),
        None,
    )
    if corrected_at is None:
        print(f"  !! reported brightness never corrected within {total:.0f}s")
    else:
        print(f"  -- reported brightness corrected by +{corrected_at}s")

    # The decisive step: re-send the value it should already hold.
    print("\n  now re-sending the SAME 2200K/10% with the bulb already on.")
    resend = await apply_and_settle(
        client, recorder, targets, color_temp_kelvin=2200, brightness_pct=10
    )
    print(
        f"    after re-send, reported"
        f" {resend.sample.brightness_pct if resend.sample else None}%"
    )
    observed = await ask(
        "Did the bulb VISIBLY dim at the re-send? (yes = the cold turn-on ignored"
        " brightness / no = only the report was wrong)",
        skip_prompts,
    )

    return {
        "cold_call_ms": round(elapsed * 1000),
        "observations": observations,
        "report_corrected_at_s": corrected_at,
        "reported_after_resend": resend.sample.brightness_pct if resend.sample else None,
        "observed_dim_on_resend": observed,
    }


async def probe_colours(
    client: HAClient,
    targets: list[str],
    recorder: StateRecorder,
    skip_prompts: bool,
) -> dict:
    """Can this bulb actually do a dim saturated red, and how bad is the mode switch?

    Driven by the requirement for a red night section from 20:00 to 04:00. Three
    things have to hold for that to work:

      1. Hue fidelity — does a requested hue come back as itself?
      2. Dim saturated red. Night red wants to be dim, and RGB bulbs often fail
         exactly there: the red channel quantises to a few steps near the bottom,
         so 5 % either washes out towards pink or drops out altogether. This is
         the make-or-break test for the whole idea.
      3. The CT<->RGB switch. `modes` already showed a visible jump that HA cannot
         see. Here it is measured at the brightness the boundary keyframes would
         actually use, since the jump matters far less at 20 % than at 80 %.

    A red->warm-white ramp is also walked by hand, because red (hue 0) to 2200 K
    (hue ~27) is a short hue path and should look like a natural sunset. Whether it
    does in practice is the point.
    """
    entity_id = targets[0]
    print("\n=== colour: dim red, hue fidelity, and the mode switch ===")
    results: dict[str, Any] = {}

    print("\n  hue fidelity at 30%")
    print("      sent hue/sat   reported        delta")
    fidelity: list[dict] = []
    for hue, sat in [(0, 100), (15, 100), (30, 100), (345, 100), (0, 80), (0, 60)]:
        applied = await apply_and_settle(
            client, recorder, targets, hs_color=[hue, sat], brightness_pct=30
        )
        got = applied.sample.hs if applied.sample else None
        delta = None if not got else round(abs(got[0] - hue), 1)
        fidelity.append({"sent": [hue, sat], "reported": got, "hue_delta": delta,
                         "mode": applied.sample.color_mode if applied.sample else None})
        print(f"     {hue:4d}/{sat:<3d}       {str(got):<16} {str(delta):>6}")
    results["hue_fidelity"] = fidelity

    print("\n  dim saturated red - the make-or-break test")
    dim: list[dict] = []
    for pct in [30, 20, 10, 5, 2, 1]:
        applied = await apply_and_settle(
            client, recorder, targets, hs_color=[0, 100], brightness_pct=pct
        )
        sample = applied.sample
        row = {
            "sent_pct": pct,
            "reported_pct": sample.brightness_pct if sample else None,
            "reported_hs": sample.hs if sample else None,
            "state": sample.state if sample else None,
        }
        dim.append(row)
        print(
            f"     {pct:3d}% -> reported {row['reported_pct']}%"
            f"  hs={row['reported_hs']}  state={row['state']}"
        )
        row["observed"] = await ask(
            f"[red at {pct}%] still properly RED and visible? (good / washed out /"
            " pink / off / notes)",
            skip_prompts,
        )
    results["dim_red"] = dim

    print("\n  the CT <-> RGB switch, at the brightness a boundary keyframe would use")
    switch: list[dict] = []
    for label, data in [
        ("warm white 2200K/20%", {"color_temp_kelvin": 2200, "brightness_pct": 20}),
        ("red 20%", {"hs_color": [0, 100], "brightness_pct": 20}),
        ("warm white 2200K/20% again", {"color_temp_kelvin": 2200, "brightness_pct": 20}),
    ]:
        applied = await apply_and_settle(client, recorder, targets, **data)
        sample = applied.sample
        switch.append({
            "step": label,
            "sent": data,
            "mode": sample.color_mode if sample else None,
            "reported_pct": sample.brightness_pct if sample else None,
        })
        print(f"     {label:<28} -> mode={switch[-1]['mode']} {switch[-1]['reported_pct']}%")
    results["mode_switch"] = switch
    results["mode_switch_observed"] = await ask(
        "At 20%, how bad was the jump between warm white and red? (none / slight /"
        " jarring + notes)",
        skip_prompts,
    )

    print("\n  red -> warm white ramp, walked by hand at 25%")
    ramp: list[dict] = []
    for hue, sat in [(0, 100), (6, 96), (12, 92), (18, 89), (24, 86), (27, 85)]:
        applied = await apply_and_settle(
            client, recorder, targets, quiet=0.8, hs_color=[hue, sat], brightness_pct=25
        )
        ramp.append({"sent": [hue, sat],
                     "reported": applied.sample.hs if applied.sample else None})
        print(f"     hue {hue:3d} sat {sat:3d} -> {ramp[-1]['reported']}")
    results["ramp"] = ramp
    results["ramp_observed"] = await ask(
        "Did that read as a smooth sunset, or as visible steps? (smooth / steps +"
        " notes)",
        skip_prompts,
    )
    return results


async def probe_warmup(
    client: HAClient,
    targets: list[str],
    recorder: StateRecorder,
    skip_prompts: bool,
) -> dict:
    """Find a cold turn-on recipe that actually lands at the requested brightness.

    `coldbrightness` settled it: the bulb ignores brightness on a cold turn-on. It
    came up at 71 %, stayed there for 90 s of forced refreshes, and only dimmed when
    the same 10 % was re-sent with the bulb already on — which was visible. So the
    report was accurate and the *command* did not take.

    That kills FR-9's one-command-per-bulb as written. The remaining question is what
    the cheapest correct sequence is, and how long the bulb sits visibly bright
    before it lands. Recipes tried:

      * brightness with no colour at all — maybe the colour argument is what breaks it
      * colour+brightness, then a brightness-only correction after a varying delay,
        to find the shortest delay that reliably takes
      * colour first, then brightness as a separate command

    The delay sweep is the useful part: if 0 ms works, the correction can ride
    straight behind the turn-on and the bright moment is one round trip. If it needs
    a second, every turn-on in the house flashes bright for a second.
    """
    entity_id = targets[0]
    print("\n=== cold turn-on: finding a recipe that sticks ===")
    want = 10

    async def park_and_off() -> None:
        await apply_and_settle(
            client, recorder, targets, color_temp_kelvin=6500, brightness_pct=100
        )
        off_at = await turn_off_many(client, targets)
        await settle(recorder, entity_id, since=off_at)
        await asyncio.sleep(1.0)

    dwell_rows: list[dict] = []
    rows: list[dict] = []

    async def record(label: str, started: float, note: str = "") -> dict:
        sample = await settle(recorder, entity_id, since=started, quiet=2.0)
        got = sample.brightness_pct if sample else None
        took = got is not None and abs(got - want) <= 2
        row = {
            "recipe": label,
            "total_ms": round((time.monotonic() - started) * 1000),
            "reported_pct": got,
            "landed": took,
            "note": note,
        }
        print(
            f"    -> reported {got}%  after {row['total_ms']} ms"
            f"  {'LANDED' if took else 'DID NOT LAND'}"
        )
        rows.append(row)
        return row

    # 0. Does holding a state before switching off make last-state restore work?
    #
    # Power-on behaviour is already set to "last state", yet a cold turn-on came up
    # at 71 % — the value from the start of the session, not the 100 % it was left
    # at moments earlier. That points at the bulb persisting its last state lazily
    # rather than on every command, which the earlier probes could never satisfy
    # because they changed state every few seconds. A real curve holds a value for
    # minutes. If a dwell is all it takes, no corrective write is needed in normal
    # operation and this whole section is moot.
    print("\n  does dwelling before off make last-state restore work?")
    print("      dwell   reported after cold on   landed")
    for dwell in (0, 15, 60):
        await apply_and_settle(
            client, recorder, targets, color_temp_kelvin=2200, brightness_pct=want
        )
        if dwell:
            print(f"     holding at 2200K/{want}% for {dwell}s...")
            await asyncio.sleep(dwell)
        off_at = await turn_off_many(client, targets)
        await settle(recorder, entity_id, since=off_at)
        await asyncio.sleep(1.0)

        started = time.monotonic()
        # Deliberately NO correction: this is the unaided cold turn-on.
        await apply_many(client, targets, color_temp_kelvin=2200, brightness_pct=want)
        sample = await settle(recorder, entity_id, since=started, quiet=2.0)
        got = sample.brightness_pct if sample else None
        landed = got is not None and abs(got - want) <= 2
        dwell_rows.append({"dwell_s": dwell, "reported_pct": got, "landed": landed})
        print(f"     {dwell:4d}s   {str(got):>22}%   {'yes' if landed else 'NO'}")

    if any(r["landed"] for r in dwell_rows):
        shortest = min(r["dwell_s"] for r in dwell_rows if r["landed"])
        print(f"\n  -- a {shortest}s dwell is enough; corrective writes may be unnecessary")
    else:
        print("\n  -- dwelling did not help; a corrective write is needed")
    dwell_observed = await ask(
        "After the 60s-dwell cold turn-on, did the bulb come up DIM (correct) or"
        " BRIGHT then drop? (dim / bright / notes)",
        skip_prompts,
    )

    # 1. brightness only, no colour argument at all
    print(f"\n  brightness only, no colour ({want}%)")
    await park_and_off()
    started = time.monotonic()
    await apply_many(client, targets, brightness_pct=want)
    await record("brightness only", started)

    # 2. colour+brightness, then a brightness-only correction after a delay
    for delay in (0.0, 0.25, 0.5, 1.0, 2.0):
        print(f"\n  colour+brightness, then brightness again after {delay:.2f}s")
        await park_and_off()
        started = time.monotonic()
        await apply_many(client, targets, color_temp_kelvin=2200, brightness_pct=want)
        if delay:
            await asyncio.sleep(delay)
        await apply_many(client, targets, brightness_pct=want)
        await record(f"correction after {delay:.2f}s", started)

    # 3. colour first, brightness as a separate second command
    print("\n  colour first, then brightness separately")
    await park_and_off()
    started = time.monotonic()
    await apply_many(client, targets, color_temp_kelvin=2200)
    await apply_many(client, targets, brightness_pct=want)
    await record("colour then brightness", started)

    print("\n  summary")
    print("      recipe                      total ms  reported  landed")
    for row in rows:
        print(
            f"     {row['recipe']:<26}  {row['total_ms']:>8}"
            f"  {str(row['reported_pct']):>8}  {'yes' if row['landed'] else 'NO'}"
        )

    winners = [r for r in rows if r["landed"]]
    if winners:
        best = min(winners, key=lambda r: r["total_ms"])
        print(f"\n  cheapest recipe that lands: {best['recipe']} ({best['total_ms']} ms)")
    else:
        print("\n  !! nothing landed - the bulb may need a longer settle before it")
        print("     will accept brightness at all")

    observed = await ask(
        "Across those runs, how long was the bulb visibly too bright before it"
        " dropped? (imperceptible / brief / about a second / longer + notes)",
        skip_prompts,
    )
    return {
        "target_pct": want,
        "dwell": dwell_rows,
        "dwell_observed": dwell_observed,
        "recipes": rows,
        "observed": observed,
    }


async def probe_interference(
    client: HAClient, targets: list[str], recorder: StateRecorder, seconds: float = 180.0
) -> dict:
    """Is anything else in Home Assistant writing to these bulbs?

    Several earlier findings assumed Lightcurve's probe was the only thing talking to
    the bulbs. If something else adapts them — the Adaptive Lighting integration,
    HomeKit's own adaptive lighting, a scene, an automation — then "the bulb ignored
    the brightness" really means "something else overwrote it a moment later", and
    the cold turn-on results measured that instead of the hardware.

    Two checks. First, look for the usual suspect by name and see whether it lists
    these bulbs. Second, send nothing at all for a few minutes and watch: with no
    commands of our own, *any* service call or state change on these entities came
    from somewhere else. The gap between repeats is the useful fingerprint — the
    Adaptive Lighting integration defaults to a 90 second interval.
    """
    print(f"\n=== interference check ({seconds:.0f}s idle) ===")
    found: list[dict] = []
    states = await client.get_states()
    for state in states:
        entity_id = state["entity_id"]
        if "adaptive_lighting" not in entity_id:
            continue
        attrs = state.get("attributes") or {}
        configured = attrs.get("lights") or (attrs.get("configuration") or {}).get("lights") or []
        overlap = sorted(set(configured) & set(targets))
        found.append(
            {
                "entity_id": entity_id,
                "state": state.get("state"),
                "configured_lights": configured,
                "overlaps_targets": overlap,
            }
        )
        flag = "  <-- COVERS THESE BULBS" if overlap else ""
        print(f"  {entity_id}  =  {state.get('state')}{flag}")
        if overlap:
            print(f"      overlapping: {overlap}")
    if not found:
        print("  no adaptive_lighting entities found")

    calls: list[dict] = []
    changes: list[dict] = []

    def on_call(event: dict) -> None:
        data = event.get("data") or {}
        if data.get("domain") != "light":
            return
        target = (data.get("service_data") or {}).get("entity_id") or (
            (data.get("target") or {}).get("entity_id")
        )
        names = {target} if isinstance(target, str) else set(target or [])
        if names and not (names & set(targets)):
            return
        ctx = event.get("context") or {}
        calls.append(
            {
                "at": time.monotonic(),
                "service": data.get("service"),
                "service_data": data.get("service_data"),
                "target": data.get("target"),
                "user_id": ctx.get("user_id"),
                "parent_id": ctx.get("parent_id"),
            }
        )
        print(
            f"    !! light.{data.get('service')} from elsewhere:"
            f" {data.get('service_data')}  user={(ctx.get('user_id') or '-')[:8]}"
        )

    subscription = await client.subscribe_events("call_service", on_call)
    print("\n  sending nothing. Leave the lights ON and do not touch them.")
    baseline = recorder.latest(targets[0])
    started = time.monotonic()
    await asyncio.sleep(seconds)
    await client.unsubscribe(subscription)

    for sample in recorder.samples(targets[0], since=started):
        changes.append(
            {
                "offset_s": round(sample.at - started, 2),
                "summary": sample.summary(),
                "context_id": sample.context_id,
            }
        )

    print(f"\n  foreign service calls : {len(calls)}")
    print(f"  state changes         : {len(changes)}")
    for change in changes:
        print(f"    +{change['offset_s']:6.1f}s  {change['summary']}")
    gaps = [
        round(b["at"] - a["at"], 1) for a, b in zip(calls, calls[1:])
    ]
    if gaps:
        print(f"  gaps between foreign calls: {gaps}s")
        if any(80 <= g <= 100 for g in gaps):
            print("  -> ~90s spacing: that is the Adaptive Lighting default interval")
    if calls or changes:
        print("\n  !! something else is writing to these bulbs.")
        print("     Disable it, then re-run: probe.py coldon, coldbrightness, warmup")
    else:
        print("\n  -- nothing else touched them; the earlier results stand")

    return {
        "idle_seconds": seconds,
        "adaptive_lighting_entities": found,
        "foreign_calls": calls,
        "state_changes": changes,
        "gaps_s": gaps,
        "baseline": baseline.summary() if baseline else None,
    }


# ------------------------------------------------------------------------ probe 3


async def probe_transition(
    client: HAClient,
    targets: list[str],
    recorder: StateRecorder,
    seconds: int,
    skip_prompts: bool,
) -> dict:
    """Compare a long transition against transition 0 and look for a ramp.

    Caveat worth remembering when reading the output: the TP-Link integration
    refreshes from the device after a command, and the device may report its
    final target while the LEDs are still fading. Identical traces therefore mean
    "HA cannot see a ramp", not necessarily "the bulb did not fade". The visual
    answer is the tiebreaker.
    """
    entity_id = targets[0]  # traces and analysis follow the first bulb
    print(f"\n=== transition ({seconds}s vs 0s) ===")
    runs: dict[str, Any] = {}

    for label, transition in (("with_transition", seconds), ("without_transition", 0)):
        setup = await apply_and_settle(
            client, recorder, targets, color_temp_kelvin=2200, brightness_pct=10
        )
        before = setup.sample or recorder.latest(entity_id)
        t0 = time.monotonic()
        context, elapsed = await apply_many(
            client,
            targets,
            color_temp_kelvin=6500,
            brightness_pct=100,
            transition=transition,
        )
        await asyncio.sleep(seconds + 4)

        raw = recorder.samples(entity_id, since=t0)

        def is_leftover(sample: Sample) -> bool:
            # A write still reporting the pre-command state is the tail of the
            # settle phase, not a mid-ramp reading. Counting it would inflate the
            # false-override numbers below.
            return (
                before is not None
                and sample.kelvin == before.kelvin
                and sample.brightness == before.brightness
            )

        samples = [s for s in raw if not is_leftover(s)]
        print(f"\n  {label}: call returned in {elapsed * 1000:.0f} ms")
        if before is not None:
            print(f"      before  {before.summary()}")
        leftover = {i for i, sample in enumerate(raw) if is_leftover(sample)}
        for line in trace_table(raw, t0, leftover):
            print(line)

        intermediates = [
            s.kelvin for s in samples if s.kelvin is not None and 2400 < s.kelvin < 6300
        ]
        print(f"    intermediate kelvin values seen: {len(intermediates)} {intermediates}")

        # Probe 5 rides along here: which of these writes carry our context?
        foreign = [s for s in samples if s.context_id != context]
        far_off = [
            s
            for s in foreign
            if s.kelvin is not None and abs(s.kelvin - 6500) > 100 and s.state == "on"
        ]
        runs[label] = {
            "call_ms": round(elapsed * 1000),
            "our_context": context,
            "trace": serialise(raw, t0),
            "leftover_writes": len(leftover),
            "intermediate_kelvin": intermediates,
            "foreign_context_writes": len(foreign),
            "foreign_writes_outside_100K": len(far_off),
            "max_foreign_kelvin_delta": max(
                (abs(s.kelvin - 6500) for s in far_off), default=0
            ),
        }
        if far_off:
            print(
                f"    !! {len(far_off)} write(s) with a NON-ours context landed >100K from"
                f" target (max {runs[label]['max_foreign_kelvin_delta']}K)"
                " -- these would trip false overrides"
            )

    with_n = len(runs["with_transition"]["intermediate_kelvin"])
    without_n = len(runs["without_transition"]["intermediate_kelvin"])
    verdict = "ramp visible to HA" if with_n > without_n + 1 else "no ramp visible to HA"
    print(f"\n  verdict: {verdict} ({with_n} vs {without_n} intermediates)")

    visual = await ask(
        f"During the {seconds}s run, did the bulb fade smoothly or snap instantly?"
        " (fade/snap/notes)",
        skip_prompts,
    )
    return {"seconds": seconds, "runs": runs, "ha_verdict": verdict, "observed": visual}


# ------------------------------------------------------------------------ probe 4


async def probe_rounding(client: HAClient, targets: list[str], recorder: StateRecorder) -> dict:
    """Sent vs reported, across the range. These deltas become the spec 10.1 tolerances."""
    entity_id = targets[0]  # traces and analysis follow the first bulb
    print("\n=== state rounding ===")
    kelvins = [2200, 2500, 2700, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500]
    brightnesses = [1, 2, 5, 10, 20, 30, 50, 70, 90, 100]

    kelvin_rows: list[dict] = []
    print("\n  kelvin sweep at 60%")
    print("      sent  reported   delta")
    for kelvin in kelvins:
        applied = await apply_and_settle(
            client, recorder, targets, color_temp_kelvin=kelvin, brightness_pct=60
        )
        reported = applied.sample.kelvin if applied.sample else None
        delta = None if reported is None else reported - kelvin
        kelvin_rows.append(
            {"sent": kelvin, "reported": reported, "delta": delta,
             "confirmed": applied.confirmed}
        )
        note = "" if applied.confirmed else "  (no state write - not counted)"
        print(f"     {kelvin:5d}  {str(reported):>8}  {str(delta):>6}{note}")

    brightness_rows: list[dict] = []
    print("\n  brightness sweep at 3000K")
    print("      sent%  reported%  raw/255   delta%")
    for pct in brightnesses:
        applied = await apply_and_settle(
            client, recorder, targets, color_temp_kelvin=3000, brightness_pct=pct
        )
        reported = applied.sample.brightness_pct if applied.sample else None
        raw = applied.sample.brightness if applied.sample else None
        delta = None if reported is None else reported - pct
        brightness_rows.append(
            {"sent_pct": pct, "reported_pct": reported, "raw": raw, "delta": delta,
             "confirmed": applied.confirmed}
        )
        note = "" if applied.confirmed else "  (no state write - not counted)"
        print(f"     {pct:6d}  {str(reported):>9}  {str(raw):>7}  {str(delta):>6}{note}")

    k_deltas = [abs(r["delta"]) for r in kelvin_rows if r["confirmed"] and r["delta"] is not None]
    b_deltas = [
        abs(r["delta"]) for r in brightness_rows if r["confirmed"] and r["delta"] is not None
    ]
    unconfirmed = sum(1 for r in kelvin_rows + brightness_rows if not r["confirmed"])
    summary = {
        "max_kelvin_delta": max(k_deltas, default=0),
        "median_kelvin_delta": statistics.median(k_deltas) if k_deltas else 0,
        "max_brightness_pct_delta": max(b_deltas, default=0),
        "median_brightness_pct_delta": statistics.median(b_deltas) if b_deltas else 0,
        "unconfirmed_rows": unconfirmed,
    }
    if unconfirmed:
        print(f"\n  !! {unconfirmed} row(s) got no state write back and were excluded")
    print(
        f"\n  worst case: {summary['max_kelvin_delta']}K,"
        f" {summary['max_brightness_pct_delta']}% brightness"
    )
    print("  -> set the spec 10.1 tolerances above these, with headroom")
    return {"kelvin": kelvin_rows, "brightness": brightness_rows, "summary": summary}


# ------------------------------------------------------------------------ probe 5


async def probe_modes(
    client: HAClient, targets: list[str], recorder: StateRecorder, skip_prompts: bool
) -> dict:
    """CT <-> RGB switching: the L630 brightness jump the spec warns about."""
    entity_id = targets[0]  # traces and analysis follow the first bulb
    print("\n=== CT <-> RGB mode switching at a fixed 80% ===")
    steps = [
        ("ct", {"color_temp_kelvin": 3000, "brightness_pct": 80}),
        ("rgb", {"hs_color": [30, 90], "brightness_pct": 80}),
        ("ct again", {"color_temp_kelvin": 3000, "brightness_pct": 80}),
        ("rgb blue", {"hs_color": [240, 100], "brightness_pct": 80}),
    ]
    rows: list[dict] = []
    for label, data in steps:
        applied = await apply_and_settle(client, recorder, targets, **data)
        sample = applied.sample
        row = {
            "step": label,
            "sent": data,
            "call_ms": applied.elapsed_ms,
            "confirmed": applied.confirmed,
            "color_mode": sample.color_mode if sample else None,
            "reported_pct": sample.brightness_pct if sample else None,
            "reported_kelvin": sample.kelvin if sample else None,
            "reported_hs": sample.hs if sample else None,
        }
        rows.append(row)
        print(
            f"  {label:<10} -> mode={row['color_mode']}"
            f" brightness={row['reported_pct']}% ({row['call_ms']} ms)"
        )
    observed = await ask(
        "Did perceived brightness jump when it switched between white and colour?"
        " (y/n/notes)",
        skip_prompts,
    )
    return {"steps": rows, "observed": observed}


# ------------------------------------------------------------------------ probe 6


async def probe_latency(client: HAClient, entities: list[str], rounds: int) -> dict:
    """Sequential latency per bulb, then all bulbs at once. Sets the rate limit."""
    print(f"\n=== command latency ({rounds} rounds) ===")
    sequential: dict[str, list[float]] = {}
    failures: dict[str, int] = {e: 0 for e in entities}

    for entity_id in entities:
        timings: list[float] = []
        for i in range(rounds):
            kelvin = 3000 if i % 2 else 3200
            try:
                _, elapsed = await apply(
                    client, entity_id, color_temp_kelvin=kelvin, brightness_pct=50
                )
                timings.append(elapsed * 1000)
            except HAError as err:
                failures[entity_id] += 1
                print(f"    {entity_id} round {i}: FAILED {err}")
        sequential[entity_id] = timings
        if timings:
            print(
                f"  {entity_id}: median {statistics.median(timings):.0f} ms,"
                f" min {min(timings):.0f}, max {max(timings):.0f}"
            )

    concurrent: dict[str, Any] = {}
    if len(entities) > 1:
        print(f"\n  all {len(entities)} bulbs concurrently, {rounds} rounds")
        wall_times: list[float] = []
        for i in range(rounds):
            kelvin = 3000 if i % 2 else 3200
            started = time.monotonic()
            results = await asyncio.gather(
                *(
                    apply(client, e, color_temp_kelvin=kelvin, brightness_pct=50)
                    for e in entities
                ),
                return_exceptions=True,
            )
            wall = (time.monotonic() - started) * 1000
            wall_times.append(wall)
            errors = sum(1 for r in results if isinstance(r, Exception))
            print(f"    round {i}: {wall:.0f} ms wall, {errors} error(s)")
        concurrent = {
            "wall_ms": wall_times,
            "median_wall_ms": statistics.median(wall_times),
        }

    all_timings = [t for ts in sequential.values() for t in ts]
    summary = {
        "median_ms": statistics.median(all_timings) if all_timings else None,
        "p95_ms": (
            sorted(all_timings)[int(len(all_timings) * 0.95) - 1] if all_timings else None
        ),
        "max_ms": max(all_timings, default=None),
        "failures": failures,
    }
    print(
        f"\n  overall median {summary['median_ms']:.0f} ms,"
        f" p95 {summary['p95_ms']:.0f} ms, max {summary['max_ms']:.0f} ms"
        if all_timings
        else "\n  no successful commands"
    )
    return {"sequential_ms": sequential, "concurrent": concurrent, "summary": summary}


# --------------------------------------------------------------------------- main


async def restore(client: HAClient, snapshot: dict[str, dict]) -> None:
    """Best-effort return to the state the probes found."""
    print("\n=== restoring original state ===")
    for entity_id, state in snapshot.items():
        attrs = state.get("attributes") or {}
        try:
            if state.get("state") != "on":
                await client.call_service(
                    "light", "turn_off", {"transition": 0}, {"entity_id": entity_id}
                )
                continue
            data: dict[str, Any] = {"transition": 0}
            if attrs.get("brightness") is not None:
                data["brightness"] = attrs["brightness"]
            if attrs.get("color_mode") == "color_temp" and attrs.get("color_temp_kelvin"):
                data["color_temp_kelvin"] = attrs["color_temp_kelvin"]
            elif attrs.get("hs_color"):
                data["hs_color"] = attrs["hs_color"]
            await client.call_service("light", "turn_on", data, {"entity_id": entity_id})
        except HAError as err:
            print(f"  could not restore {entity_id}: {err}")


def write_report(results: dict) -> Path:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = RESULTS_DIR / f"spike-{stamp}.json"
    path.write_text(json.dumps(results, indent=2, default=str))
    return path


async def run(args: argparse.Namespace) -> int:
    entities: list[str] = [e.strip() for e in args.entities.split(",") if e.strip()]
    if not entities:
        print("no entities given; use --entities or set LIGHTCURVE_SPIKE_ENTITIES")
        return 2

    primary = entities[0]
    # --one-bulb keeps the old behaviour; by default every configured bulb moves
    # together so the fixture reads as one light to the eye.
    targets = [primary] if args.one_bulb else entities
    results: dict[str, Any] = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ha_url": args.url,
        "entities": entities,
        "primary": primary,
        "driven": targets,
    }

    async with HAClient(args.url, args.token) as client:
        recorder = StateRecorder(entities)
        await client.subscribe_events("state_changed", recorder.handle)
        snapshot = {e: await client.get_state(e) for e in entities}

        try:
            which = args.probe
            if which in ("all", "info"):
                results["info"] = await probe_info(client, entities)
            if which in ("all", "onestep"):
                results["onestep"] = await probe_onestep(
                    client, targets, recorder, args.no_prompt
                )
            if which in ("all", "coldon"):
                results["coldon"] = await probe_coldon(
                    client, targets, recorder, args.no_prompt
                )
            if which in ("all", "coldbrightness"):
                results["coldbrightness"] = await probe_coldbrightness(
                    client, targets, recorder, args.no_prompt
                )
            if which in ("all", "interference"):
                results["interference"] = await probe_interference(
                    client, targets, recorder, args.interference_seconds
                )
            if which in ("all", "warmup"):
                results["warmup"] = await probe_warmup(
                    client, targets, recorder, args.no_prompt
                )
            if which in ("all", "colours"):
                results["colours"] = await probe_colours(
                    client, targets, recorder, args.no_prompt
                )
            if which in ("all", "transition"):
                results["transition"] = await probe_transition(
                    client, targets, recorder, args.transition_seconds, args.no_prompt
                )
            if which in ("all", "rounding"):
                results["rounding"] = await probe_rounding(client, targets, recorder)
            if which in ("all", "modes"):
                results["modes"] = await probe_modes(
                    client, targets, recorder, args.no_prompt
                )
            if which in ("all", "latency"):
                results["latency"] = await probe_latency(client, entities, args.rounds)
        finally:
            await restore(client, snapshot)

    path = write_report(results)
    print(f"\nreport written to {path}")
    return 0


def main() -> int:
    load_env_file(HERE / ".env")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "probe",
        nargs="?",
        default="all",
        choices=[
            "all",
            "info",
            "onestep",
            "coldon",
            "coldbrightness",
            "colours",
            "warmup",
            "interference",
            "transition",
            "rounding",
            "modes",
            "latency",
        ],
    )
    parser.add_argument("--url", default=os.environ.get("HA_URL", "http://homeassistant.local:8123"))
    parser.add_argument("--token", default=os.environ.get("HA_TOKEN", ""))
    parser.add_argument("--entities", default=os.environ.get("LIGHTCURVE_SPIKE_ENTITIES", ""))
    parser.add_argument("--rounds", type=int, default=8)
    parser.add_argument("--transition-seconds", type=int, default=10)
    parser.add_argument(
        "--interference-seconds",
        type=float,
        default=180.0,
        help="how long the interference check sits idle watching for foreign writes",
    )
    parser.add_argument(
        "--one-bulb",
        action="store_true",
        help="drive only the first bulb (default: drive them all together)",
    )
    parser.add_argument(
        "--no-prompt",
        action="store_true",
        help="skip the questions that need you to watch the bulb",
    )
    args = parser.parse_args()

    if not args.token:
        print("no token; set HA_TOKEN in spike/.env or pass --token")
        return 2

    print("These probes will change your lights repeatedly for a few minutes.")
    print(f"HA: {args.url}   probe: {args.probe}   lights: {args.entities}")
    try:
        return asyncio.run(run(args))
    except KeyboardInterrupt:
        return 130
    except HAError as err:
        print(f"\nfailed: {err}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
