/** Time <-> pixel mapping and hit-testing for the graph.
 *
 *  Pure functions with no DOM, because this is where an editor's bugs actually
 *  live: a drag that lands a keyframe a few minutes off, or a handle you cannot
 *  grab on a phone. All of it is unit tested.
 */

import { MINUTES_PER_DAY } from "./types";

export interface Plot {
  /** Pixel bounds of the plotting area, excluding axis gutters. */
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Minute of the day -> x pixel. */
export function minuteToX(minute: number, plot: Plot): number {
  return plot.left + (minute / MINUTES_PER_DAY) * plot.width;
}

/** x pixel -> minute of the day, clamped to the day. */
export function xToMinute(x: number, plot: Plot): number {
  const fraction = (x - plot.left) / plot.width;
  return clamp(Math.round(fraction * MINUTES_PER_DAY), 0, MINUTES_PER_DAY - 1);
}

/** Brightness percent -> y pixel. Inverted: 100% is at the top. */
export function brightnessToY(pct: number, plot: Plot): number {
  return plot.top + (1 - pct / 100) * plot.height;
}

/** y pixel -> brightness percent, clamped to the 1-100 the engine accepts. */
export function yToBrightness(y: number, plot: Plot): number {
  const fraction = 1 - (y - plot.top) / plot.height;
  return clamp(Math.round(fraction * 100), 1, 100);
}

/** Kelvin -> y pixel, mapped in mireds so the scale matches perception. */
export function kelvinToY(kelvin: number, plot: Plot, min: number, max: number): number {
  const mired = 1e6 / kelvin;
  const hot = 1e6 / max;
  const cold = 1e6 / min;
  const fraction = (mired - hot) / (cold - hot);
  return plot.top + clamp(fraction, 0, 1) * plot.height;
}

/** y pixel -> kelvin, the inverse of kelvinToY. */
export function yToKelvin(y: number, plot: Plot, min: number, max: number): number {
  const fraction = clamp((y - plot.top) / plot.height, 0, 1);
  const hot = 1e6 / max;
  const cold = 1e6 / min;
  return Math.round(1e6 / (hot + fraction * (cold - hot)));
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Snap to the nearest step, for dragging along the time axis. */
export function snapMinute(minute: number, step = 5): number {
  return clamp(Math.round(minute / step) * step, 0, MINUTES_PER_DAY - 1);
}

export interface SunMarker {
  event: string;
  minute: number;
}

/** Snap to a sun event when dragged close to one.
 *
 *  Returns the event name so the caller can convert the keyframe to sun-relative,
 *  which is the whole point: dragging a keyframe onto sunrise should make it track
 *  sunrise, not pin it to the clock time sunrise happens to have today.
 */
export function snapToSun(
  minute: number,
  markers: SunMarker[],
  withinMinutes = 12
): { minute: number; event: string | null } {
  let best: SunMarker | null = null;
  let bestDistance = Infinity;
  for (const marker of markers) {
    const distance = Math.abs(marker.minute - minute);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = marker;
    }
  }
  if (best && bestDistance <= withinMinutes) {
    return { minute: best.minute, event: best.event };
  }
  return { minute: snapMinute(minute), event: null };
}

/** Which keyframe, if any, is under a pointer.
 *
 *  The radius is generous because this has to work with a fingertip; the spec asks
 *  for 44px touch targets and the visible handle is much smaller than that.
 */
export function hitTest(
  x: number,
  y: number,
  handles: { id: string; x: number; y: number }[],
  radius = 22
): string | null {
  let closest: string | null = null;
  let bestDistance = radius;
  for (const handle of handles) {
    const distance = Math.hypot(handle.x - x, handle.y - y);
    if (distance <= bestDistance) {
      bestDistance = distance;
      closest = handle.id;
    }
  }
  return closest;
}

/** Format a minute of the day as HH:MM. */
export function formatMinute(minute: number): string {
  const wrapped = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Parse HH:MM into a minute of the day, or null when malformed. */
export function parseMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
