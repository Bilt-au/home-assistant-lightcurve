import { describe, expect, it } from "vitest";
import {
  circularDistance,
  falloff,
  morph,
  morphToward,
  nearest,
  radiusForWidth,
} from "../src/morph";
import type { Point } from "../src/fit";

function flat(value: number, step = 30): Point[] {
  return Array.from({ length: 1440 / step }, (_, i) => ({
    minute: i * step,
    value,
  }));
}

const brightness = { radiusMinutes: 120, min: 1, max: 100 };

describe("falloff", () => {
  it("is full at the centre and nothing at the edge", () => {
    expect(falloff(0, 100)).toBeCloseTo(1);
    expect(falloff(100, 100)).toBeCloseTo(0);
  });

  it("is flat at both ends, so the deformed region has no crease", () => {
    // A linear falloff would change slope abruptly at the edge; this must not.
    const nearEdge = falloff(99, 100) - falloff(100, 100);
    const midway = falloff(50, 100) - falloff(51, 100);
    expect(nearEdge).toBeLessThan(midway);
  });

  it("is symmetric", () => {
    expect(falloff(-40, 100)).toBeCloseTo(falloff(40, 100));
  });

  it("never goes negative, which would pull the curve the wrong way", () => {
    for (const d of [0, 25, 50, 99, 100, 250]) {
      expect(falloff(d, 100)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("circularDistance", () => {
  it("measures the short way round midnight", () => {
    // 23:30 to 00:15 is 45 minutes, not 1395.
    expect(circularDistance(23 * 60 + 30, 15)).toBe(45);
  });

  it("agrees with plain distance away from the wrap", () => {
    expect(circularDistance(600, 660)).toBe(60);
  });

  it("is never more than half a day", () => {
    for (const a of [0, 100, 719, 720, 1439]) {
      expect(circularDistance(a, 0)).toBeLessThanOrEqual(720);
    }
  });
});

describe("morph", () => {
  it("moves the centre by the full delta", () => {
    const result = morph(flat(50), 720, 20, brightness);
    expect(nearest(result, 720)!.value).toBeCloseTo(70);
  });

  it("leaves points beyond the radius untouched", () => {
    const result = morph(flat(50), 720, 20, brightness);
    expect(nearest(result, 0)!.value).toBe(50);
    expect(nearest(result, 1380)!.value).toBe(50);
  });

  it("tapers, rather than moving a block of the curve", () => {
    const result = morph(flat(50), 720, 20, brightness);
    const centre = nearest(result, 720)!.value;
    const halfway = nearest(result, 780)!.value;
    const edge = nearest(result, 840)!.value;
    expect(centre).toBeGreaterThan(halfway);
    expect(halfway).toBeGreaterThan(edge);
    expect(edge).toBeCloseTo(50, 1);
  });

  it("deforms across midnight", () => {
    // Grabbing at 23:50 must lift the early hours too, or the curve steps at 00:00.
    const result = morph(flat(50), 23 * 60 + 50, 20, brightness);
    expect(nearest(result, 30)!.value).toBeGreaterThan(50);
  });

  it("clamps to the permitted range", () => {
    const up = morph(flat(95), 720, 50, brightness);
    expect(Math.max(...up.map((p) => p.value))).toBe(100);
    const down = morph(flat(5), 720, -50, brightness);
    expect(Math.min(...down.map((p) => p.value))).toBe(1);
  });

  it("wraps hue instead of clamping it", () => {
    const hue = { radiusMinutes: 120, min: 0, max: 360, wrapValue: true };
    const result = morph(flat(350), 720, 30, hue);
    // 350 + 30 = 380, which on a colour wheel is 20, not 360.
    expect(nearest(result, 720)!.value).toBeCloseTo(20);
  });

  it("returns the same shape when the delta is zero", () => {
    const before = flat(50);
    expect(morph(before, 720, 0, brightness)).toEqual(before);
  });
});

describe("morphToward", () => {
  it("lands the grabbed point exactly on the cursor value", () => {
    // Slippery drags come from accumulating frame deltas; this derives the
    // displacement from where the point actually is.
    const result = morphToward(flat(40), 600, 75, brightness);
    expect(nearest(result, 600)!.value).toBeCloseTo(75);
  });

  it("keeps landing exactly when applied repeatedly", () => {
    let points = flat(40);
    for (const target of [55, 62, 48, 90]) {
      points = morphToward(points, 600, target, brightness);
      expect(nearest(points, 600)!.value).toBeCloseTo(target);
    }
  });

  it("does nothing to an empty curve", () => {
    expect(morphToward([], 600, 50, brightness)).toEqual([]);
  });
});

describe("radiusForWidth", () => {
  it("scales with the drawn width, so the brush feels the same size", () => {
    expect(radiusForWidth(1440)).toBeCloseTo(90);
    expect(radiusForWidth(720)).toBeCloseTo(180);
  });

  it("stays usable on a narrow phone", () => {
    expect(radiusForWidth(320)).toBeGreaterThan(15);
  });

  it("survives a zero width during first layout", () => {
    expect(radiusForWidth(0)).toBe(60);
  });
});
