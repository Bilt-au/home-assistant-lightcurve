/** The three-lane curve graph.
 *
 *  Brightness is independent and always editable. Warmth and colour are the same
 *  channel — a keyframe is a colour temperature or a hue, never both, because the
 *  bulb cannot be 3000 K and red at once — so each is drawn greyed where the curve
 *  is in the other mode. Showing both lanes with the inactive one dimmed is honest
 *  about that constraint; two freely editable lanes would imply a state the hardware
 *  cannot enter.
 */

import { LitElement, css, html, svg, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  brightnessToY,
  formatMinute,
  hitTest,
  kelvinToY,
  minuteToX,
  snapToSun,
  xToMinute,
  yToBrightness,
  yToKelvin,
  type Plot,
} from "./geometry";
import { MINUTES_PER_DAY, type ResolvedKeyframe, type Sample, type SunEvents } from "./types";

type Lane = "brightness" | "warmth" | "colour";

const LANE_HEIGHT = 128;
const LANE_GAP = 18;
const GUTTER_LEFT = 46;
const GUTTER_RIGHT = 14;
const GUTTER_TOP = 22;
const STRIP_HEIGHT = 26;

@customElement("lightcurve-curve-graph")
export class CurveGraph extends LitElement {
  @property({ attribute: false }) samples: Sample[] = [];
  @property({ attribute: false }) keyframes: ResolvedKeyframe[] = [];
  @property({ attribute: false }) sun: SunEvents = {};
  @property({ type: Number }) nowMinute = 0;
  @property({ type: String }) selectedId: string | null = null;
  @property({ type: Number }) minKelvin = 2200;
  @property({ type: Number }) maxKelvin = 6500;
  @property({ type: Number }) scrubMinute: number | null = null;
  @property({ type: Number }) width = 900;

  @state() private dragging: { id: string; lane: Lane } | null = null;

  static override styles = css`
    :host {
      display: block;
      touch-action: none;
      user-select: none;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .lane-bg {
      fill: var(--card-background-color, #fff);
      stroke: var(--divider-color, #e0e0e0);
    }
    .lane-title {
      fill: var(--secondary-text-color, #666);
      font: 500 11px var(--paper-font-body1_-_font-family, sans-serif);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .axis-label {
      fill: var(--secondary-text-color, #888);
      font: 10px var(--paper-font-body1_-_font-family, sans-serif);
    }
    .grid {
      stroke: var(--divider-color, #e8e8e8);
      stroke-width: 1;
    }
    .now {
      stroke: var(--error-color, #d32f2f);
      stroke-width: 2;
      stroke-dasharray: 3 3;
    }
    .scrub {
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 2;
    }
    .sun {
      stroke: var(--secondary-text-color, #aaa);
      stroke-width: 1;
      stroke-dasharray: 2 4;
    }
    .curve {
      fill: none;
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 2.5;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .curve.muted {
      stroke: var(--disabled-text-color, #bbb);
      stroke-width: 1.5;
      stroke-dasharray: 4 4;
    }
    .inactive-wash {
      fill: var(--card-background-color, #fff);
      opacity: 0.66;
      pointer-events: none;
    }
    .inactive-note {
      fill: var(--secondary-text-color, #888);
      font: italic 11px var(--paper-font-body1_-_font-family, sans-serif);
      pointer-events: none;
    }
    .handle {
      stroke: var(--card-background-color, #fff);
      stroke-width: 2;
      cursor: grab;
    }
    .handle.selected {
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 3;
    }
    .hit {
      fill: transparent;
      cursor: grab;
    }
  `;

  private get plotWidth(): number {
    return Math.max(120, this.width - GUTTER_LEFT - GUTTER_RIGHT);
  }

  private plotFor(lane: Lane): Plot {
    const index = lane === "brightness" ? 0 : lane === "warmth" ? 1 : 2;
    return {
      left: GUTTER_LEFT,
      top: GUTTER_TOP + index * (LANE_HEIGHT + LANE_GAP + STRIP_HEIGHT),
      width: this.plotWidth,
      height: LANE_HEIGHT,
    };
  }

