/** Colour-wheel geometry.
 *
 *  Hue is the angle around the wheel, saturation the distance from the centre, so
 *  picking a colour is one gesture rather than two sliders. Kept as pure functions
 *  because "the handle does not sit under my finger" is a maths bug, not a
 *  rendering one, and it is much easier to catch here.
 */

export interface Polar {
  hue: number;
  saturation: number;
}

/** Pointer position, relative to the wheel's centre, to hue and saturation.
 *
 *  Angles run clockwise from the top so that red sits at 12 o'clock, matching the
 *  conic gradient the wheel is painted with. Beyond the rim the saturation clamps
 *  rather than the pick being rejected: dragging slightly outside should pin to
 *  fully saturated, not stop responding.
 */
export function pointToColour(
  x: number,
  y: number,
  centre: number,
  radius: number
): Polar {
  const dx = x - centre;
  const dy = y - centre;
  const angle = Math.atan2(dx, -dy) * (180 / Math.PI);
  const hue = (angle + 360) % 360;
  const distance = Math.hypot(dx, dy);
  const saturation = Math.min(100, Math.round((distance / radius) * 100));
  return { hue: Math.round(hue), saturation };
}

/** The inverse: where the handle belongs for a given colour. */
export function colourToPoint(
  hue: number,
  saturation: number,
  centre: number,
  radius: number
): { x: number; y: number } {
  const angle = ((hue % 360) * Math.PI) / 180;
  const distance = (Math.min(100, Math.max(0, saturation)) / 100) * radius;
  return {
    x: centre + Math.sin(angle) * distance,
    y: centre - Math.cos(angle) * distance,
  };
}

/** Hue and saturation at full value, as a CSS colour for swatches. */
export function hsToCss(hue: number, saturation: number): string {
  return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, 50%)`;
}

/** Approximate a colour temperature as CSS, for the kelvin swatch.
 *
 *  Tanner Helland's curve, the same approximation the Python engine uses, so the
 *  editor and the lights agree about what 2700 K themes like.
 */
export function kelvinToCss(kelvin: number): string {
  const temp = Math.min(Math.max(kelvin, 1000), 40000) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (temp <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
  } else {
    r = 329.698727446 * (temp - 60) ** -0.1332047592;
    g = 288.1221695283 * (temp - 60) ** -0.0755148492;
  }
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  }
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}
