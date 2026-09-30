import { describe, expect, it } from "vitest";
import {
  brightnessToY,
  formatMinute,
  hitTest,
  kelvinToY,
  minuteToX,
  parseMinute,
  snapMinute,
  snapToSun,
  xToMinute,
  yToBrightness,
  yToKelvin,
  type Plot,
} from "../src/geometry";

const plot: Plot = { left: 40, top: 10, width: 960, height: 200 };

describe("time axis", () => {
  it("puts midnight at the left edge and 24:00 at the right", () => {
    expect(minuteToX(0, plot)).toBe(40);
    expect(minuteToX(1440, plot)).toBe(1000);
    expect(minuteToX(720, plot)).toBe(520);
  });

  it("round-trips a minute through pixels", () => {
    for (const minute of [0, 1, 359, 720, 1234, 1439]) {
      expect(xToMinute(minuteToX(minute, plot), plot)).toBe(minute);
    }
  });

  it("clamps a drag past either edge to the day", () => {
    expect(xToMinute(-500, plot)).toBe(0);
    expect(xToMinute(99999, plot)).toBe(1439);
  });
});

describe("brightness axis", () => {
  it("is inverted, so full brightness is at the top", () => {
    expect(brightnessToY(100, plot)).toBe(10);
    expect(brightnessToY(0, plot)).toBe(210);
  });

  it("round-trips a percentage", () => {
    for (const pct of [1, 25, 50, 99, 100]) {
      expect(yToBrightness(brightnessToY(pct, plot), plot)).toBe(pct);
    }
  });

  it("never returns zero, which would mean off rather than dim", () => {
    expect(yToBrightness(99999, plot)).toBe(1);
    expect(yToBrightness(-99999, plot)).toBe(100);
  });
});

describe("kelvin axis", () => {
  it("puts the coolest temperature at the top", () => {
    expect(kelvinToY(6500, plot, 2200, 6500)).toBeCloseTo(10, 5);
    expect(kelvinToY(2200, plot, 2200, 6500)).toBeCloseTo(210, 5);
  });

  it("round-trips kelvin within a degree", () => {
    for (const kelvin of [2200, 2700, 4000, 5500, 6500]) {
      const y = kelvinToY(kelvin, plot, 2200, 6500);
      expect(yToKelvin(y, plot, 2200, 6500)).toBeCloseTo(kelvin, -1);
    }
  });

  it("is spaced in mireds, so the midpoint is not the arithmetic mean", () => {
    // The same reason the engine interpolates in mireds: even spacing in kelvin
    // would crowd the whole warm end into a sliver of the axis.
    const middle = yToKelvin(plot.top + plot.height / 2, plot, 2200, 6500);
    expect(middle).toBeLessThan(4350);
    expect(middle).toBeGreaterThan(3000);
  });
});

describe("snapping", () => {
  it("snaps to five-minute steps by default", () => {
    expect(snapMinute(367)).toBe(365);
    expect(snapMinute(363)).toBe(365);
    expect(snapMinute(361)).toBe(360);
  });

  it("snaps onto a nearby sun event and reports which one", () => {
    const markers = [
      { event: "sunrise", minute: 345 },
      { event: "sunset", minute: 1095 },
    ];
    const result = snapToSun(350, markers);
    expect(result.minute).toBe(345);
    expect(result.event).toBe("sunrise");
  });

  it("falls back to the time grid when no sun event is close", () => {
    const markers = [{ event: "sunrise", minute: 345 }];
    const result = snapToSun(600, markers);
    expect(result.event).toBeNull();
    expect(result.minute).toBe(600);
  });

  it("does not snap from just outside the threshold", () => {
    const markers = [{ event: "sunrise", minute: 345 }];
    expect(snapToSun(345 + 13, markers).event).toBeNull();
    expect(snapToSun(345 + 11, markers).event).toBe("sunrise");
  });
});

describe("hit testing", () => {
  const handles = [
    { id: "a", x: 100, y: 100 },
    { id: "b", x: 140, y: 100 },
  ];

  it("finds a handle under the pointer", () => {
    expect(hitTest(102, 103, handles)).toBe("a");
  });

  it("returns the closest when two overlap, not the first", () => {
    expect(hitTest(135, 100, handles)).toBe("b");
  });

  it("returns null when nothing is close", () => {
    expect(hitTest(500, 500, handles)).toBeNull();
  });

  it("has a radius big enough for a fingertip", () => {
    // The visible handle is ~6px; a 22px radius is what makes it usable on a phone.
    expect(hitTest(100 + 20, 100, handles.slice(0, 1))).toBe("a");
  });
});

describe("time formatting", () => {
  it("formats and parses HH:MM", () => {
    expect(formatMinute(0)).toBe("00:00");
    expect(formatMinute(9 * 60 + 5)).toBe("09:05");
    expect(formatMinute(23 * 60 + 59)).toBe("23:59");
    expect(parseMinute("09:05")).toBe(545);
    expect(parseMinute("9:05")).toBe(545);
  });

  it("wraps rather than producing a negative time", () => {
    expect(formatMinute(-60)).toBe("23:00");
    expect(formatMinute(1500)).toBe("01:00");
  });

  it("rejects malformed input instead of guessing", () => {
    expect(parseMinute("nonsense")).toBeNull();
    expect(parseMinute("25:00")).toBeNull();
    expect(parseMinute("12:60")).toBeNull();
  });
});
