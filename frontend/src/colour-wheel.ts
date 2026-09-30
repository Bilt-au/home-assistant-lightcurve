/** A hue/saturation wheel with a brightness slider.
 *
 *  Painted with CSS gradients rather than a canvas: a conic gradient for hue and a
 *  white radial gradient over it for saturation. That keeps it crisp at any size,
 *  costs nothing to redraw, and needs no pixel buffer to read back.
 */

import { LitElement, css, html, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { colourToPoint, pointToColour } from "./wheel";

const SIZE = 220;
const RADIUS = SIZE / 2 - 10;

@customElement("lightcurve-colour-wheel")
export class ColourWheel extends LitElement {
  @property({ type: Number }) hue = 0;
  @property({ type: Number }) saturation = 100;
  @property({ type: Number }) brightness = 50;

  private dragging = false;

  static override styles = css`
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      align-items: center;
    }
    .wheel {
      position: relative;
      width: ${SIZE}px;
      height: ${SIZE}px;
      border-radius: 50%;
      touch-action: none;
      cursor: crosshair;
      background:
        radial-gradient(circle closest-side, #fff, rgba(255, 255, 255, 0) 100%),
        conic-gradient(
          hsl(0, 100%, 50%), hsl(30, 100%, 50%), hsl(60, 100%, 50%),
          hsl(90, 100%, 50%), hsl(120, 100%, 50%), hsl(150, 100%, 50%),
          hsl(180, 100%, 50%), hsl(210, 100%, 50%), hsl(240, 100%, 50%),
          hsl(270, 100%, 50%), hsl(300, 100%, 50%), hsl(330, 100%, 50%),
          hsl(360, 100%, 50%)
        );
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
    }
    .handle {
      position: absolute;
      width: 22px;
      height: 22px;
      margin: -11px 0 0 -11px;
      border-radius: 50%;
      border: 3px solid #fff;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
      pointer-events: none;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 180px;
      flex: 1 1 180px;
    }
    label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--secondary-text-color, #666);
    }
    input[type="range"] {
      width: 100%;
      accent-color: var(--primary-color, #03a9f4);
      height: 34px;
    }
    .preview {
      height: 48px;
      border-radius: 10px;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
    }
    .readout {
      font-variant-numeric: tabular-nums;
      font-size: 13px;
      color: var(--secondary-text-color, #666);
    }
  `;

  override render(): TemplateResult {
    const point = colourToPoint(this.hue, this.saturation, SIZE / 2, RADIUS);
    // The preview carries brightness as lightness so the swatch resembles the
    // bulb, rather than showing a vivid colour for a 3% setting.
    const lightness = 12 + (this.brightness / 100) * 43;
    return html`
      <div
        class="wheel"
        @pointerdown=${this.onDown}
        @pointermove=${this.onMove}
        @pointerup=${this.onUp}
        @pointercancel=${this.onUp}
      >
        <div
          class="handle"
          style="left:${point.x}px; top:${point.y}px;
                 background: hsl(${this.hue}, ${this.saturation}%, 50%)"
        ></div>
      </div>
      <div class="side">
        <div
          class="preview"
          style="background: hsl(${this.hue}, ${this.saturation}%, ${lightness}%)"
        ></div>
        <div>
          <label for="brightness">Brightness — ${this.brightness}%</label>
          <input
            id="brightness"
            type="range"
            min="1"
            max="100"
            .value=${String(this.brightness)}
            @input=${(e: Event) =>
              this.emit({ brightness: Number((e.target as HTMLInputElement).value) })}
          />
        </div>
        <div>
          <label for="saturation">Saturation — ${this.saturation}%</label>
          <input
            id="saturation"
            type="range"
            min="0"
            max="100"
            .value=${String(this.saturation)}
            @input=${(e: Event) =>
              this.emit({ saturation: Number((e.target as HTMLInputElement).value) })}
          />
        </div>
        <div class="readout">hue ${Math.round(this.hue)}°</div>
      </div>
    `;
  }

  private pick(event: PointerEvent): void {
    const wheel = this.renderRoot.querySelector(".wheel") as HTMLElement;
    const rect = wheel.getBoundingClientRect();
    const scale = SIZE / rect.width;
    const { hue, saturation } = pointToColour(
      (event.clientX - rect.left) * scale,
      (event.clientY - rect.top) * scale,
      SIZE / 2,
      RADIUS
    );
    this.emit({ hue, saturation });
  }

  private onDown = (event: PointerEvent): void => {
    this.dragging = true;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    this.pick(event);
  };

  private onMove = (event: PointerEvent): void => {
    if (this.dragging) this.pick(event);
  };

  private onUp = (): void => {
    this.dragging = false;
  };

  private emit(change: Partial<{ hue: number; saturation: number; brightness: number }>): void {
    this.dispatchEvent(
      new CustomEvent("colour-change", {
        detail: {
          hue: change.hue ?? this.hue,
          saturation: change.saturation ?? this.saturation,
          brightness: change.brightness ?? this.brightness,
        },
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "lightcurve-colour-wheel": ColourWheel;
  }
}
