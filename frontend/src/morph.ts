/** Deforming the curve around a cursor.
 *
 *  Dragging grabs the curve rather than a keyframe: the point under the cursor
 *  follows it exactly and the surrounding curve bends with a falloff, so the shape
 *  changes smoothly instead of developing a spike. The result is converted back to
 *  keyframes on release, not on every frame — a server round trip per pointer move
 *  would never keep up.
 */

import type { Point } from "./fit";
import { MINUTES_PER_DAY } from "./types";

export interface MorphOptions {
  /** Half-width of the influence, in minutes. */
  radiusMinutes: number;
  /** Lowest permitted value, e.g. 1% brightness. */
  min: number;
  /** Highest permitted value. */
  max: number;
  /** True for hue, which is a circle: 359 and 1 are two degrees apart. */
  wrapValue?: boolean;
}

/**
 * Smooth, flat at both ends, 1 at the centre and 0 at the edge.
 *
 * A linear falloff leaves a visible crease where the influence stops, because the
 * slope changes abruptly there. Cosine-squared is zero-derivative at both ends, so
 * the deformed region blends into the untouched curve without a seam.
 */
export function falloff(distance: number, radius: number): number {
  if (radius <= 0) return distance === 0 ? 1 : 0;
  const t = Math.min(1, Math.abs(distance) / radius);
  return Math.cos((t * Math.PI) / 2) ** 2;
}

/**
 * Shortest distance between two minutes on a 24-hour circle.
 *
 * The curve wraps at midnight, so a drag at 23:30 has to reach 00:15. Measuring
 * linearly would leave the wrap point untouched and put a step in the curve exactly
 * where the night section lives.
 */
export function circularDistance(a: number, b: number): number {
  const raw = Math.abs(a - b);
  return Math.min(raw, MINUTES_PER_DAY - raw);
}

/** Apply a displacement centred on `atMinute`, tapering to nothing at the radius. */
export function morph(
  points: Point[],
  atMinute: number,
  delta: number,
  options: MorphOptions
): Point[] {
  const { radiusMinutes, min, max, wrapValue } = options;
  return points.map((point) => {
    const weight = falloff(circularDistance(point.minute, atMinute), radiusMinutes);
    if (weight === 0) return point;
    let value = point.value + delta * weight;
    if (wrapValue) {
      value = ((value % max) + max) % max;
    } else {
      value = Math.min(max, Math.max(min, value));
    }
    return { minute: point.minute, value };
  });
}

/**
 * Move the curve so the point at `atMinute` lands exactly on `targetValue`.
 *
 * The grabbed point must track the cursor precisely or the drag feels slippery, so
 * the displacement is derived from where that point currently is rather than from
 * the pointer's frame-to-frame movement, which would accumulate error.
 */
export function morphToward(
  points: Point[],
  atMinute: number,
  targetValue: number,
  options: MorphOptions
): Point[] {
  const grabbed = nearest(points, atMinute);
  if (!grabbed) return points;
  return morph(points, atMinute, targetValue - grabbed.value, options);
}

export function nearest(points: Point[], minute: number): Point | null {
  let best: Point | null = null;
  let bestDistance = Infinity;
  for (const point of points) {
    const distance = circularDistance(point.minute, minute);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }
  return best;
}

/** A sensible influence radius for a graph of a given pixel width. */
export function radiusForWidth(pixelWidth: number, pixelRadius = 90): number {
  if (pixelWidth <= 0) return 60;
  return Math.max(15, (pixelRadius / pixelWidth) * MINUTES_PER_DAY);
}
