import { describe, expect, it } from "vitest";
import { enforceSpacing, fitToBudget, simplify, type Point } from "../src/fit";

function ramp(count: number, from: number, to: number): Point[] {
  return Array.from({ length: count }, (_, i) => ({
    minute: i * (1440 / count),
    value: from + ((to - from) * i) / (count - 1),
  }));
}

describe("simplify", () => {
  it("reduces a straight line to its endpoints", () => {
    const line = ramp(100, 10, 90);
    expect(simplify(line, 1)).toHaveLength(2);
  });

  it("keeps a corner that carries the shape", () => {
    const points: Point[] = [
      { minute: 0, value: 10 },
      { minute: 360, value: 10 },
      { minute: 720, value: 90 },
      { minute: 1080, value: 90 },
    ];
    const result = simplify(points, 1);
    expect(result.length).toBeGreaterThan(2);
    expect(result[0].minute).toBe(0);
    expect(result[result.length - 1].minute).toBe(1080);
  });

  it("always keeps the first and last point", () => {
    const noisy = Array.from({ length: 200 }, (_, i) => ({
      minute: i * 7,
      value: 50 + Math.sin(i / 3) * 20,
    }));
    const result = simplify(noisy, 5);
    expect(result[0]).toEqual(noisy[0]);
    expect(result[result.length - 1]).toEqual(noisy[noisy.length - 1]);
  });

  it("passes through inputs too short to simplify", () => {
    expect(simplify([], 1)).toEqual([]);
    const one = [{ minute: 0, value: 5 }];
    expect(simplify(one, 1)).toEqual(one);
  });
});

describe("fitToBudget", () => {
  it("gets a hand-drawn curve under the keyframe limit", () => {
    // A wobbly drag: many points, lots of small detail.
    const drawn = Array.from({ length: 800 }, (_, i) => ({
      minute: i * 1.8,
      value: 50 + Math.sin(i / 20) * 30 + Math.sin(i / 3) * 4,
    }));
    const { points, tolerance } = fitToBudget(drawn, 48);
    expect(points.length).toBeLessThanOrEqual(48);
    expect(points.length).toBeGreaterThan(2);
    expect(tolerance).toBeGreaterThan(0);
  });

  it("leaves an already-small curve alone", () => {
    const simple = ramp(10, 20, 80);
    const { points, tolerance } = fitToBudget(simple, 48);
    expect(points).toHaveLength(2); // a straight ramp needs only its ends
    expect(tolerance).toBe(1.5);
  });

  it("terminates on pathological input rather than looping", () => {
    const spiky = Array.from({ length: 500 }, (_, i) => ({
      minute: i * 2,
      value: i % 2 === 0 ? 1 : 100,
    }));
    const { points } = fitToBudget(spiky, 10);
    expect(points.length).toBeLessThanOrEqual(10);
  });
});

describe("enforceSpacing", () => {
  it("drops points closer together than the engine allows", () => {
    const points: Point[] = [
      { minute: 0, value: 10 },
      { minute: 2, value: 20 },
      { minute: 30, value: 30 },
      { minute: 31, value: 40 },
      { minute: 120, value: 50 },
    ];
    const result = enforceSpacing(points, 5);
    const gaps = result.slice(1).map((p, i) => p.minute - result[i].minute);
    expect(gaps.every((gap) => gap >= 5)).toBe(true);
  });

  it("keeps the last point, so the drawn range is not silently shortened", () => {
    const points: Point[] = [
      { minute: 0, value: 10 },
      { minute: 100, value: 20 },
      { minute: 102, value: 90 },
    ];
    const result = enforceSpacing(points, 5);
    expect(result[result.length - 1].minute).toBe(102);
  });

  it("passes through a single point", () => {
    expect(enforceSpacing([{ minute: 5, value: 1 }], 5)).toHaveLength(1);
  });
});
