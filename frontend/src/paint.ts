/** Painting values straight onto the curve.
 *
 *  Sweeping across the graph sets each moment the cursor crosses to the cursor's
 *  height. Unlike the deform, nothing is inferred: the stroke is the curve, for
 *  exactly the span it covered.
 */

import type { Point } from "./fit";
import { MINUTES_PER_DAY } from "./types";

export interface Stroke {
  /** Painted values, keyed by minute. */
  values: Map<number, number>;
  first: number;
  last: number;
}

export function newStroke(): Stroke {
  return { values: new Map(), first: -1, last: -1 };
}

/**
 * Record one cursor position, filling in any minutes skipped since the last.
 *
 * Pointer events arrive every frame at best, and a quick sweep jumps tens of
 * minutes between them. Without interpolation the stroke comes out as a comb of
 * untouched gaps, so the span between samples is filled along the line joining
 * them.
 */
export function extendStroke(
  stroke: Stroke,
  minute: number,
  value: number,
  stepMinutes = 5
): Stroke {
  const values = new Map(stroke.values);
  if (stroke.last >= 0 && stroke.last !== minute) {
    const from = stroke.last;
    const previous = values.get(from) ?? value;
    const distance = minute - from;
    const steps = Math.max(1, Math.round(Math.abs(distance) / stepMinutes));
    for (let i = 1; i <= steps; i++) {
      const fraction = i / steps;
      const at = roundTo(from + distance * fraction, stepMinutes);
      values.set(wrap(at), previous + (value - previous) * fraction);
    }
  }
  values.set(wrap(roundTo(minute, stepMinutes)), value);
  return {
    values,
    first: stroke.first < 0 ? wrap(roundTo(minute, stepMinutes)) : stroke.first,
    last: minute,
  };
}

/** Overlay a stroke on the sampled curve, leaving untouched minutes alone. */
export function applyStroke(points: Point[], stroke: Stroke): Point[] {
  if (stroke.values.size === 0) return points;
  return points.map((point) => {
    const painted = stroke.values.get(point.minute);
    return painted === undefined ? point : { minute: point.minute, value: painted };
  });
}

/** The span a stroke covered, for deciding which keyframes it may rewrite. */
export function strokeSpan(stroke: Stroke): { from: number; to: number } | null {
  if (stroke.values.size === 0) return null;
  const minutes = [...stroke.values.keys()].sort((a, b) => a - b);
  const first = stroke.first >= 0 ? stroke.first : minutes[0];
  const last = wrap(roundTo(stroke.last, 5));
  // A stroke dragged right-to-left, or across midnight, still covers the span it
  // actually touched rather than the numeric range between its ends.
  return first <= last ? { from: first, to: last } : { from: last, to: first };
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function wrap(minute: number): number {
  return ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}
