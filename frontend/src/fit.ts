/** Reducing a freehand drag to keyframes.
 *
 *  Dragging produces a point per pixel; a profile may hold 48 keyframes. Rather
 *  than making the user choose between drawing and keyframes, the drawn path is
 *  simplified to keyframes on release, so the curve stays a curve with easing
 *  rather than becoming a polyline of hundreds of points.
 */

export interface Point {
  minute: number;
  value: number;
}

/**
 * Ramer-Douglas-Peucker: keep the points that carry the shape, drop the rest.
 *
 * `tolerance` is in value units (brightness percent, or mireds), so it means the
 * same thing regardless of how wide the graph is drawn.
 */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return [...points];

  let worstIndex = 0;
  let worstDistance = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > worstDistance) {
      worstDistance = distance;
      worstIndex = i;
    }
  }

  if (worstDistance <= tolerance) {
    return [first, last];
  }
  const left = simplify(points.slice(0, worstIndex + 1), tolerance);
  const right = simplify(points.slice(worstIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const runs = end.minute - start.minute;
  if (runs === 0) return Math.abs(point.value - start.value);
  const slope = (end.value - start.value) / runs;
  const projected = start.value + (point.minute - start.minute) * slope;
  return Math.abs(point.value - projected);
}

/**
 * Simplify, then tighten the tolerance until the result fits within `maxPoints`.
 *
 * A fixed tolerance can still return more points than a profile may hold, and
 * silently dropping the overflow would change the drawn shape in a way the user
 * cannot see. Raising the tolerance instead degrades the whole curve evenly.
 */
export function fitToBudget(
  points: Point[],
  maxPoints: number,
  startTolerance = 1.5
): { points: Point[]; tolerance: number } {
  let tolerance = startTolerance;
  let result = simplify(points, tolerance);
  // Geometric backoff: 24 doublings covers any plausible input without looping
  // forever on pathological data.
  for (let attempt = 0; attempt < 24 && result.length > maxPoints; attempt++) {
    tolerance *= 1.6;
    result = simplify(points, tolerance);
  }
  return { points: result, tolerance };
}

/** Merge points that are closer together in time than the engine allows. */
export function enforceSpacing(points: Point[], minMinutes: number): Point[] {
  if (points.length <= 1) return [...points];
  const out: Point[] = [points[0]];
  for (const point of points.slice(1)) {
    if (point.minute - out[out.length - 1].minute >= minMinutes) {
      out.push(point);
    }
  }
  // Keep the final point: it anchors the end of the drawn range, and dropping it
  // would quietly shorten what the user drew.
  const last = points[points.length - 1];
  if (out[out.length - 1].minute !== last.minute) {
    if (last.minute - out[out.length - 1].minute < minMinutes) out.pop();
    out.push(last);
  }
  return out;
}