  private get totalHeight(): number {
    return GUTTER_TOP + 3 * (LANE_HEIGHT + LANE_GAP + STRIP_HEIGHT) + 10;
  }

  override render(): TemplateResult {
    const height = this.totalHeight;
    return html`
      <svg
        viewBox="0 0 ${this.width} ${height}"
        @pointerdown=${this.onPointerDown}
        @pointermove=${this.onPointerMove}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerUp}
      >
        ${this.renderLane("brightness", "Brightness")}
        ${this.renderLane("warmth", "Warmth")}
        ${this.renderLane("colour", "Colour")}
      </svg>
    `;
  }

  private renderLane(lane: Lane, title: string): TemplateResult {
    const plot = this.plotFor(lane);
    const active = this.samples.filter((s) => this.laneApplies(lane, s));
    const inactive = active.length === 0 && lane !== "brightness";

    return svg`
      <g>
        <text class="lane-title" x=${plot.left} y=${plot.top - 7}>${title}</text>
        <rect class="lane-bg" x=${plot.left} y=${plot.top}
              width=${plot.width} height=${plot.height} rx="6" />
        ${this.renderGrid(plot, lane)}
        ${this.renderGradientStrip(plot, lane)}
        ${this.renderCurve(plot, lane)}
        ${this.renderSunMarkers(plot)}
        ${this.renderNow(plot)}
        ${this.renderScrub(plot)}
        ${this.renderHandles(plot, lane)}
        ${inactive
          ? svg`
            <rect class="inactive-wash" x=${plot.left} y=${plot.top}
                  width=${plot.width} height=${plot.height} rx="6" />
            <text class="inactive-note" x=${plot.left + plot.width / 2}
                  y=${plot.top + plot.height / 2} text-anchor="middle">
              ${lane === "warmth"
                ? "this curve has no colour-temperature section"
                : "this curve has no colour section"}
            </text>`
          : ""}
      </g>
    `;
  }

  /** Is this sample edited in this lane? Warmth and colour are mutually exclusive. */
  private laneApplies(lane: Lane, sample: Sample): boolean {
    if (lane === "brightness") return sample.brightness_pct !== null;
    if (lane === "warmth") return sample.mode === "kelvin";
    return sample.mode === "hs";
  }

  private renderGrid(plot: Plot, lane: Lane): TemplateResult {
    const lines = [];
    for (let hour = 0; hour <= 24; hour += 3) {
      const x = minuteToX(hour * 60, plot);
      lines.push(svg`<line class="grid" x1=${x} y1=${plot.top} x2=${x}
                          y2=${plot.top + plot.height} />`);
      if (lane === "colour") {
        lines.push(svg`<text class="axis-label" x=${x} y=${plot.top + plot.height + 16}
                             text-anchor="middle">${String(hour).padStart(2, "0")}</text>`);
      }
    }
    const labels =
      lane === "brightness"
        ? [
            { value: 100, y: brightnessToY(100, plot), text: "100%" },
            { value: 50, y: brightnessToY(50, plot), text: "50%" },
            { value: 1, y: brightnessToY(1, plot), text: "1%" },
          ]
        : lane === "warmth"
          ? [
              { value: this.maxKelvin, y: plot.top, text: `${this.maxKelvin}K` },
              { value: this.minKelvin, y: plot.top + plot.height, text: `${this.minKelvin}K` },
            ]
          : [
              { value: 360, y: plot.top, text: "360°" },
              { value: 0, y: plot.top + plot.height, text: "0°" },
            ];
    for (const label of labels) {
      lines.push(svg`<text class="axis-label" x=${plot.left - 6} y=${label.y + 3}
                           text-anchor="end">${label.text}</text>`);
    }
    return svg`${lines}`;
  }

