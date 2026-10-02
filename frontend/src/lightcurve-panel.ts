/** The Lightcurve editor panel.
 *
 *  Home Assistant injects `hass` and `narrow`; everything else comes from the
 *  integration's own WebSocket commands. The panel holds a working copy of the
 *  profile and only writes on save, so an abandoned edit changes nothing.
 */

import { LitElement, css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./curve-graph";
import "./colour-wheel";
import { applyEditToKeyframes, type Lane } from "./apply-morph";
import type {
  Point,
} from "./fit";
import { formatMinute, parseMinute } from "./geometry";
import {
  applyStroke,
  extendStroke,
  newStroke,
  strokeSpan,
  type Stroke,
} from "./paint";
import { hsToCss, kelvinToCss } from "./wheel";
import type {
  Group,
  Keyframe,
  Profile,
  ProfileSummary,
  ResolvedKeyframe,
  Sample,
  SunEvents,
  Theme,
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
  @state() private themes: Theme[] = [];
  @state() private editingTheme: Theme | null = null;
  /** Which rooms a theme press should reach. Empty means whatever it covers. */
  @state() private themeTarget: string[] = [];
  /** Saturation the colour lane paints with. Hue comes from the cursor height; this
   *  is the other half, and without it a painted colour is always fully saturated. */
  @state() private paintSaturation = 90;
  /** Which keyframe's colour is being picked, if any. */
  @state() private colourPickFor: string | null = null;
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
  /** The stroke in progress, kept out of @state because it changes every pointer
   *  move and Lit re-renders from `samples` anyway. */
  private stroke: Stroke | null = null;

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
    .themes-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px;
    }
    .themes-head h2 { margin-right: auto; }
    .inline-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--secondary-text-color, #666);
    }
    .themes-head h2 {
      margin: 0;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--secondary-text-color, #666);
    }
    button.small { padding: 6px 12px; min-height: 36px; font-size: 13px; }
    .themes {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    .theme-card {
      display: flex;
      flex-direction: column;
      border-radius: 8px;
      overflow: hidden;
      border: 2px solid transparent;
      background: var(--secondary-background-color, #eee);
    }
    .theme-card.holding {
      border-color: var(--primary-color, #03a9f4);
      background: color-mix(in srgb, var(--primary-color, #03a9f4) 14%, transparent);
    }
    button.theme-apply {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      min-height: 64px;
      text-align: left;
      background: transparent;
      color: var(--primary-text-color, #222);
      border-radius: 0;
    }
    .theme-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    /* A separate control rather than one nested inside the apply button: a click
       target inside another click target is both hard to hit and easy to trigger
       by accident. */
    button.theme-edit {
      border-radius: 0;
      min-height: 38px;
      padding: 8px;
      font-size: 13px;
      background: rgba(0, 0, 0, 0.06);
      color: var(--primary-text-color, #222);
      border-top: 1px solid var(--divider-color, #ddd);
    }
    button.theme-edit:hover { background: rgba(0, 0, 0, 0.12); }
    .swatch {
      flex: 0 0 auto;
      width: 14px;
      height: 14px;
      margin-top: 3px;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
    }
    .swatch.inline {
      display: inline-block;
      margin: 0 6px 0 0;
      vertical-align: -2px;
    }
    .swatch.big { width: 22px; height: 22px; }
    button.swatch-button {
      background: none;
      border: none;
      padding: 2px 4px;
      min-height: 0;
      cursor: pointer;
      border-radius: 6px;
    }
    button.swatch-button:hover { background: rgba(0, 0, 0, 0.1); }
    .brush {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin: 12px 0 4px;
    }
    .brush input[type="range"] {
      flex: 1 1 160px;
      max-width: 240px;
      accent-color: var(--primary-color, #03a9f4);
      height: 34px;
    }
    .editor h3 {
      margin: 0;
      font-size: 14px;
      color: var(--primary-text-color, #222);
    }
    .editor {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--divider-color, #e0e0e0);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .editor .row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
    }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--secondary-text-color, #777);
      font-weight: 500;
      padding: 0 8px 8px 0;
      white-space: nowrap;
    }
    td { padding: 4px 8px 4px 0; border-top: 1px solid var(--divider-color, #eee); }
    tr.selected td { background: color-mix(in srgb, var(--primary-color, #03a9f4) 10%, transparent); }
    td.muted { color: var(--secondary-text-color, #888); font-variant-numeric: tabular-nums; }
    input.cell, select.cell {
      padding: 6px 8px;
      min-height: 36px;
      font-size: 13px;
      max-width: 130px;
    }
    input.cell.narrow { max-width: 78px; }
    .sun-pill {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 12px;
      background: var(--secondary-background-color, #eee);
      white-space: nowrap;
    }
    .theme-detail { font-size: 12px; opacity: 0.8; }
    .theme-covers {
      font-size: 11px;
      opacity: 0.6;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
    }
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
      const [profiles, groups, sun, themes] = await Promise.all([
        this.send<{ profiles: ProfileSummary[] }>({ type: "lightcurve/profiles/list" }),
        this.send<{ groups: Group[] }>({ type: "lightcurve/groups/list" }),
        this.send<{ events: SunEvents }>({ type: "lightcurve/sun" }),
        this.send<{ themes: Theme[] }>({ type: "lightcurve/themes/list" }),
      ]);
      this.profiles = profiles.profiles;
      this.groups = groups.groups;
      this.sun = sun.events;
      this.themes = themes.themes;
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

  /** Paint values straight onto the curve as the cursor sweeps.
   *
   *  Every moment the cursor passes takes the cursor's height. Entirely local while
   *  the stroke is in progress: asking the server to re-evaluate per pointer move
   *  would never keep up, so the samples are updated in place and converted back to
   *  keyframes once, on release.
   */
  private onPaint = (event: CustomEvent): void => {
    const { lane, minute, value } = event.detail as {
      lane: Lane;
      minute: number;
      value: number;
    };
    this.stroke = extendStroke(this.stroke ?? newStroke(), minute, value);

    const points: Point[] = this.samples.map((sample) => ({
      minute: sample.minute,
      value: laneValue(sample, lane),
    }));
    const painted = applyStroke(points, this.stroke);
    this.samples = this.samples.map((sample, index) =>
      withLaneValue(sample, lane, painted[index].value, this.paintSaturation)
    );
    this.dirty = true;
  };

  /** On release, fold the painted span back into keyframes and re-evaluate. */
  private onPaintCommit = (event: CustomEvent): void => {
    const stroke = this.stroke;
    this.stroke = null;
    if (!this.profile || !stroke) return;
    const span = strokeSpan(stroke);
    if (!span) return;

    const lane = (event.detail as { lane: Lane }).lane;
    const points: Point[] = this.samples.map((sample) => ({
      minute: sample.minute,
      value: laneValue(sample, lane),
    }));
    const keyframes = applyEditToKeyframes(
      this.keyframes,
      this.resolved,
      lane,
      points,
      { kind: "span", ...span },
      undefined,
      lane === "colour" ? this.paintSaturation : undefined
    );
    this.profile = {
      ...this.profile,
      variants: { ...this.profile.variants, [this.variant]: { keyframes } },
    };
    void this.refreshGraph();
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

  private async refreshThemes(): Promise<void> {
    try {
      const reply = await this.send<{ themes: Theme[] }>({ type: "lightcurve/themes/list" });
      this.themes = reply.themes;
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async applyTheme(theme: Theme): Promise<void> {
    this.error = null;
    try {
      await this.send({
        type: "lightcurve/themes/apply",
        theme_id: theme.id,
        ...(this.themeTarget.length > 0 ? { group_ids: this.themeTarget } : {}),
      });
    } catch (err) {
      // A theme can legitimately reach nothing — an effect the bulbs lack, or a room
      // that is unavailable. Saying so beats a button that appears to do nothing.
      this.error = describeError(err);
    }
    await this.refreshThemes();
  }

  private async releaseThemes(): Promise<void> {
    this.error = null;
    try {
      await this.send({ type: "lightcurve/themes/release" });
    } catch (err) {
      this.error = describeError(err);
    }
    await this.refreshThemes();
  }

  /** Create a profile, starting from the one on screen.
   *
   *  Copying beats starting blank: a new profile almost always wants to be "the
   *  everyday one, but dimmer", and rebuilding a day's curve from two keyframes is
   *  a chore nobody asked for.
   */
  private async newProfile(copyCurrent: boolean): Promise<void> {
    const name = prompt(
      copyCurrent ? "Name for the copy" : "Name for the new profile"
    );
    if (!name) return;
    const id = `p_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`.slice(0, 40);
    const variants =
      copyCurrent && this.profile
        ? JSON.parse(JSON.stringify(this.profile.variants))
        : {
            default: {
              keyframes: [
                {
                  id: "k_morning",
                  time: { type: "fixed", value: "07:00" },
                  colour: { mode: "kelvin", kelvin: 2700 },
                  brightness: 40,
                  easing: "ease_in_out",
                },
                {
                  id: "k_evening",
                  time: { type: "fixed", value: "21:00" },
                  colour: { mode: "kelvin", kelvin: 2200 },
                  brightness: 10,
                  easing: "ease_in_out",
                },
              ],
            },
          };
    try {
      await this.send({
        type: "lightcurve/profiles/save",
        profile: { id, name, variants },
      });
      await this.reloadProfiles();
      await this.openProfile(id);
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async renameProfile(): Promise<void> {
    if (!this.profile) return;
    const name = prompt("Rename profile", this.profile.name);
    if (!name) return;
    this.profile = { ...this.profile, name };
    await this.save();
    await this.reloadProfiles();
  }

  private async deleteProfile(): Promise<void> {
    if (!this.profile) return;
    try {
      await this.send({
        type: "lightcurve/profiles/delete",
        profile_id: this.profile.id,
      });
      await this.reloadProfiles();
      if (this.profiles.length > 0) await this.openProfile(this.profiles[0].id);
    } catch (err) {
      // Deleting one still in use is refused by the store, which is the right
      // answer — a room pointing at nothing has no curve to follow.
      this.error = describeError(err);
    }
  }

  private async reloadProfiles(): Promise<void> {
    const reply = await this.send<{ profiles: ProfileSummary[] }>({
      type: "lightcurve/profiles/list",
    });
    this.profiles = reply.profiles;
  }

  private async reloadGroups(): Promise<void> {
    const reply = await this.send<{ groups: Group[] }>({
      type: "lightcurve/groups/list",
    });
    this.groups = reply.groups;
  }

  /** Point one room at a different profile, so the bathroom need not follow the
   *  lounge. */
  private async assignProfile(group: Group, profileId: string): Promise<void> {
    this.error = null;
    try {
      // A narrow command rather than saving the whole group back: the panel does
      // not hold power_restore, the sleep values or the override timeout, and
      // round-tripping a partial group would quietly reset them.
      await this.send({
        type: "lightcurve/groups/set_profile",
        group_id: group.id,
        profile_id: profileId,
      });
      await Promise.all([this.reloadGroups(), this.reloadProfiles()]);
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private editTheme(theme: Theme | null): void {
    // A working copy: abandoning the editor should change nothing.
    this.editingTheme = theme
      ? (JSON.parse(JSON.stringify(theme)) as Theme)
      : {
          id: `t_${Math.random().toString(36).slice(2, 8)}`,
          name: "New theme",
          mode: "static",
          colour: { mode: "hs", hs: [30, 80] },
          brightness: 50,
          effect: null,
          groups: [],
          hold_minutes: null,
          covers: [],
          holding: false,
        };
  }

  private patchTheme(change: Partial<Theme>): void {
    if (!this.editingTheme) return;
    this.editingTheme = { ...this.editingTheme, ...change };
  }

  private async saveTheme(): Promise<void> {
    if (!this.editingTheme) return;
    const { covers: _covers, holding: _holding, ...payload } = this.editingTheme;
    this.error = null;
    try {
      await this.send({ type: "lightcurve/themes/save", theme: payload });
      this.editingTheme = null;
      await this.refreshThemes();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async deleteTheme(): Promise<void> {
    if (!this.editingTheme) return;
    try {
      await this.send({
        type: "lightcurve/themes/delete",
        theme_id: this.editingTheme.id,
      });
      this.editingTheme = null;
      await this.refreshThemes();
    } catch (err) {
      this.error = describeError(err);
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
        <button class="secondary small" @click=${() => void this.newProfile(true)}>
          Duplicate
        </button>
        <button class="secondary small" @click=${() => void this.newProfile(false)}>
          New profile
        </button>
        <button class="secondary small" @click=${() => void this.renameProfile()}>
          Rename
        </button>
        <button
          class="secondary small"
          ?disabled=${this.profiles.length <= 1}
          title=${this.profiles.length <= 1
            ? "The last profile cannot be deleted"
            : "Delete this profile"}
          @click=${() => void this.deleteProfile()}
        >
          Delete profile
        </button>
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
          @curve-paint=${this.onPaint}
          @paint-commit=${this.onPaintCommit}
          @scrub=${this.onScrub}
          @scrub-end=${this.onScrubEnd}
        ></lightcurve-curve-graph>
        <div class="brush">
          <span class="inline-label">Colour lane paints</span>
          <span
            class="swatch inline big"
            style="background:${hsToCss(30, this.paintSaturation)}"
          ></span>
          <label class="inline-label" for="sat">saturation ${this.paintSaturation}%</label>
          <input
            id="sat"
            type="range"
            min="0"
            max="100"
            .value=${String(this.paintSaturation)}
            @input=${(e: Event) => {
              this.paintSaturation = Number((e.target as HTMLInputElement).value);
            }}
          />
          <span class="hint">
            Hue comes from how high you drag; this sets how strong the colour is.
            Low values give a washed, pastel light; 100% is fully saturated.
          </span>
        </div>
        <p class="hint">
          Drag across a lane to draw it: every moment your cursor passes takes its
          height. Keyframes are rebuilt from what you drew, and the ones you did not
          paint over are left alone. The strip at the bottom previews a time of day
          on ${group ? group.name : "the selected room"}.
        </p>
      </div>

      ${this.renderRooms()}

      ${this.renderKeyframeTable()}

      ${this.renderThemes()}

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

  /** Buttons for the saved themes, and the editor for one of them. */
  private renderThemes(): TemplateResult {
    if (this.themes.length === 0) return html`${nothing}`;
    const anyHolding = this.themes.some((theme) => theme.holding);
    return html`
      <div class="card">
        <div class="themes-head">
          <h2>Themes</h2>
          <label class="inline-label" for="theme-target">Apply to</label>
          <select
            id="theme-target"
            class="cell"
            @change=${(e: Event) => {
              const value = (e.target as HTMLSelectElement).value;
              this.themeTarget = value === "" ? [] : [value];
            }}
          >
            <option value="" ?selected=${this.themeTarget.length === 0}>
              rooms each theme covers
            </option>
            ${this.groups.map(
              (group) => html`<option
                value=${group.id}
                ?selected=${this.themeTarget[0] === group.id}
              >
                ${group.name} only
              </option>`
            )}
          </select>
          <button class="secondary small" @click=${() => this.editTheme(null)}>
            New theme
          </button>
          <button
            class="secondary small"
            ?disabled=${!anyHolding}
            title=${anyHolding
              ? "Return every room to its curve"
              : "Nothing is holding a theme"}
            @click=${() => void this.releaseThemes()}
          >
            Back to curve
          </button>
        </div>
        <div class="themes">
          ${this.themes.map(
            (theme) => html`
              <div class="theme-card ${theme.holding ? "holding" : ""}">
                <button
                  class="theme-apply"
                  @click=${() => void this.applyTheme(theme)}
                  title=${`Apply to ${theme.covers.join(", ")}`}
                >
                  <span class="swatch" style="background:${themeSwatch(theme)}"></span>
                  <span class="theme-text">
                    <span class="theme-name">${theme.name}</span>
                    <span class="theme-detail">
                      ${theme.mode === "effect"
                        ? theme.effect
                        : `${theme.brightness}%${
                            theme.colour?.mode === "kelvin"
                              ? ` · ${theme.colour.kelvin}K`
                              : ""
                          }`}
                    </span>
                    <span class="theme-covers">${theme.covers.join(", ")}</span>
                  </span>
                </button>
                <button
                  class="theme-edit"
                  @click=${() => this.editTheme(theme)}
                  title=${`Edit ${theme.name}`}
                >
                  Edit
                </button>
              </div>
            `
          )}
        </div>
        <p class="hint">
          A theme holds its values against the curve. Switch the room off and on, or
          press Back to curve, to release it.
        </p>
        ${this.editingTheme ? this.renderThemeEditor(this.editingTheme) : nothing}
      </div>
    `;
  }

  private renderThemeEditor(theme: Theme): TemplateResult {
    const hs = theme.colour?.hs ?? [30, 80];
    const existing = this.themes.some((t) => t.id === theme.id);
    return html`
      <div class="editor">
        <h3>${existing ? `Editing ${theme.name}` : "New theme"}</h3>
        <div class="row">
          <div class="grow">
            <label for="theme-name">Name</label>
            <input
              id="theme-name"
              .value=${theme.name}
              @change=${(e: Event) =>
                this.patchTheme({ name: (e.target as HTMLInputElement).value })}
            />
          </div>
          <div>
            <label for="theme-mode">Type</label>
            <select
              id="theme-mode"
              @change=${(e: Event) => {
                const mode = (e.target as HTMLSelectElement).value as Theme["mode"];
                this.patchTheme(
                  mode === "effect"
                    ? { mode, effect: theme.effect ?? "", colour: null, brightness: null }
                    : {
                        mode,
                        effect: null,
                        colour: theme.colour ?? { mode: "hs", hs: [30, 80] },
                        brightness: theme.brightness ?? 50,
                      }
                );
              }}
            >
              <option value="static" ?selected=${theme.mode === "static"}>
                Colour and brightness
              </option>
              <option value="effect" ?selected=${theme.mode === "effect"}>
                Bulb effect
              </option>
            </select>
          </div>
        </div>

        ${theme.mode === "effect"
          ? html`<div class="row">
              <div class="grow">
                <label for="theme-effect">Effect name</label>
                <input
                  id="theme-effect"
                  .value=${theme.effect ?? ""}
                  placeholder="Party"
                  @change=${(e: Event) =>
                    this.patchTheme({ effect: (e.target as HTMLInputElement).value })}
                />
                <p class="hint">
                  The bulb runs this itself. It must be one your bulbs offer — check
                  the light's effect list in Developer Tools.
                </p>
              </div>
            </div>`
          : html`
              <lightcurve-colour-wheel
                .hue=${hs[0]}
                .saturation=${hs[1]}
                .brightness=${theme.brightness ?? 50}
                @colour-change=${(e: CustomEvent) =>
                  this.patchTheme({
                    colour: { mode: "hs", hs: [e.detail.hue, e.detail.saturation] },
                    brightness: e.detail.brightness,
                  })}
              ></lightcurve-colour-wheel>
            `}

        <div class="row">
          <div class="grow">
            <label for="theme-groups">Rooms</label>
            <select
              id="theme-groups"
              multiple
              size=${Math.min(4, Math.max(2, this.groups.length))}
              @change=${(e: Event) => {
                const select = e.target as HTMLSelectElement;
                this.patchTheme({
                  groups: Array.from(select.selectedOptions).map((o) => o.value),
                });
              }}
            >
              ${this.groups.map(
                (group) => html`<option
                  value=${group.id}
                  ?selected=${theme.groups.includes(group.id)}
                >
                  ${group.name}
                </option>`
              )}
            </select>
            <p class="hint">Select none to cover every room.</p>
          </div>
          <div>
            <label for="theme-hold">Release after (min)</label>
            <input
              id="theme-hold"
              type="number"
              min="1"
              max="1440"
              .value=${theme.hold_minutes === null ? "" : String(theme.hold_minutes)}
              placeholder="never"
              @change=${(e: Event) => {
                const raw = (e.target as HTMLInputElement).value;
                this.patchTheme({ hold_minutes: raw === "" ? null : Number(raw) });
              }}
            />
          </div>
        </div>

        <div class="row">
          <button @click=${() => void this.saveTheme()}>Save theme</button>
          <button class="secondary" @click=${() => (this.editingTheme = null)}>
            Cancel
          </button>
          <div class="grow"></div>
          ${existing
            ? html`<button class="secondary" @click=${() => void this.deleteTheme()}>
                Delete
              </button>`
            : nothing}
        </div>
      </div>
    `;
  }

  /** Every keyframe as a row, for precise editing the graph cannot offer.
   *
   *  Dragging is good for shape and hopeless for "make this exactly 06:30". Both
   *  views edit the same profile, so a change here redraws the graph and vice versa.
   */
  /** Which curve each room follows.
   *
   *  Groups already carried their own profile, but nothing exposed it, so every room
   *  was stuck on whichever profile it was created with. The bathroom wanting a
   *  different day from the lounge is the ordinary case, not an advanced one.
   */
  private renderRooms(): TemplateResult {
    if (this.groups.length === 0) return html`${nothing}`;
    return html`
      <div class="card">
        <div class="themes-head">
          <h2>Rooms</h2>
          <span class="hint">
            Add or remove rooms in Settings → Devices &amp; Services → Lightcurve →
            Configure
          </span>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>Room</th><th>Curve</th><th>Lights</th><th>State</th></tr>
            </thead>
            <tbody>
              ${this.groups.map(
                (group) => html`
                  <tr>
                    <td>${group.name}</td>
                    <td>
                      <select
                        class="cell"
                        @change=${(e: Event) =>
                          void this.assignProfile(
                            group,
                            (e.target as HTMLSelectElement).value
                          )}
                      >
                        ${this.profiles.map(
                          (profile) => html`<option
                            value=${profile.id}
                            ?selected=${profile.id === group.profile_id}
                          >
                            ${profile.name}
                          </option>`
                        )}
                      </select>
                    </td>
                    <td class="muted">
                      ${group.members_available.length}${group.members_available.length !==
                      group.members_resolved.length
                        ? ` of ${group.members_resolved.length}`
                        : ""}
                    </td>
                    <td class="muted">
                      ${!group.enabled
                        ? "curve off"
                        : group.override_colour || group.override_brightness
                          ? "held"
                          : group.is_on
                            ? "following"
                            : "off"}
                    </td>
                  </tr>
                `
              )}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private renderKeyframeTable(): TemplateResult {
    const byId = new Map(this.resolved.map((r) => [r.id, r]));
    const rows = [...this.keyframes].sort(
      (a, b) => (byId.get(a.id)?.minute ?? 0) - (byId.get(b.id)?.minute ?? 0)
    );
    return html`
      <div class="card">
        <div class="themes-head">
          <h2>Keyframes</h2>
          <span class="hint">${rows.length} of 48</span>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th><th>Resolves</th><th>Colour</th>
                <th>Brightness</th><th>Easing</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((keyframe) => this.renderKeyframeRow(keyframe, byId))}
            </tbody>
          </table>
        </div>
        ${this.colourPickFor ? this.renderKeyframeColour(this.colourPickFor) : nothing}
      </div>
    `;
  }

  /** Pick one keyframe's colour exactly.
   *
   *  Dragging the colour lane is good for a sweep and useless for "this precise
   *  orange". A keyframe can also be switched between a colour temperature and a
   *  colour here, which is the only way to turn part of a white curve into a
   *  coloured section without painting over it.
   */
  private renderKeyframeColour(keyframeId: string): TemplateResult {
    const keyframe = this.keyframes.find((k) => k.id === keyframeId);
    if (!keyframe) return html`${nothing}`;
    const hs = keyframe.colour.hs ?? [30, 90];
    return html`
      <div class="editor">
        <h3>Colour at ${this.resolved.find((r) => r.id === keyframeId)
          ? formatMinute(this.resolved.find((r) => r.id === keyframeId)!.minute)
          : keyframeId}</h3>
        <div class="row">
          <div>
            <label for="kf-mode">Type</label>
            <select
              id="kf-mode"
              @change=${(e: Event) => {
                const mode = (e.target as HTMLSelectElement).value;
                this.mutate(keyframe.id, (k) => {
                  k.colour =
                    mode === "kelvin"
                      ? { mode: "kelvin", kelvin: 2700 }
                      : { mode: "hs", hs: [30, 90] };
                });
                void this.refreshGraph();
              }}
            >
              <option value="kelvin" ?selected=${keyframe.colour.mode === "kelvin"}>
                White (colour temperature)
              </option>
              <option value="hs" ?selected=${keyframe.colour.mode === "hs"}>
                Colour
              </option>
            </select>
          </div>
          ${keyframe.colour.mode === "kelvin"
            ? html`<div class="grow">
                <label for="kf-kelvin">
                  ${keyframe.colour.kelvin}K — warm to cool
                </label>
                <input
                  id="kf-kelvin"
                  type="range"
                  min="2200"
                  max="6500"
                  step="50"
                  .value=${String(keyframe.colour.kelvin ?? 2700)}
                  @input=${(e: Event) => {
                    this.mutate(keyframe.id, (k) => {
                      k.colour = {
                        mode: "kelvin",
                        kelvin: Number((e.target as HTMLInputElement).value),
                      };
                    });
                  }}
                  @change=${() => void this.refreshGraph()}
                />
              </div>`
            : nothing}
        </div>
        ${keyframe.colour.mode === "hs"
          ? html`<lightcurve-colour-wheel
              .hue=${hs[0]}
              .saturation=${hs[1]}
              .brightness=${keyframe.brightness}
              @colour-change=${(e: CustomEvent) => {
                this.mutate(keyframe.id, (k) => {
                  k.colour = {
                    mode: "hs",
                    hs: [e.detail.hue, e.detail.saturation],
                  };
                  k.brightness = e.detail.brightness;
                });
                void this.refreshGraph();
              }}
            ></lightcurve-colour-wheel>`
          : nothing}
        <div class="row">
          <button class="secondary" @click=${() => (this.colourPickFor = null)}>
            Done
          </button>
        </div>
      </div>
    `;
  }

  private renderKeyframeRow(
    keyframe: Keyframe,
    byId: Map<string, ResolvedKeyframe>
  ): TemplateResult {
    const resolved = byId.get(keyframe.id);
    const isSun = keyframe.time.type === "sun";
    const swatch =
      keyframe.colour.mode === "kelvin"
        ? kelvinToCss(keyframe.colour.kelvin ?? 3000)
        : hsToCss(keyframe.colour.hs?.[0] ?? 0, keyframe.colour.hs?.[1] ?? 100);
    return html`
      <tr class=${this.selectedId === keyframe.id ? "selected" : ""}
          @click=${() => (this.selectedId = keyframe.id)}>
        <td>
          ${isSun
            ? html`<span class="sun-pill" title="Follows the sun, so it moves daily">
                ${keyframe.time.event}${(keyframe.time.offset_min ?? 0) !== 0
                  ? ` ${keyframe.time.offset_min! > 0 ? "+" : ""}${keyframe.time.offset_min}m`
                  : ""}
              </span>`
            : html`<input
                class="cell"
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
        </td>
        <td class="muted">
          ${resolved ? formatMinute(resolved.minute) : "—"}
        </td>
        <td>
          <button
            class="swatch-button"
            title="Pick this keyframe's colour"
            @click=${(e: Event) => {
              e.stopPropagation();
              this.selectedId = keyframe.id;
              this.colourPickFor =
                this.colourPickFor === keyframe.id ? null : keyframe.id;
            }}
          >
            <span class="swatch inline" style="background:${swatch}"></span>
          </button>
          ${keyframe.colour.mode === "kelvin"
            ? html`<input
                class="cell narrow"
                type="number"
                min="1000"
                max="20000"
                step="50"
                .value=${String(keyframe.colour.kelvin ?? 3000)}
                @change=${(e: Event) => {
                  this.mutate(keyframe.id, (k) => {
                    k.colour = {
                      mode: "kelvin",
                      kelvin: Number((e.target as HTMLInputElement).value),
                    };
                  });
                  void this.refreshGraph();
                }}
              />K`
            : html`<input
                class="cell narrow"
                type="number"
                min="0"
                max="360"
                .value=${String(Math.round(keyframe.colour.hs?.[0] ?? 0))}
                @change=${(e: Event) => {
                  const saturation = keyframe.colour.hs?.[1] ?? 100;
                  this.mutate(keyframe.id, (k) => {
                    k.colour = {
                      mode: "hs",
                      hs: [Number((e.target as HTMLInputElement).value), saturation],
                    };
                  });
                  void this.refreshGraph();
                }}
              />°`}
        </td>
        <td>
          <input
            class="cell narrow"
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
          />%
        </td>
        <td>
          <select
            class="cell"
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
        </td>
        <td>
          <button
            class="secondary small"
            ?disabled=${this.keyframes.length <= 2}
            @click=${(e: Event) => {
              e.stopPropagation();
              this.selectedId = keyframe.id;
              this.deleteSelected();
            }}
          >✕</button>
        </td>
      </tr>
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

/** Read one lane's value out of a sample. */
/** A representative colour for a theme, for its button swatch. */
function themeSwatch(theme: Theme): string {
  if (theme.mode === "effect") {
    return "linear-gradient(135deg, #ff4081, #7c4dff, #00bcd4)";
  }
  if (theme.colour?.mode === "kelvin") {
    return kelvinToCss(theme.colour.kelvin ?? 3000);
  }
  const hs = theme.colour?.hs ?? [30, 80];
  return hsToCss(hs[0], hs[1]);
}

function laneValue(sample: Sample, lane: Lane): number {
  if (lane === "brightness") return sample.brightness_pct ?? 1;
  if (lane === "warmth") return sample.kelvin ?? 2700;
  return sample.hs ? sample.hs[0] : 0;
}

/** Put a morphed value back into a sample, keeping the rest of it intact. */
function withLaneValue(
  sample: Sample,
  lane: Lane,
  value: number,
  saturation?: number
): Sample {
  if (lane === "brightness") {
    return { ...sample, brightness_pct: Math.round(value) };
  }
  if (lane === "warmth") {
    return { ...sample, mode: "kelvin", kelvin: Math.round(value) };
  }
  const s = saturation ?? (sample.hs ? sample.hs[1] : 100);
  return { ...sample, mode: "hs", hs: [Math.round(value) % 360, Math.round(s)] };
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
