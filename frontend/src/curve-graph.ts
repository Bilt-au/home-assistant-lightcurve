/** The curve graph: a brightness lane you draw on, and a colour ribbon you pick on.
 *
 *  An earlier version had three lanes — brightness, warmth and colour — with warmth
 *  and colour greyed out according to which mode the curve was in, because a
 *  keyframe holds a colour temperature or a hue and never both. That was accurate
 *  about the data and wrong about the question people ask, which is simply "what
 *  colour is the light at seven?" Whether the answer happens to be a white or an
 *  orange is an implementation detail, and making the user think about it meant
 *  they could not set a colour at all without first understanding the model.
 *
 *  So: one ribbon showing the colour the lights will actually be, all day, with a
 *  marker per keyframe. Tap anywhere on it to set the colour at that moment, from
 *  one picker that offers both whites and colours.
 */

import { LitElement, css, html, svg, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  brightnessToY,
  formatMinute,
  hitTest,
  minuteToX,
  snapToSun,
  xToMinute,
  yToBrightness,
  type Plot,
} from "./geometry";
import { MINUTES_PER_DAY, type ResolvedKeyframe, type Sample, type SunEvents } from "./types";

const BRIGHTNESS_HEIGHT = 150;
const RIBBON_HEIGHT = 74;
const GAP = 26;
const GUTTER_LEFT = 46;
const GUTTER_RIGHT = 14;
const GUTTER_TOP = 22;
const SCRUB_HEIGHT = 34;
const AXIS_HEIGHT = 20;

@customElement("lightcurve-curve-graph")
export class CurveGraph extends LitElement {
  @property({ attribute: false }) samples: Sample[] = [];
  @property({ attribute: false }) keyframes: ResolvedKeyframe[] = [];
  @property({ attribute: false }) sun: SunEvents = {};
  @property({ type: Number }) nowMinute = 0;
  @property({ type: String }) selectedId: string | null = null;
  @property({ type: Number }) scrubMinute: number | null = null;
  @property({ type: Number }) width = 900;

  @state() private painting = false;
  @state() private scrubbing = false;
  @state() private draggingMarker: string | null = null;

  static override styles = css`
    :host { display: block; touch-action: none; user-select: none; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .lane-bg {
      fill: var(--card-background-color, #fff);
      stroke: var(--divider-color, #e0e0e0);
      cursor: crosshair;
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
    .grid { stroke: var(--divider-color, #e8e8e8); stroke-width: 1; }
    .now { stroke: var(--error-color, #d32f2f); stroke-width: 2; stroke-dasharray: 3 3; }
    .scrub { stroke: var(--primary-color, #03a9f4); stroke-width: 2; }
    .sun { stroke: var(--secondary-text-color, #aaa); stroke-width: 1; stroke-dasharray: 2 4; }
    .curve {
      fill: none;
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 2.5;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .kf-tick { stroke: var(--secondary-text-color, #999); stroke-width: 2; opacity: 0.5; }
    .ribbon { cursor: crosshair; }
    .ribbon-frame {
      fill: none;
      stroke: var(--divider-color, #ddd);
      pointer-events: none;
    }
    .marker {
      stroke: #fff;
      stroke-width: 2.5;
      cursor: grab;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
    }
    .marker.selected { stroke: var(--primary-color, #03a9f4); stroke-width: 3.5; }
    .marker-hit { fill: transparent; cursor: grab; }
    .scrub-bar {
      fill: var(--secondary-background-color, #eee);
      stroke: var(--divider-color, #ddd);
      cursor: ew-resize;
    }
    .scrub-handle {
      fill: var(--card-background-color, #fff);
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 3;
      pointer-events: none;
    }
  `;

  private get plotWidth(): number {
    return Math.max(120, this.width - GUTTER_LEFT - GUTTER_RIGHT);
  }

  private get brightnessPlot(): Plot {
    return { left: GUTTER_LEFT, top: GUTTER_TOP, width: this.plotWidth, height: BRIGHTNESS_HEIGHT };
  }

  private get ribbonPlot(): Plot {
    return {
      left: GUTTER_LEFT,
      top: GUTTER_TOP + BRIGHTNESS_HEIGHT + GAP,
      width: this.plotWidth,
      height: RIBBON_HEIGHT,
    };
  }

  private get scrubTop(): number {
    return this.ribbonPlot.top + RIBBON_HEIGHT + AXIS_HEIGHT + 10;
  }

  private get totalHeight(): number {
    return this.scrubTop + SCRUB_HEIGHT + 8;
  }