  /** The gradient strip under each lane, drawn from the engine's own colours. */
  private renderGradientStrip(plot: Plot, lane: Lane): TemplateResult {
    if (this.samples.length === 0) return svg``;
    const y = plot.top + plot.height + (lane === "colour" ? 22 : 6);
    const bars = this.samples.map((sample, index) => {
      const next = this.samples[index + 1];
      const x = minuteToX(sample.minute, plot);
      const nextX = next ? minuteToX(next.minute, plot) : plot.left + plot.width;
      const rgb = sample.rgb ?? [80, 80, 80];
      const dim = !this.laneApplies(lane, sample);
      return svg`<rect x=${x} y=${y} width=${Math.max(1, nextX - x)}
                       height=${STRIP_HEIGHT - 10}
                       fill="rgb(${rgb[0]},${rgb[1]},${rgb[2]})"
                       opacity=${dim ? 0.25 : 1} />`;
    });
    return svg`<g>${bars}</g>`;
  }

  private renderCurve(plot: Plot, lane: Lane): TemplateResult {
    if (this.samples.length < 2) return svg``;
    // Split into runs so an inactive stretch is dashed rather than joined through.
    const runs: { active: boolean; points: string[] }[] = [];
    for (const sample of this.samples) {
      const active = this.laneApplies(lane, sample);
      const y = this.valueY(plot, lane, sample);
      if (y === null) continue;
      const point = `${minuteToX(sample.minute, plot).toFixed(1)},${y.toFixed(1)}`;
      const tail = runs[runs.length - 1];
      if (tail && tail.active === active) tail.points.push(point);
      else runs.push({ active, points: [point] });
    }
    return svg`${runs
      .filter((run) => run.points.length > 1)
      .map(
        (run) =>
          svg`<polyline class="curve ${run.active ? "" : "muted"}"
                        points=${run.points.join(" ")} />`
      )}`;
  }

  private valueY(plot: Plot, lane: Lane, sample: Sample): number | null {
    if (lane === "brightness") {
      return sample.brightness_pct === null
        ? null
        : brightnessToY(sample.brightness_pct, plot);
    }
    if (lane === "warmth") {
      const kelvin = sample.kelvin ?? this.minKelvin;
      return kelvinToY(kelvin, plot, this.minKelvin, this.maxKelvin);
    }
    const hue = sample.hs ? sample.hs[0] : 0;
    return plot.top + (1 - hue / 360) * plot.height;
  }

  private renderSunMarkers(plot: Plot): TemplateResult {
    return svg`${Object.entries(this.sun).map(([event, info]) => {
      if (!info) return svg``;
      const x = minuteToX(info.minute, plot);
      return svg`<line class="sun" x1=${x} y1=${plot.top} x2=${x}
                       y2=${plot.top + plot.height}>
                   <title>${event} ${formatMinute(info.minute)}</title>
                 </line>`;
    })}`;
  }

  private renderNow(plot: Plot): TemplateResult {
    const x = minuteToX(this.nowMinute, plot);
    return svg`<line class="now" x1=${x} y1=${plot.top} x2=${x}
                     y2=${plot.top + plot.height} />`;
  }

  private renderScrub(plot: Plot): TemplateResult {
    if (this.scrubMinute === null) return svg``;
    const x = minuteToX(this.scrubMinute, plot);
    return svg`<line class="scrub" x1=${x} y1=${plot.top} x2=${x}
                     y2=${plot.top + plot.height} />`;
  }

  private handlesFor(plot: Plot, lane: Lane): { id: string; x: number; y: number }[] {
    return this.keyframes
      .filter((keyframe) => this.keyframeInLane(lane, keyframe))
      .map((keyframe) => ({
        id: keyframe.id,
        x: minuteToX(keyframe.minute, plot),
        y: this.keyframeY(plot, lane, keyframe),
      }));
  }

  private keyframeInLane(lane: Lane, keyframe: ResolvedKeyframe): boolean {
    if (lane === "brightness") return true;
    if (lane === "warmth") return keyframe.mode === "kelvin";
    return keyframe.mode === "hs";
  }

  private keyframeY(plot: Plot, lane: Lane, keyframe: ResolvedKeyframe): number {
    if (lane === "brightness") return brightnessToY(keyframe.brightness_pct, plot);
    if (lane === "warmth") {
      return kelvinToY(keyframe.kelvin ?? this.minKelvin, plot, this.minKelvin, this.maxKelvin);
    }
    const hue = keyframe.hs ? keyframe.hs[0] : 0;
    return plot.top + (1 - hue / 360) * plot.height;
  }

