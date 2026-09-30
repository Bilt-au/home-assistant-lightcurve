import { describe, expect, it } from "vitest";
import { colourToPoint, hsToCss, kelvinToCss, pointToColour } from "../src/wheel";

const CENTRE = 100;
const RADIUS = 90;

describe("pointToColour", () => {
  it("puts red at the top, matching the painted gradient", () => {
    const { hue } = pointToColour(CENTRE, CENTRE - RADIUS, CENTRE, RADIUS);
    expect(hue).toBe(0);
  });

  it("runs clockwise", () => {
    expect(pointToColour(CENTRE + RADIUS, CENTRE, CENTRE, RADIUS).hue).toBe(90);
    expect(pointToColour(CENTRE, CENTRE + RADIUS, CENTRE, RADIUS).hue).toBe(180);
    expect(pointToColour(CENTRE - RADIUS, CENTRE, CENTRE, RADIUS).hue).toBe(270);
  });

  it("reads saturation as distance from the centre", () => {
    expect(pointToColour(CENTRE, CENTRE, CENTRE, RADIUS).saturation).toBe(0);
    expect(pointToColour(CENTRE, CENTRE - RADIUS / 2, CENTRE, RADIUS).saturation).toBe(50);
    expect(pointToColour(CENTRE, CENTRE - RADIUS, CENTRE, RADIUS).saturation).toBe(100);
  });

  it("clamps outside the rim rather than refusing the pick", () => {
    // Dragging a little past the edge should pin to fully saturated, not stop.
    const { saturation } = pointToColour(CENTRE, CENTRE - RADIUS * 3, CENTRE, RADIUS);
    expect(saturation).toBe(100);
  });
});

describe("colourToPoint", () => {
  it("is the inverse of pointToColour", () => {
    for (const [hue, saturation] of [
      [0, 100],
      [90, 50],
      [200, 75],
      [359, 10],
    ]) {
      const point = colourToPoint(hue, saturation, CENTRE, RADIUS);
      const back = pointToColour(point.x, point.y, CENTRE, RADIUS);
      expect(back.hue).toBeCloseTo(hue, 0);
      expect(back.saturation).toBeCloseTo(saturation, 0);
    }
  });

  it("puts a fully desaturated colour at the centre", () => {
    const point = colourToPoint(210, 0, CENTRE, RADIUS);
    expect(point.x).toBeCloseTo(CENTRE);
    expect(point.y).toBeCloseTo(CENTRE);
  });
});

describe("kelvinToCss", () => {
  it("is warm at the bottom of the range and cool at the top", () => {
    const warm = kelvinToCss(2200);
    const cool = kelvinToCss(6500);
    const blueOf = (css: string) => Number(css.match(/(\d+)\)$/)![1]);
    expect(blueOf(cool)).toBeGreaterThan(blueOf(warm));
  });

  it("stays inside the byte range at the extremes", () => {
    for (const kelvin of [1000, 2200, 6500, 40000]) {
      const parts = kelvinToCss(kelvin).match(/\d+/g)!.map(Number);
      for (const value of parts) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe("hsToCss", () => {
  it("rounds to whole degrees and percentages", () => {
    expect(hsToCss(12.4, 88.6)).toBe("hsl(12, 89%, 50%)");
  });
});
