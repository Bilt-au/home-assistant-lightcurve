/** Shapes shared with the Python side. Kept narrow on purpose: only what the
 *  editor reads, so a change in the integration surfaces as a type error here. */

export type ColourMode = "kelvin" | "hs";
export type Easing = "linear" | "ease_in_out" | "step";

export interface KeyframeTime {
  type: "fixed" | "sun";
  value?: string;
  event?: string;
  offset_min?: number;
}

export interface KeyframeColour {
  mode: ColourMode;
  kelvin?: number;
  hs?: [number, number];
}

export interface Keyframe {
  id: string;
  time: KeyframeTime;
  colour: KeyframeColour;
  brightness: number;
  easing: Easing;
}

export interface Profile {
  id: string;
  name: string;
  variants: Record<string, { keyframes: Keyframe[] }>;
}

export interface ProfileSummary {
  id: string;
  name: string;
  variants: string[];
  used_by: string[];
}

/** A point on the rendered curve, as the engine computed it. */
export interface Sample {
  at: string;
  minute: number;
  mode: ColourMode | null;
  kelvin: number | null;
  hs: [number, number] | null;
  brightness_pct: number | null;
  rgb: [number, number, number] | null;
}

/** A keyframe resolved to a concrete time on the displayed day. */
export interface ResolvedKeyframe {
  id: string;
  at: string;
  minute: number;
  brightness_pct: number;
  mode: ColourMode;
  kelvin: number | null;
  hs: [number, number] | null;
  easing: Easing;
}

export interface SunEvents {
  [event: string]: { at: string; minute: number } | null;
}

export interface Group {
  id: string;
  name: string;
  profile_id: string;
  area_id: string | null;
  members: string[];
  members_resolved: string[];
  members_available: string[];
  is_on: boolean;
  enabled: boolean;
  override_colour: boolean;
  override_brightness: boolean;
  target: Sample | null;
}

export interface Look {
  id: string;
  name: string;
  mode: "static" | "effect";
  colour: KeyframeColour | null;
  brightness: number | null;
  effect: string | null;
  groups: string[];
  hold_minutes: number | null;
  /** Group names, resolved for display. */
  covers: string[];
  /** Every group it covers has stopped following the curve. */
  holding: boolean;
}

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  keyframe_ids: string[];
}

export const MINUTES_PER_DAY = 1440;
