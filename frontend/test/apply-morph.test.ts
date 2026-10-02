import { describe, expect, it } from "vitest";
import { applyEditToKeyframes, applyMorphToKeyframes } from "../src/apply-morph";
import type { Keyframe, ResolvedKeyframe } from "../src/types";

function kf(id: string, minute: number, brightness: number, sun?: string): Keyframe {
  return {
    id,
    time: sun
      ? { type: "sun", event: sun, offset_min: 0 }
      : { type: "fixed", value: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}` },
    colour: { mode: "kelvin", kelvin: 3000 },
    brightness,
    easing: "ease_in_out",
  };
}

function resolvedFrom(keyframes: Keyframe[], minutes: number[]): ResolvedKeyframe[] {
  return keyframes.map((k, i) => ({
    id: k.id,
    at: "",
    minute: minutes[i],
    brightness_pct: k.brightness,
    mode: "kelvin" as const,
    kelvin: 3000,
    hs: null,
    easing: k.easing,
  }));
}

/** A curve that has been dragged upward around midday. */
function morphedCurve(base: number, peak: number, centre: number, radius: number) {
  return Array.from({ length: 288 }, (_, i) => {
    const minute = i * 5;
    const distance = Math.min(Math.abs(minute - centre), 1440 - Math.abs(minute - centre));
    const weight = distance >= radius ? 0 : Math.cos((distance / radius) * (Math.PI / 2)) ** 2;
    return { minute, value: base + (peak - base) * weight };
  });
}

describe("applyMorphToKeyframes", () => {
  it("updates keyframes inside the dragged region", () => {
    const keyframes = [kf("a", 0, 20), kf("b", 720, 20), kf("c", 1200, 20)];
    const resolved = resolvedFrom(keyframes, [0, 720, 1200]);
    const result = applyMorphToKeyframes(
      keyframes,
      resolved,
      "brightness",
      morphedCurve(20, 80, 720, 180),
      { kind: "radial", centre: 720, radius: 180 }
    );
    const b = result.find((k) => k.id === "b")!;
    expect(b.brightness).toBeGreaterThan(70);
  });

  it("leaves keyframes outside the region completely alone", () => {
    const keyframes = [kf("a", 0, 20), kf("b", 720, 20), kf("c", 1200, 20)];
    const resolved = resolvedFrom(keyframes, [0, 720, 1200]);
    const result = applyMorphToKeyframes(
      keyframes,
      resolved,
      "brightness",
      morphedCurve(20, 80, 720, 180),
      { kind: "radial", centre: 720, radius: 180 }
    );
    expect(result.find((k) => k.id === "a")!.brightness).toBe(20);
    expect(result.find((k) => k.id === "c")!.brightness).toBe(20);
  });

  it("keeps a sun-relative keyframe bound to the sun", () => {
    // The whole reason for not refitting wholesale: a keyframe pinned to sunrise
    // must stay pinned, or it silently becomes a fixed time and drifts over months.
    const keyframes = [kf("dawn", 345, 20, "sunrise"), kf("noon", 720, 20)];
    const resolved = resolvedFrom(keyframes, [345, 720]);
    const result = applyMorphToKeyframes(
      keyframes,
      resolved,
      "brightness",
      morphedCurve(20, 80, 345, 240),
      { kind: "radial", centre: 345, radius: 240 }
    );
    const dawn = result.find((k) => k.id === "dawn")!;
    expect(dawn.time.type).toBe("sun");
    expect(dawn.time.event).toBe("sunrise");
    expect(dawn.brightness).toBeGreaterThan(70); // value changed, binding did not
  });

  it("adds keyframes where the drawn shape needs them", () => {
    // Two distant keyframes cannot express a bump between them on their own.
    const keyframes = [kf("a", 0, 20), kf("b", 1380, 20)];
    const resolved = resolvedFrom(keyframes, [0, 1380]);
    const result = applyMorphToKeyframes(
      keyframes,
      resolved,
      "brightness",
      morphedCurve(20, 90, 720, 240),
      { kind: "radial", centre: 720, radius: 240 }
    );
    expect(result.length).toBeGreaterThan(2);
  });

  it("never exceeds the keyframe budget", () => {
    const keyframes = Array.from({ length: 40 }, (_, i) => kf(`k${i}`, i * 30, 20));
    const resolved = resolvedFrom(keyframes, keyframes.map((_, i) => i * 30));
    const result = applyMorphToKeyframes(
      keyframes,
      resolved,
      "brightness",
      morphedCurve(20, 90, 720, 600),
      { kind: "radial", centre: 720, radius: 600 }
    );
    expect(result.length).toBeLessThanOrEqual(48);
  });

  it("does not crowd an existing keyframe with a new one", () => {
    const keyframes = [kf("a", 0, 20), kf("b", 720, 20), kf("c", 1380, 20)];
    const resolved = resolvedFrom(keyframes, [0, 720, 1380]);
    const result = applyMorphToKeyframes(
      keyframes,
      resolved,
      "brightness",
      morphedCurve(20, 90, 720, 240),
      { kind: "radial", centre: 720, radius: 240 }
    );
    const fixedMinutes = result
      .filter((k) => k.time.type === "fixed")
      .map((k) => {
        const [h, m] = k.time.value!.split(":").map(Number);
        return h * 60 + m;
      })
      .sort((x, y) => x - y);
    for (let i = 1; i < fixedMinutes.length; i++) {
      expect(fixedMinutes[i] - fixedMinutes[i - 1]).toBeGreaterThanOrEqual(5);
    }
  });

  it("morphing warmth changes colour temperature, not brightness", () => {
    const keyframes = [kf("a", 0, 30), kf("b", 720, 30)];
    const resolved = resolvedFrom(keyframes, [0, 720]);
    const result = applyMorphToKeyframes(
      keyframes,
      resolved,
      "warmth",
      morphedCurve(3000, 5000, 720, 180),
      { kind: "radial", centre: 720, radius: 180 }
    );
    const b = result.find((k) => k.id === "b")!;
    expect(b.colour.mode).toBe("kelvin");
    expect(b.colour.kelvin).toBeGreaterThan(4000);
    expect(b.brightness).toBe(30);
  });

  it("returns the keyframes unchanged when the region holds almost no curve", () => {
    const keyframes = [kf("a", 0, 20), kf("b", 720, 20)];
    const resolved = resolvedFrom(keyframes, [0, 720]);
    const result = applyMorphToKeyframes(
      keyframes,
      resolved,
      "brightness",
      [{ minute: 0, value: 20 }],
      { kind: "radial", centre: 720, radius: 180 }
    );
    expect(result).toHaveLength(2);
  });
});

describe("applyEditToKeyframes with a painted span", () => {
  it("rewrites only the span that was painted", () => {
    const keyframes = [kf("a", 0, 20), kf("b", 720, 20), kf("c", 1200, 20)];
    const resolved = resolvedFrom(keyframes, [0, 720, 1200]);
    // a flat 80 across the middle of the day
    const painted = Array.from({ length: 288 }, (_, i) => ({
      minute: i * 5,
      value: i * 5 >= 600 && i * 5 <= 840 ? 80 : 20,
    }));
    const result = applyEditToKeyframes(keyframes, resolved, "brightness", painted, {
      kind: "span",
      from: 600,
      to: 840,
    });
    expect(result.find((k) => k.id === "b")!.brightness).toBe(80);
    expect(result.find((k) => k.id === "a")!.brightness).toBe(20);
    expect(result.find((k) => k.id === "c")!.brightness).toBe(20);
  });

  it("keeps a sun-bound keyframe bound when painted over", () => {
    const keyframes = [kf("dawn", 345, 20, "sunrise"), kf("noon", 720, 20)];
    const resolved = resolvedFrom(keyframes, [345, 720]);
    const painted = Array.from({ length: 288 }, (_, i) => ({
      minute: i * 5,
      value: 65,
    }));
    const result = applyEditToKeyframes(keyframes, resolved, "brightness", painted, {
      kind: "span",
      from: 300,
      to: 400,
    });
    const dawn = result.find((k) => k.id === "dawn")!;
    expect(dawn.time.type).toBe("sun");
    expect(dawn.brightness).toBe(65);
  });

  it("covers a span that wraps across midnight", () => {
    const keyframes = [kf("evening", 1320, 20), kf("small_hours", 120, 20), kf("day", 720, 50)];
    const resolved = resolvedFrom(keyframes, [1320, 120, 720]);
    const painted = Array.from({ length: 288 }, (_, i) => ({ minute: i * 5, value: 7 }));
    const result = applyEditToKeyframes(keyframes, resolved, "brightness", painted, {
      kind: "span",
      from: 1300,
      to: 140,
    });
    expect(result.find((k) => k.id === "evening")!.brightness).toBe(7);
    expect(result.find((k) => k.id === "small_hours")!.brightness).toBe(7);
    expect(result.find((k) => k.id === "day")!.brightness).toBe(50);
  });
});

describe("colour saturation", () => {
  function kfColour(id: string, minute: number, colour: Keyframe["colour"]): Keyframe {
    return {
      id,
      time: { type: "fixed", value: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}` },
      colour,
      brightness: 30,
      easing: "ease_in_out",
    };
  }

  it("paints a chosen saturation, not always full", () => {
    // Without this, every painted colour is fully saturated and "deep orange"
    // cannot be distinguished from "a washed pastel orange".
    const keyframes = [
      kfColour("a", 0, { mode: "hs", hs: [0, 100] }),
      kfColour("b", 720, { mode: "hs", hs: [0, 100] }),
    ];
    const resolved = resolvedFrom(keyframes, [0, 720]);
    const painted = Array.from({ length: 288 }, (_, i) => ({ minute: i * 5, value: 25 }));
    const result = applyEditToKeyframes(
      keyframes, resolved, "colour", painted,
      { kind: "span", from: 0, to: 720 }, 48, 70
    );
    const b = result.find((k) => k.id === "b")!;
    expect(b.colour.mode).toBe("hs");
    expect(b.colour.hs).toEqual([25, 70]);
  });

  it("converts a white keyframe to a colour when painted in the colour lane", () => {
    // The only way to turn part of a white curve into a coloured section by
    // dragging, rather than editing every keyframe by hand.
    const keyframes = [
      kfColour("white", 0, { mode: "kelvin", kelvin: 2700 }),
      kfColour("later", 720, { mode: "kelvin", kelvin: 4000 }),
    ];
    const resolved = resolvedFrom(keyframes, [0, 720]);
    const painted = Array.from({ length: 288 }, (_, i) => ({ minute: i * 5, value: 20 }));
    const result = applyEditToKeyframes(
      keyframes, resolved, "colour", painted,
      { kind: "span", from: 0, to: 60 }, 48, 95
    );
    expect(result.find((k) => k.id === "white")!.colour).toEqual({
      mode: "hs",
      hs: [20, 95],
    });
    // and a keyframe outside the painted span keeps its white
    expect(result.find((k) => k.id === "later")!.colour.mode).toBe("kelvin");
  });

  it("keeps the existing saturation when the brush does not supply one", () => {
    const keyframes = [
      kfColour("a", 0, { mode: "hs", hs: [200, 40] }),
      kfColour("b", 720, { mode: "hs", hs: [200, 40] }),
    ];
    const resolved = resolvedFrom(keyframes, [0, 720]);
    const painted = Array.from({ length: 288 }, (_, i) => ({ minute: i * 5, value: 120 }));
    const result = applyEditToKeyframes(
      keyframes, resolved, "colour", painted, { kind: "span", from: 0, to: 720 }
    );
    expect(result.find((k) => k.id === "a")!.colour.hs).toEqual([120, 40]);
  });
});
