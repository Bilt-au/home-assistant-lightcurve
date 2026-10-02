/** Turning a deformed curve back into keyframes.
 *
 *  The naive approach — refit the whole curve and replace every keyframe — throws
 *  away the thing that makes a profile worth keeping. A keyframe pinned to sunrise
 *  would silently become a fixed 05:45, and drift out of correctness over the
 *  following months without anyone noticing.
 *
 *  So: keyframes outside the dragged region are never touched, keyframes inside keep
 *  their time binding and only take a new value, and new keyframes are added only
 *  where the drawn shape genuinely needs them.
 */

import { fitToBudget, type Point } from "./fit";
import { circularDistance } from "./morph";
import type { Keyframe, ResolvedKeyframe } from "./types";

export type Lane = "brightness" | "warmth" | "colour";

export const MAX_KEYFRAMES = 48;
export const MIN_SEPARATION_MINUTES = 5;

/** The part of the day an edit touched.
 *
 *  A deform is centred with a falloff; a painted stroke is a span between the first
 *  and last minute the cursor crossed. Keyframes outside the region are never
 *  altered either way, which is what keeps an edit local.
 */
export type Region =
  | { kind: "radial"; centre: number; radius: number }
  | { kind: "span"; from: number; to: number };

export function inRegion(region: Region, minute: number): boolean {
  if (region.kind === "radial") {
    return circularDistance(minute, region.centre) <= region.radius;
  }
  // A stroke can run backwards across midnight, so the span wraps.
  const { from, to } = region;
  return from <= to
    ? minute >= from && minute <= to
    : minute >= from || minute <= to;
}

function valueAt(points: Point[], minute: number): number | null {
  let best: Point | null = null;
  let bestDistance = Infinity;
  for (const point of points) {
    const distance = circularDistance(point.minute, minute);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }
  return best ? best.value : null;
}

function setLaneValue(
  keyframe: Keyframe,
  lane: Lane,
  value: number,
  saturation?: number
): void {
  if (lane === "brightness") {
    keyframe.brightness = Math.round(Math.min(100, Math.max(1, value)));
  } else if (lane === "warmth") {
    keyframe.colour = { mode: "kelvin", kelvin: Math.round(value) };
  } else {
    // Saturation comes from the brush when painting, so a drag can lay down a
    // specific colour rather than only moving around the hue circle at full
    // saturation. Falls back to whatever the keyframe already had.
    const s = saturation ?? keyframe.colour.hs?.[1] ?? 100;
    keyframe.colour = { mode: "hs", hs: [Math.round(value) % 360, Math.round(s)] };
  }
}

function formatMinute(minute: number): string {
  const wrapped = ((minute % 1440) + 1440) % 1440;
  const h = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const m = String(wrapped % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function applyEditToKeyframes(
  keyframes: Keyframe[],
  resolved: ResolvedKeyframe[],
  lane: Lane,
  morphed: Point[],
  region: Region,
  budget = MAX_KEYFRAMES,
  saturation?: number
): Keyframe[] {
  const minuteOf = new Map(resolved.map((r) => [r.id, r.minute]));
  const within = (minute: number) => inRegion(region, minute);

  // 1. Existing keyframes: update those inside the region, keep their time binding.
  const updated: Keyframe[] = keyframes.map((keyframe) => {
    const minute = minuteOf.get(keyframe.id);
    if (minute === undefined || !within(minute)) return keyframe;
    const value = valueAt(morphed, minute);
    if (value === null) return keyframe;
    const copy: Keyframe = JSON.parse(JSON.stringify(keyframe));
    setLaneValue(copy, lane, value, saturation);
    return copy;
  });

  // 2. Does the drawn shape need keyframes the profile does not have? Fit only the
  //    dragged region, so an untouched part of the day never gains clutter.
  const regionPoints = morphed.filter((p) => within(p.minute));
  if (regionPoints.length < 3) return updated;

  const tolerance = lane === "brightness" ? 2.5 : lane === "warmth" ? 90 : 8;
  const { points: candidates } = fitToBudget(regionPoints, budget, tolerance);

  const occupied = updated
    .map((k) => minuteOf.get(k.id))
    .filter((m): m is number => m !== undefined);

  const additions: Keyframe[] = [];
  for (const candidate of candidates) {
    if (updated.length + additions.length >= budget) break;
    const clash = [...occupied, ...additions.map((a) => minuteFromFixed(a))].some(
      (minute) =>
        minute !== null && circularDistance(minute, candidate.minute) < MIN_SEPARATION_MINUTES
    );
    if (clash) continue;
    const template = nearestKeyframe(updated, minuteOf, candidate.minute);
    const addition: Keyframe = {
      id: `k_${Math.random().toString(36).slice(2, 8)}`,
      time: { type: "fixed", value: formatMinute(candidate.minute) },
      colour: template
        ? JSON.parse(JSON.stringify(template.colour))
        : { mode: "kelvin", kelvin: 3000 },
      brightness: template ? template.brightness : 50,
      easing: template ? template.easing : "ease_in_out",
    };
    setLaneValue(addition, lane, candidate.value, saturation);
    additions.push(addition);
  }

  return [...updated, ...additions];
}

function minuteFromFixed(keyframe: Keyframe): number | null {
  if (keyframe.time.type !== "fixed" || !keyframe.time.value) return null;
  const [h, m] = keyframe.time.value.split(":").map(Number);
  return h * 60 + m;
}

function nearestKeyframe(
  keyframes: Keyframe[],
  minuteOf: Map<string, number>,
  minute: number
): Keyframe | null {
  let best: Keyframe | null = null;
  let bestDistance = Infinity;
  for (const keyframe of keyframes) {
    const at = minuteOf.get(keyframe.id);
    if (at === undefined) continue;
    const distance = circularDistance(at, minute);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = keyframe;
    }
  }
  return best;
}


/** Alias kept for the deform path, which reads better as a morph. */
export const applyMorphToKeyframes = applyEditToKeyframes;
