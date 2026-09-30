/** The Lightcurve editor panel.
 *
 *  Home Assistant injects `hass` and `narrow`; everything else comes from the
 *  integration's own WebSocket commands. The panel holds a working copy of the
 *  profile and only writes on save, so an abandoned edit changes nothing.
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./curve-graph";
import { formatMinute, parseMinute } from "./geometry";
import type {
  Group,
  Keyframe,
  Profile,
  ProfileSummary,
  ResolvedKeyframe,
  Sample,
  SunEvents,
  ValidationIssue,
} from "./types";

interface Hass {
  connection: {
    sendMessagePromise<T>(message: Record<string, unknown>): Promise<T>;
  };
  themes?: unknown;
}

const SCRUB_THROTTLE_MS = 300;

@customElement("lightcurve-panel")
export class LightcurvePanel extends LitElement {
  @property({ attribute: false }) hass!: Hass;
  @property({ type: Boolean }) narrow = false;

  @state() private profiles: ProfileSummary[] = [];
  @state() private groups: Group[] = [];
  @state() private profile: Profile | null = null;
  @state() private variant = "default";
  @state() private samples: Sample[] = [];
  @state() private resolved: ResolvedKeyframe[] = [];
  @state() private sun: SunEvents = {};
  @state() private issues: ValidationIssue[] = [];
  @state() private selectedId: string | null = null;
  @state() private previewGroupId: string | null = null;
  @state() private scrubMinute: number | null = null;
  @state() private dirty = false;
  @state() private busy = false;
  @state() private error: string | null = null;
  @state() private graphWidth = 900;

  private lastScrubAt = 0;
  private resizeObserver?: ResizeObserver;

  static override styles = css`
    :host {
      display: block;
      padding: 16px;
      box-sizing: border-box;
      background: var(--primary-background-color, #fafafa);
      min-height: 100%;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
    }
    .grow { flex: 1 1 auto; }
    label {
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--secondary-text-color, #666);
      margin-bottom: 4px;
    }
    select, input {
      font: inherit;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid var(--divider-color, #ddd);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #222);
      min-height: 40px;
      box-sizing: border-box;
    }
    button {
      font: inherit;
      padding: 10px 16px;
      min-height: 44px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
    }
    button.secondary {
      background: var(--secondary-background-color, #eee);
      color: var(--primary-text-color, #222);
    }
    button:disabled { opacity: 0.5; cursor: default; }
    .card {
      background: var(--card-background-color, #fff);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
      box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.08));
    }
    .issues { list-style: none; margin: 0; padding: 0; }
    .issues li {
      padding: 8px 10px;
      border-radius: 8px;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .issues li.error {
      background: color-mix(in srgb, var(--error-color, #d32f2f) 12%, transparent);
      color: var(--error-color, #d32f2f);
    }
    .issues li.warning {
      background: color-mix(in srgb, var(--warning-color, #ffa600) 16%, transparent);
      color: var(--primary-text-color, #333);
    }
    .sheet {
      position: sticky;
      bottom: 0;
      background: var(--card-background-color, #fff);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.12);
    }
    .sheet .row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
    }
    .hint { color: var(--secondary-text-color, #777); font-size: 13px; }
    .error-banner {
      background: var(--error-color, #d32f2f);
      color: #fff;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    @media (max-width: 700px) {
      .bar > * { flex: 1 1 100%; }
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 900;
      this.graphWidth = Math.max(320, Math.round(width - 32));
    });
    this.resizeObserver.observe(this);
    void this.load();
  }

  override disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    // Leaving the panel mid-preview would strand the lights at a scrubbed time.
    if (this.previewGroupId) void this.stopPreview();
    super.disconnectedCallback();
  }

  private async send<T>(message: Record<string, unknown>): Promise<T> {
    return this.hass.connection.sendMessagePromise<T>(message);
  }

  private async load(): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      const [profiles, groups, sun] = await Promise.all([
        this.send<{ profiles: ProfileSummary[] }>({ type: "lightcurve/profiles/list" }),
        this.send<{ groups: Group[] }>({ type: "lightcurve/groups/list" }),
        this.send<{ events: SunEvents }>({ type: "lightcurve/sun" }),
      ]);
      this.profiles = profiles.profiles;
      this.groups = groups.groups;
      this.sun = sun.events;
      this.previewGroupId ??= this.groups[0]?.id ?? null;
      if (this.profiles.length > 0) {
        await this.openProfile(this.profiles[0].id);
      }
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async openProfile(profileId: string): Promise<void> {
    const reply = await this.send<{ profile: Profile }>({
      type: "lightcurve/profiles/get",
      profile_id: profileId,
    });
    this.profile = reply.profile;
    this.variant = Object.keys(reply.profile.variants)[0] ?? "default";
    this.dirty = false;
    this.selectedId = null;
    await this.refreshGraph();
  }

  /** Redraw from the server so the curve shown is the engine's, not an approximation. */
  private async refreshGraph(): Promise<void> {
    if (!this.profile) return;
    try {
      const [evaluated, validated] = await Promise.all([
        this.send<{ samples: Sample[]; keyframes: ResolvedKeyframe[] }>({
          type: "lightcurve/evaluate",
          profile_id: this.profile.id,
          variant: this.variant,
          step_minutes: 5,
        }),
        this.send<{ issues: ValidationIssue[] }>({
          type: "lightcurve/profiles/validate",
          profile: this.profile,
        }),
      ]);
      this.samples = evaluated.samples;
      this.resolved = evaluated.keyframes;
      this.issues = validated.issues;
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private get keyframes(): Keyframe[] {
    return this.profile?.variants[this.variant]?.keyframes ?? [];
  }

  private get selected(): Keyframe | undefined {
    return this.keyframes.find((k) => k.id === this.selectedId);
  }

  private get blocked(): boolean {
    return this.issues.some((issue) => issue.level === "error");
  }

  // --- editing --------------------------------------------------------------

  private mutate(id: string, change: (keyframe: Keyframe) => void): void {
    if (!this.profile) return;
    const keyframes = this.keyframes.map((keyframe) => {
      if (keyframe.id !== id) return keyframe;
      const copy: Keyframe = JSON.parse(JSON.stringify(keyframe));
      change(copy);
      return copy;
    });
    this.profile = {
      ...this.profile,
      variants: { ...this.profile.variants, [this.variant]: { keyframes } },
    };
    this.dirty = true;
  }

  private onKeyframeMove = (event: CustomEvent): void => {
    const { id, minute, sunEvent, brightness, kelvin, hue } = event.detail;
    this.mutate(id, (keyframe) => {
      if (sunEvent) {
        // Dropping a keyframe onto a sun marker should make it follow that event,
        // not pin it to the clock time the event happens to have today.
        keyframe.time = { type: "sun", event: sunEvent, offset_min: 0 };
      } else {
        keyframe.time = { type: "fixed", value: formatMinute(minute) };
      }
      if (brightness !== undefined) keyframe.brightness = brightness;
      if (kelvin !== undefined) keyframe.colour = { mode: "kelvin", kelvin };
      if (hue !== undefined) {
        const saturation = keyframe.colour.hs?.[1] ?? 100;
        keyframe.colour = { mode: "hs", hs: [hue, saturation] };
      }
    });
  };

  private onKeyframeCommit = (): void => {
    void this.refreshGraph();
  };

  private onSelect = (event: CustomEvent): void => {
    this.selectedId = event.detail.id;
  };

  private onScrub = (event: CustomEvent): void => {
    this.scrubMinute = event.detail.minute;
    const now = Date.now();
    // Throttled because each one drives real bulbs over Wi-Fi.
    if (now - this.lastScrubAt < SCRUB_THROTTLE_MS) return;
    this.lastScrubAt = now;
    void this.previewAt(event.detail.minute);
  };

  private onScrubEnd = (): void => {
    this.scrubMinute = null;
    void this.stopPreview();
  };

  private async previewAt(minute: number): Promise<void> {
    if (!this.previewGroupId || !this.profile) return;
    try {
      await this.send({
        type: "lightcurve/preview/start",
        group_id: this.previewGroupId,
        minute,
        profile_id: this.profile.id,
        variant: this.variant,
      });
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async stopPreview(): Promise<void> {
    if (!this.previewGroupId) return;
    try {
      await this.send({ type: "lightcurve/preview/stop", group_id: this.previewGroupId });
    } catch {
      // The group may have gone away; nothing useful to do here.
    }
  }

  private async save(): Promise<void> {
    if (!this.profile || this.blocked) return;
    this.busy = true;
    this.error = null;
    try {
      await this.send({ type: "lightcurve/profiles/save", profile: this.profile });
      this.dirty = false;
      await this.refreshGraph();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async revert(): Promise<void> {
    if (this.profile) await this.openProfile(this.profile.id);
  }

  private addKeyframe(): void {
    if (!this.profile) return;
    const minute = this.scrubMinute ?? 12 * 60;
    const id = `k_${Math.random().toString(36).slice(2, 8)}`;
    const keyframes = [
      ...this.keyframes,
      {
        id,
        time: { type: "fixed" as const, value: formatMinute(minute) },
        colour: { mode: "kelvin" as const, kelvin: 3000 },
        brightness: 50,
        easing: "ease_in_out" as const,
      },
    ];
    this.profile = {
      ...this.profile,
      variants: { ...this.profile.variants, [this.variant]: { keyframes } },
    };
    this.selectedId = id;
    this.dirty = true;
    void this.refreshGraph();
  }

  private deleteSelected(): void {
    if (!this.profile || !this.selectedId) return;
    const keyframes = this.keyframes.filter((k) => k.id !== this.selectedId);
    this.profile = {
      ...this.profile,
      variants: { ...this.profile.variants, [this.variant]: { keyframes } },
    };
    this.selectedId = null;
    this.dirty = true;
    void this.refreshGraph();
  }

  // --- rendering ------------------------------------------------------------

  override render(): TemplateResult {
    const group = this.groups.find((g) => g.id === this.previewGroupId);
    return html`
      ${this.error ? html`<div class="error-banner">${this.error}</div>` : nothing}
      <div class="bar">
        <div>
          <label for="profile">Profile</label>
          <select id="profile" @change=${(e: Event) =>
            void this.openProfile((e.target as HTMLSelectElement).value)}>
            ${this.profiles.map(
              (p) => html`<option value=${p.id} ?selected=${p.id === this.profile?.id}>
                ${p.name}${p.used_by.length > 1 ? ` (${p.used_by.length} rooms)` : ""}
              </option>`
            )}
          </select>
        </div>
        <div>
          <label for="group">Preview on</label>
          <select id="group" @change=${(e: Event) => {
            this.previewGroupId = (e.target as HTMLSelectElement).value;
          }}>
            ${this.groups.map(
              (g) => html`<option value=${g.id} ?selected=${g.id === this.previewGroupId}>
                ${g.name}
              </option>`
            )}
          </select>
        </div>
        <div class="grow"></div>
        <button class="secondary" @click=${this.addKeyframe}>Add keyframe</button>
        <button class="secondary" ?disabled=${!this.dirty} @click=${() => void this.revert()}>
          Revert
        </button>
        <button
          ?disabled=${!this.dirty || this.blocked || this.busy}
          @click=${() => void this.save()}
        >
          ${this.blocked ? "Fix errors to save" : "Save"}
        </button>
      </div>

      <div class="card">
        <lightcurve-curve-graph
          .samples=${this.samples}
          .keyframes=${this.resolved}
          .sun=${this.sun}
          .selectedId=${this.selectedId}
          .scrubMinute=${this.scrubMinute}
          .width=${this.graphWidth}
          .nowMinute=${nowMinute()}
          @keyframe-move=${this.onKeyframeMove}
          @keyframe-commit=${this.onKeyframeCommit}
          @keyframe-select=${this.onSelect}
          @scrub=${this.onScrub}
          @scrub-end=${this.onScrubEnd}
        ></lightcurve-curve-graph>
        <p class="hint">
          Drag a handle to move a keyframe. Drop one near a sun marker to make it
          follow that event. Drag anywhere else to preview that time of day on
          ${group ? group.name : "the selected room"}.
        </p>
      </div>

      ${this.issues.length > 0
        ? html`<div class="card">
            <ul class="issues">
              ${this.issues.map(
                (issue) => html`<li class=${issue.level}>${issue.message}</li>`
              )}
            </ul>
          </div>`
        : nothing}

      ${this.selected ? this.renderSheet(this.selected) : nothing}
    `;
  }

  private renderSheet(keyframe: Keyframe): TemplateResult {
    return html`
      <div class="sheet">
        <div class="row">
          <div>
            <label for="time">Time</label>
            ${keyframe.time.type === "sun"
              ? html`<input id="time" .value=${`${keyframe.time.event} ${
                  keyframe.time.offset_min ?? 0
                }m`} readonly />`
              : html`<input
                  id="time"
                  .value=${keyframe.time.value ?? "00:00"}
                  @change=${(e: Event) => {
                    const minute = parseMinute((e.target as HTMLInputElement).value);
                    if (minute === null) return;
                    this.mutate(keyframe.id, (k) => {
                      k.time = { type: "fixed", value: formatMinute(minute) };
                    });
                    void this.refreshGraph();
                  }}
                />`}
          </div>
          <div>
            <label for="brightness">Brightness %</label>
            <input
              id="brightness"
              type="number"
              min="1"
              max="100"
              .value=${String(keyframe.brightness)}
              @change=${(e: Event) => {
                this.mutate(keyframe.id, (k) => {
                  k.brightness = Number((e.target as HTMLInputElement).value);
                });
                void this.refreshGraph();
              }}
            />
          </div>
          <div>
            <label for="mode">Colour</label>
            <select
              id="mode"
              @change=${(e: Event) => {
                const mode = (e.target as HTMLSelectElement).value;
                this.mutate(keyframe.id, (k) => {
                  k.colour =
                    mode === "kelvin"
                      ? { mode: "kelvin", kelvin: 3000 }
                      : { mode: "hs", hs: [0, 100] };
                });
                void this.refreshGraph();
              }}
            >
              <option value="kelvin" ?selected=${keyframe.colour.mode === "kelvin"}>
                Colour temperature
              </option>
              <option value="hs" ?selected=${keyframe.colour.mode === "hs"}>
                Colour
              </option>
            </select>
          </div>
          <div>
            <label for="easing">Easing</label>
            <select
              id="easing"
              @change=${(e: Event) => {
                this.mutate(keyframe.id, (k) => {
                  k.easing = (e.target as HTMLSelectElement).value as Keyframe["easing"];
                });
                void this.refreshGraph();
              }}
            >
              ${["linear", "ease_in_out", "step"].map(
                (option) => html`<option value=${option} ?selected=${keyframe.easing === option}>
                  ${option}
                </option>`
              )}
            </select>
          </div>
          <div class="grow"></div>
          <button
            class="secondary"
            ?disabled=${this.keyframes.length <= 2}
            @click=${this.deleteSelected}
            title=${this.keyframes.length <= 2 ? "A profile needs at least two keyframes" : ""}
          >
            Delete
          </button>
        </div>
      </div>
    `;
  }
}

function nowMinute(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function describeError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) return String(err.message);
  return String(err);
}

declare global {
  interface HTMLElementTagNameMap {
    "lightcurve-panel": LightcurvePanel;
  }
}