  override render(): TemplateResult {
    return html`
      <svg
        viewBox="0 0 ${this.width} ${this.totalHeight}"
        @pointerdown=${this.onPointerDown}
        @pointermove=${this.onPointerMove}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerUp}
      >
        ${this.renderBrightness()}
        ${this.renderRibbon()}
        ${this.renderScrubBar()}
      </svg>
    `;
  }

  // --- brightness -----------------------------------------------------------

  private renderBrightness(): TemplateResult {
    const plot = this.brightnessPlot;
    const points = this.samples
      .filter((s) => s.brightness_pct !== null)
      .map(
        (s) =>
          `${minuteToX(s.minute, plot).toFixed(1)},${brightnessToY(
            s.brightness_pct!,
            plot
          ).toFixed(1)}`
      );
    return svg`
      <g>
        <text class="lane-title" x=${plot.left} y=${plot.top - 7}>Brightness</text>
        <rect class="lane-bg" x=${plot.left} y=${plot.top}
              width=${plot.width} height=${plot.height} rx="6" />
        ${this.renderGrid(plot, false)}
        ${[100, 50, 1].map(
          (pct) => svg`<text class="axis-label" x=${plot.left - 6}
                             y=${brightnessToY(pct, plot) + 3}
                             text-anchor="end">${pct}%</text>`
        )}
        ${points.length > 1
          ? svg`<polyline class="curve" points=${points.join(" ")} />`
          : ""}
        ${this.keyframes.map((k) => {
          const x = minuteToX(k.minute, plot);
          return svg`<line class="kf-tick" x1=${x} y1=${plot.top + plot.height - 8}
                           x2=${x} y2=${plot.top + plot.height} />`;
        })}
        ${this.renderSun(plot)} ${this.renderNow(plot)} ${this.renderScrub(plot)}
      </g>
    `;
  }

  // --- colour ribbon --------------------------------------------------------

  private renderRibbon(): TemplateResult {
    const plot = this.ribbonPlot;
    return svg`
      <g>
        <text class="lane-title" x=${plot.left} y=${plot.top - 7}>
          Colour — tap to set
        </text>
        ${this.samples.map((sample, index) => {
          const next = this.samples[index + 1];
          const x = minuteToX(sample.minute, plot);
          const nextX = next ? minuteToX(next.minute, plot) : plot.left + plot.width;
          const rgb = sample.rgb ?? [80, 80, 80];
          return svg`<rect class="ribbon" x=${x} y=${plot.top}
                           width=${Math.max(1, nextX - x + 0.5)} height=${plot.height}
                           fill="rgb(${rgb[0]},${rgb[1]},${rgb[2]})" />`;
        })}
        <rect class="ribbon-frame" x=${plot.left} y=${plot.top}
              width=${plot.width} height=${plot.height} rx="6" />
        ${this.renderSun(plot)} ${this.renderNow(plot)} ${this.renderScrub(plot)}
        ${this.markers().map((marker) => {
          const keyframe = this.keyframes.find((k) => k.id === marker.id)!;
          const fill =
            keyframe.mode === "hs"
              ? `hsl(${keyframe.hs?.[0] ?? 0}, ${keyframe.hs?.[1] ?? 100}%, 50%)`
              : "#ffffff";
          return svg`
            <g>
              <circle class="marker-hit" cx=${marker.x} cy=${marker.y} r="22"
                      data-id=${marker.id} />
              <circle class="marker ${this.selectedId === marker.id ? "selected" : ""}"
                      cx=${marker.x} cy=${marker.y} r="9" fill=${fill}>
                <title>${formatMinute(keyframe.minute)} — tap to set the colour</title>
              </circle>
            </g>`;
        })}
        ${this.renderHourLabels(plot)}
      </g>
    `;
  }

  /** One marker per keyframe, sitting on the ribbon. */
  private markers(): { id: string; x: number; y: number }[] {
    const plot = this.ribbonPlot;
    return this.keyframes.map((keyframe) => ({
      id: keyframe.id,
      x: minuteToX(keyframe.minute, plot),
      y: plot.top + plot.height / 2,
    }));
  }

  // --- shared furniture -----------------------------------------------------

  private renderGrid(plot: Plot, labels: boolean): TemplateResult {
    const out = [];
    for (let hour = 0; hour <= 24; hour += 3) {
      const x = minuteToX(hour * 60, plot);
      out.push(svg`<line class="grid" x1=${x} y1=${plot.top} x2=${x}
                         y2=${plot.top + plot.height} />`);
      if (labels) {
        out.push(svg`<text class="axis-label" x=${x} y=${plot.top + plot.height + 16}
                           text-anchor="middle">${String(hour).padStart(2, "0")}</text>`);
      }
    }
    return svg`${out}`;
  }