  private renderHandles(plot: Plot, lane: Lane): TemplateResult {
    return svg`${this.handlesFor(plot, lane).map((handle) => {
      const keyframe = this.keyframes.find((k) => k.id === handle.id)!;
      const rgb =
        keyframe.mode === "kelvin"
          ? "var(--primary-color, #03a9f4)"
          : `hsl(${keyframe.hs?.[0] ?? 0}, ${keyframe.hs?.[1] ?? 100}%, 55%)`;
      return svg`
        <g>
          <circle class="hit" cx=${handle.x} cy=${handle.y} r="22"
                  data-id=${handle.id} data-lane=${lane} />
          <circle class="handle ${this.selectedId === handle.id ? "selected" : ""}"
                  cx=${handle.x} cy=${handle.y} r="6" fill=${rgb}
                  data-id=${handle.id} data-lane=${lane}>
            <title>${keyframe.id} · ${formatMinute(keyframe.minute)}</title>
          </circle>
        </g>`;
    })}`;
  }

  // --- interaction ----------------------------------------------------------

  private localPoint(event: PointerEvent): { x: number; y: number } {
    const svgElement = this.renderRoot.querySelector("svg")!;
    const rect = svgElement.getBoundingClientRect();
    const scale = this.width / rect.width;
    return {
      x: (event.clientX - rect.left) * scale,
      y: (event.clientY - rect.top) * scale,
    };
  }

  private laneAt(y: number): Lane | null {
    for (const lane of ["brightness", "warmth", "colour"] as Lane[]) {
      const plot = this.plotFor(lane);
      if (y >= plot.top - 10 && y <= plot.top + plot.height + 10) return lane;
    }
    return null;
  }

  private onPointerDown(event: PointerEvent): void {
    const point = this.localPoint(event);
    const lane = this.laneAt(point.y);
    if (!lane) return;
    const plot = this.plotFor(lane);
    const hit = hitTest(point.x, point.y, this.handlesFor(plot, lane));
    if (hit) {
      this.dragging = { id: hit, lane };
      this.selectedId = hit;
      (event.target as Element).setPointerCapture?.(event.pointerId);
      this.dispatchEvent(
        new CustomEvent("keyframe-select", { detail: { id: hit }, bubbles: true, composed: true })
      );
      return;
    }
    // Not on a handle: treat as scrubbing the preview along the timeline.
    this.dispatchEvent(
      new CustomEvent("scrub", {
        detail: { minute: xToMinute(point.x, plot) },
        bubbles: true,
        composed: true,
      })
    );
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;
    const point = this.localPoint(event);
    const plot = this.plotFor(this.dragging.lane);
    const markers = Object.entries(this.sun)
      .filter(([, info]) => info)
      .map(([event_, info]) => ({ event: event_, minute: info!.minute }));
    const snapped = snapToSun(xToMinute(point.x, plot), markers);

    const detail: Record<string, unknown> = {
      id: this.dragging.id,
      minute: snapped.minute,
      sunEvent: snapped.event,
    };
    if (this.dragging.lane === "brightness") {
      detail.brightness = yToBrightness(point.y, plot);
    } else if (this.dragging.lane === "warmth") {
      detail.kelvin = yToKelvin(point.y, plot, this.minKelvin, this.maxKelvin);
    } else {
      const fraction = 1 - (point.y - plot.top) / plot.height;
      detail.hue = Math.round(Math.min(360, Math.max(0, fraction * 360)));
    }
    this.dispatchEvent(
      new CustomEvent("keyframe-move", { detail, bubbles: true, composed: true })
    );
  }

  private onPointerUp(): void {
    if (this.dragging) {
      this.dragging = null;
      this.dispatchEvent(new CustomEvent("keyframe-commit", { bubbles: true, composed: true }));
    } else {
      this.dispatchEvent(new CustomEvent("scrub-end", { bubbles: true, composed: true }));
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lightcurve-curve-graph": CurveGraph;
  }
}

export const DAY_MINUTES = MINUTES_PER_DAY;
