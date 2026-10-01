import { describe, expect, it } from "vitest";
import { applyStroke, extendStroke, newStroke, strokeSpan } from "../src/paint";
import type { Point } from "../src/fit";

function flat(value: number, step = 5): Point[] {
  return Array.from({ length: 1440 / step }, (_, i) => ({
    minute: i * step,
    value,
  }));
}

function at(points: Point[], minute: number): number | undefined {
  return points.find((p) => p.minute === minute)?.value;
}

describe("extendStroke", () => {
  it("records the minute under the cursor", () => {
    const stroke = extendStroke(newStroke(), 600, 70);
    expect(stroke.values.get(600)).toBe(70);
  });

  it("snaps to the sample grid so painted minutes line up with the curve", () => {
    const stroke = extendStroke(newStroke(), 603, 70);
    expect(stroke.values.has(605)).toBe(true);
    expect(stroke.values.has(603)).toBe(false);
  });

  it("fills the gap between pointer samples", () => {
    // A quick sweep jumps tens of minutes per frame. Without filling, the stroke
    // comes out as a comb of untouched gaps.
    let stroke = extendStroke(newStroke(), 600, 20);
    stroke = extendStroke(stroke, 720, 80);
    for (const minute of [605, 640, 680, 715, 720]) {
      expect(stroke.values.has(minute)).toBe(true);
    }
  });

  it("ramps across a filled gap rather than stepping", () => {
    let stroke = extendStroke(newStroke(), 600, 20);
    stroke = extendStroke(stroke, 720, 80);
    const middle = stroke.values.get(660)!;
    expect(middle).toBeGreaterThan(30);
    expect(middle).toBeLessThan(70);
  });

  it("handles a stroke dragged right to left", () => {
    let stroke = extendStroke(newStroke(), 720, 80);
    stroke = extendStroke(stroke, 600, 20);
    expect(stroke.values.get(660)).toBeGreaterThan(20);
    expect(stroke.values.get(600)).toBe(20);
  });

  it("wraps painted minutes into the day", () => {
    const stroke = extendStroke(newStroke(), 1445, 50);
    for (const minute of stroke.values.keys()) {
      expect(minute).toBeGreaterThanOrEqual(0);
      expect(minute).toBeLessThan(1440);
    }
  });
});

describe("applyStroke", () => {
  it("replaces only the minutes that were painted", () => {
    let stroke = extendStroke(newStroke(), 600, 90);
    stroke = extendStroke(stroke, 660, 90);
    const result = applyStroke(flat(20), stroke);
    expect(at(result, 630)).toBeCloseTo(90);
    expect(at(result, 300)).toBe(20);
    expect(at(result, 900)).toBe(20);
  });

  it("leaves the curve untouched for an empty stroke", () => {
    const before = flat(35);
    expect(applyStroke(before, newStroke())).toEqual(before);
  });

  it("keeps the sample count and ordering intact", () => {
    const before = flat(20);
    const stroke = extendStroke(newStroke(), 600, 90);
    const after = applyStroke(before, stroke);
    expect(after).toHaveLength(before.length);
    expect(after.map((p) => p.minute)).toEqual(before.map((p) => p.minute));
  });
});

describe("strokeSpan", () => {
  it("covers what the cursor actually crossed", () => {
    let stroke = extendStroke(newStroke(), 480, 30);
    stroke = extendStroke(stroke, 1020, 80);
    expect(strokeSpan(stroke)).toEqual({ from: 480, to: 1020 });
  });

  it("is orientation independent", () => {
    let stroke = extendStroke(newStroke(), 1020, 80);
    stroke = extendStroke(stroke, 480, 30);
    const span = strokeSpan(stroke)!;
    expect(span.from).toBe(480);
    expect(span.to).toBe(1020);
  });

  it("is null for a stroke that touched nothing", () => {
    expect(strokeSpan(newStroke())).toBeNull();
  });

  it("covers a single tap", () => {
    const stroke = extendStroke(newStroke(), 600, 40);
    expect(strokeSpan(stroke)).toEqual({ from: 600, to: 600 });
  });
});