  private renderHourLabels(plot: Plot): TemplateResult {
    const out = [];
    for (let hour = 0; hour <= 24; hour += 3) {
      const x = minuteToX(hour * 60, plot);
      out.push(svg`<text class="axis-label" x=${x} y=${plot.top + plot.height + 16}
                         text-anchor="middle">${String(hour).padStart(2, "0")}</text>`);
    }
    return svg`${out}`;
  }

  private renderSun(plot: Plot): TemplateResult {
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

  private renderScrubBar(): TemplateResult {
    const plot: Plot = {
      left: GUTTER_LEFT, top: this.scrubTop, width: this.plotWidth, height: SCRUB_HEIGHT,
    };
    const handle = this.scrubMinute === null ? null : minuteToX(this.scrubMinute, plot);
    return svg`
      <g>
        <rect class="scrub-bar" x=${plot.left} y=${plot.top}
              width=${plot.width} height=${plot.height} rx=${SCRUB_HEIGHT / 2} />
        <text class="axis-label" x=${plot.left - 6} y=${plot.top + SCRUB_HEIGHT / 2 + 3}
              text-anchor="end">preview</text>
        ${handle === null
          ? ""
          : svg`<circle class="scrub-handle" cx=${handle}
                        cy=${plot.top + SCRUB_HEIGHT / 2} r="9" />`}
      </g>
    `;
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

  private onPointerDown(event: PointerEvent): void {
    const point = this.localPoint(event);
    (event.target as Element).setPointerCapture?.(event.pointerId);
    const brightness = this.brightnessPlot;
    const ribbon = this.ribbonPlot;

    if (point.y >= this.scrubTop) {
      this.scrubbing = true;
      this.emitScrub(point.x);
      return;
    }

    if (point.y >= ribbon.top - 12 && point.y <= ribbon.top + ribbon.height + 12) {
      const hit = hitTest(point.x, point.y, this.markers());
      if (hit) {
        this.draggingMarker = hit;
        this.selectedId = hit;
        this.emit("colour-pick", { id: hit, minute: null });
        return;
      }
      // Tapping bare ribbon means "set the colour here", which may need a new
      // keyframe. The panel decides; the graph only reports where.
      this.emit("colour-pick", { id: null, minute: xToMinute(point.x, ribbon) });
      return;
    }

    if (point.y >= brightness.top - 10 && point.y <= brightness.top + brightness.height + 10) {
      this.painting = true;
      this.emitPaint(point);
    }
  }

  private onPointerMove(event: PointerEvent): void {
    const point = this.localPoint(event);
    if (this.scrubbing) {
      this.emitScrub(point.x);
      return;
    }
    if (this.draggingMarker) {
      const markers = Object.entries(this.sun)
        .filter(([, info]) => info)
        .map(([event_, info]) => ({ event: event_, minute: info!.minute }));
      const snapped = snapToSun(xToMinute(point.x, this.ribbonPlot), markers);
      this.emit("marker-move", {
        id: this.draggingMarker,
        minute: snapped.minute,
        sunEvent: snapped.event,
      });
      return;
    }
    if (this.painting) this.emitPaint(point);
  }

  private onPointerUp(): void {
    if (this.draggingMarker) {
      this.draggingMarker = null;
      this.emit("marker-commit", {});
      return;
    }
    if (this.painting) {
      this.painting = false;
      this.emit("paint-commit", {});
      return;
    }
    if (this.scrubbing) {
      this.scrubbing = false;
      this.emit("scrub-end", {});
    }
  }

  private emitPaint(point: { x: number; y: number }): void {
    const plot = this.brightnessPlot;
    this.emit("curve-paint", {
      minute: xToMinute(point.x, plot),
      value: yToBrightness(point.y, plot),
    });
  }

  private emitScrub(x: number): void {
    const plot: Plot = {
      left: GUTTER_LEFT, top: this.scrubTop, width: this.plotWidth, height: SCRUB_HEIGHT,
    };
    this.emit("scrub", { minute: xToMinute(x, plot) });
  }

  private emit(name: string, detail: Record<string, unknown>): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lightcurve-curve-graph": CurveGraph;
  }
}

export const DAY_MINUTES = MINUTES_PER_DAY;
