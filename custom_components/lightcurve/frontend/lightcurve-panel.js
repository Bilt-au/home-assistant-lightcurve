/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Z = globalThis, ht = Z.ShadowRoot && (Z.ShadyCSS === void 0 || Z.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, ct = Symbol(), bt = /* @__PURE__ */ new WeakMap();
let Ht = class {
  constructor(t, i, s) {
    if (this._$cssResult$ = !0, s !== ct) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = i;
  }
  get styleSheet() {
    let t = this.o;
    const i = this.t;
    if (ht && t === void 0) {
      const s = i !== void 0 && i.length === 1;
      s && (t = bt.get(i)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), s && bt.set(i, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const Ft = (e) => new Ht(typeof e == "string" ? e : e + "", void 0, ct), dt = (e, ...t) => {
  const i = e.length === 1 ? e[0] : t.reduce((s, r, o) => s + ((n) => {
    if (n._$cssResult$ === !0) return n.cssText;
    if (typeof n == "number") return n;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + n + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(r) + e[o + 1], e[0]);
  return new Ht(i, e, ct);
}, Wt = (e, t) => {
  if (ht) e.adoptedStyleSheets = t.map((i) => i instanceof CSSStyleSheet ? i : i.styleSheet);
  else for (const i of t) {
    const s = document.createElement("style"), r = Z.litNonce;
    r !== void 0 && s.setAttribute("nonce", r), s.textContent = i.cssText, e.appendChild(s);
  }
}, $t = ht ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((t) => {
  let i = "";
  for (const s of t.cssRules) i += s.cssText;
  return Ft(i);
})(e) : e;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: Jt, defineProperty: Vt, getOwnPropertyDescriptor: qt, getOwnPropertyNames: Xt, getOwnPropertySymbols: Yt, getPrototypeOf: Zt } = Object, rt = globalThis, yt = rt.trustedTypes, Qt = yt ? yt.emptyScript : "", te = rt.reactiveElementPolyfillSupport, K = (e, t) => e, et = { toAttribute(e, t) {
  switch (t) {
    case Boolean:
      e = e ? Qt : null;
      break;
    case Object:
    case Array:
      e = e == null ? e : JSON.stringify(e);
  }
  return e;
}, fromAttribute(e, t) {
  let i = e;
  switch (t) {
    case Boolean:
      i = e !== null;
      break;
    case Number:
      i = e === null ? null : Number(e);
      break;
    case Object:
    case Array:
      try {
        i = JSON.parse(e);
      } catch {
        i = null;
      }
  }
  return i;
} }, ut = (e, t) => !Jt(e, t), xt = { attribute: !0, type: String, converter: et, reflect: !1, useDefault: !1, hasChanged: ut };
Symbol.metadata ??= Symbol("metadata"), rt.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let R = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, i = xt) {
    if (i.state && (i.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((i = Object.create(i)).wrapped = !0), this.elementProperties.set(t, i), !i.noAccessor) {
      const s = Symbol(), r = this.getPropertyDescriptor(t, s, i);
      r !== void 0 && Vt(this.prototype, t, r);
    }
  }
  static getPropertyDescriptor(t, i, s) {
    const { get: r, set: o } = qt(this.prototype, t) ?? { get() {
      return this[i];
    }, set(n) {
      this[i] = n;
    } };
    return { get: r, set(n) {
      const a = r?.call(this);
      o?.call(this, n), this.requestUpdate(t, a, s);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? xt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(K("elementProperties"))) return;
    const t = Zt(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(K("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(K("properties"))) {
      const i = this.properties, s = [...Xt(i), ...Yt(i)];
      for (const r of s) this.createProperty(r, i[r]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const i = litPropertyMetadata.get(t);
      if (i !== void 0) for (const [s, r] of i) this.elementProperties.set(s, r);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [i, s] of this.elementProperties) {
      const r = this._$Eu(i, s);
      r !== void 0 && this._$Eh.set(r, i);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const i = [];
    if (Array.isArray(t)) {
      const s = new Set(t.flat(1 / 0).reverse());
      for (const r of s) i.unshift($t(r));
    } else t !== void 0 && i.push($t(t));
    return i;
  }
  static _$Eu(t, i) {
    const s = i.attribute;
    return s === !1 ? void 0 : typeof s == "string" ? s : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t) => this.enableUpdating = t), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t) => t(this));
  }
  addController(t) {
    (this._$EO ??= /* @__PURE__ */ new Set()).add(t), this.renderRoot !== void 0 && this.isConnected && t.hostConnected?.();
  }
  removeController(t) {
    this._$EO?.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), i = this.constructor.elementProperties;
    for (const s of i.keys()) this.hasOwnProperty(s) && (t.set(s, this[s]), delete this[s]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return Wt(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((t) => t.hostConnected?.());
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t) => t.hostDisconnected?.());
  }
  attributeChangedCallback(t, i, s) {
    this._$AK(t, s);
  }
  _$ET(t, i) {
    const s = this.constructor.elementProperties.get(t), r = this.constructor._$Eu(t, s);
    if (r !== void 0 && s.reflect === !0) {
      const o = (s.converter?.toAttribute !== void 0 ? s.converter : et).toAttribute(i, s.type);
      this._$Em = t, o == null ? this.removeAttribute(r) : this.setAttribute(r, o), this._$Em = null;
    }
  }
  _$AK(t, i) {
    const s = this.constructor, r = s._$Eh.get(t);
    if (r !== void 0 && this._$Em !== r) {
      const o = s.getPropertyOptions(r), n = typeof o.converter == "function" ? { fromAttribute: o.converter } : o.converter?.fromAttribute !== void 0 ? o.converter : et;
      this._$Em = r;
      const a = n.fromAttribute(i, o.type);
      this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
    }
  }
  requestUpdate(t, i, s, r = !1, o) {
    if (t !== void 0) {
      const n = this.constructor;
      if (r === !1 && (o = this[t]), s ??= n.getPropertyOptions(t), !((s.hasChanged ?? ut)(o, i) || s.useDefault && s.reflect && o === this._$Ej?.get(t) && !this.hasAttribute(n._$Eu(t, s)))) return;
      this.C(t, i, s);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, i, { useDefault: s, reflect: r, wrapped: o }, n) {
    s && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, n ?? i ?? this[t]), o !== !0 || n !== void 0) || (this._$AL.has(t) || (this.hasUpdated || s || (i = void 0), this._$AL.set(t, i)), r === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (i) {
      Promise.reject(i);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
        for (const [r, o] of this._$Ep) this[r] = o;
        this._$Ep = void 0;
      }
      const s = this.constructor.elementProperties;
      if (s.size > 0) for (const [r, o] of s) {
        const { wrapped: n } = o, a = this[r];
        n !== !0 || this._$AL.has(r) || a === void 0 || this.C(r, void 0, o, a);
      }
    }
    let t = !1;
    const i = this._$AL;
    try {
      t = this.shouldUpdate(i), t ? (this.willUpdate(i), this._$EO?.forEach((s) => s.hostUpdate?.()), this.update(i)) : this._$EM();
    } catch (s) {
      throw t = !1, this._$EM(), s;
    }
    t && this._$AE(i);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    this._$EO?.forEach((i) => i.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    this._$Eq &&= this._$Eq.forEach((i) => this._$ET(i, this[i])), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
R.elementStyles = [], R.shadowRootOptions = { mode: "open" }, R[K("elementProperties")] = /* @__PURE__ */ new Map(), R[K("finalized")] = /* @__PURE__ */ new Map(), te?.({ ReactiveElement: R }), (rt.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const pt = globalThis, wt = (e) => e, it = pt.trustedTypes, _t = it ? it.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, Gt = "$lit$", E = `lit$${Math.random().toFixed(9).slice(2)}$`, Dt = "?" + E, ee = `<${Dt}>`, I = document, F = () => I.createComment(""), W = (e) => e === null || typeof e != "object" && typeof e != "function", ft = Array.isArray, ie = (e) => ft(e) || typeof e?.[Symbol.iterator] == "function", lt = `[ 	
\f\r]`, B = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, kt = /-->/g, St = />/g, C = RegExp(`>|${lt}(?:([^\\s"'>=/]+)(${lt}*=${lt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), At = /'/g, Pt = /"/g, zt = /^(?:script|style|textarea|title)$/i, Bt = (e) => (t, ...i) => ({ _$litType$: e, strings: t, values: i }), h = Bt(1), b = Bt(2), H = Symbol.for("lit-noChange"), d = Symbol.for("lit-nothing"), Mt = /* @__PURE__ */ new WeakMap(), N = I.createTreeWalker(I, 129);
function jt(e, t) {
  if (!ft(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return _t !== void 0 ? _t.createHTML(t) : t;
}
const se = (e, t) => {
  const i = e.length - 1, s = [];
  let r, o = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", n = B;
  for (let a = 0; a < i; a++) {
    const l = e[a];
    let c, f, u = -1, w = 0;
    for (; w < l.length && (n.lastIndex = w, f = n.exec(l), f !== null); ) w = n.lastIndex, n === B ? f[1] === "!--" ? n = kt : f[1] !== void 0 ? n = St : f[2] !== void 0 ? (zt.test(f[2]) && (r = RegExp("</" + f[2], "g")), n = C) : f[3] !== void 0 && (n = C) : n === C ? f[0] === ">" ? (n = r ?? B, u = -1) : f[1] === void 0 ? u = -2 : (u = n.lastIndex - f[2].length, c = f[1], n = f[3] === void 0 ? C : f[3] === '"' ? Pt : At) : n === Pt || n === At ? n = C : n === kt || n === St ? n = B : (n = C, r = void 0);
    const A = n === C && e[a + 1].startsWith("/>") ? " " : "";
    o += n === B ? l + ee : u >= 0 ? (s.push(c), l.slice(0, u) + Gt + l.slice(u) + E + A) : l + E + (u === -2 ? a : A);
  }
  return [jt(e, o + (e[i] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), s];
};
class J {
  constructor({ strings: t, _$litType$: i }, s) {
    let r;
    this.parts = [];
    let o = 0, n = 0;
    const a = t.length - 1, l = this.parts, [c, f] = se(t, i);
    if (this.el = J.createElement(c, s), N.currentNode = this.el.content, i === 2 || i === 3) {
      const u = this.el.content.firstChild;
      u.replaceWith(...u.childNodes);
    }
    for (; (r = N.nextNode()) !== null && l.length < a; ) {
      if (r.nodeType === 1) {
        if (r.hasAttributes()) for (const u of r.getAttributeNames()) if (u.endsWith(Gt)) {
          const w = f[n++], A = r.getAttribute(u).split(E), M = /([.?@])?(.*)/.exec(w);
          l.push({ type: 1, index: o, name: M[2], strings: A, ctor: M[1] === "." ? oe : M[1] === "?" ? ne : M[1] === "@" ? ae : ot }), r.removeAttribute(u);
        } else u.startsWith(E) && (l.push({ type: 6, index: o }), r.removeAttribute(u));
        if (zt.test(r.tagName)) {
          const u = r.textContent.split(E), w = u.length - 1;
          if (w > 0) {
            r.textContent = it ? it.emptyScript : "";
            for (let A = 0; A < w; A++) r.append(u[A], F()), N.nextNode(), l.push({ type: 2, index: ++o });
            r.append(u[w], F());
          }
        }
      } else if (r.nodeType === 8) if (r.data === Dt) l.push({ type: 2, index: o });
      else {
        let u = -1;
        for (; (u = r.data.indexOf(E, u + 1)) !== -1; ) l.push({ type: 7, index: o }), u += E.length - 1;
      }
      o++;
    }
  }
  static createElement(t, i) {
    const s = I.createElement("template");
    return s.innerHTML = t, s;
  }
}
function G(e, t, i = e, s) {
  if (t === H) return t;
  let r = s !== void 0 ? i._$Co?.[s] : i._$Cl;
  const o = W(t) ? void 0 : t._$litDirective$;
  return r?.constructor !== o && (r?._$AO?.(!1), o === void 0 ? r = void 0 : (r = new o(e), r._$AT(e, i, s)), s !== void 0 ? (i._$Co ??= [])[s] = r : i._$Cl = r), r !== void 0 && (t = G(e, r._$AS(e, t.values), r, s)), t;
}
class re {
  constructor(t, i) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = i;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: i }, parts: s } = this._$AD, r = (t?.creationScope ?? I).importNode(i, !0);
    N.currentNode = r;
    let o = N.nextNode(), n = 0, a = 0, l = s[0];
    for (; l !== void 0; ) {
      if (n === l.index) {
        let c;
        l.type === 2 ? c = new V(o, o.nextSibling, this, t) : l.type === 1 ? c = new l.ctor(o, l.name, l.strings, this, t) : l.type === 6 && (c = new le(o, this, t)), this._$AV.push(c), l = s[++a];
      }
      n !== l?.index && (o = N.nextNode(), n++);
    }
    return N.currentNode = I, r;
  }
  p(t) {
    let i = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(t, s, i), i += s.strings.length - 2) : s._$AI(t[i])), i++;
  }
}
class V {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, i, s, r) {
    this.type = 2, this._$AH = d, this._$AN = void 0, this._$AA = t, this._$AB = i, this._$AM = s, this.options = r, this._$Cv = r?.isConnected ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const i = this._$AM;
    return i !== void 0 && t?.nodeType === 11 && (t = i.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, i = this) {
    t = G(this, t, i), W(t) ? t === d || t == null || t === "" ? (this._$AH !== d && this._$AR(), this._$AH = d) : t !== this._$AH && t !== H && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : ie(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== d && W(this._$AH) ? this._$AA.nextSibling.data = t : this.T(I.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: i, _$litType$: s } = t, r = typeof s == "number" ? this._$AC(t) : (s.el === void 0 && (s.el = J.createElement(jt(s.h, s.h[0]), this.options)), s);
    if (this._$AH?._$AD === r) this._$AH.p(i);
    else {
      const o = new re(r, this), n = o.u(this.options);
      o.p(i), this.T(n), this._$AH = o;
    }
  }
  _$AC(t) {
    let i = Mt.get(t.strings);
    return i === void 0 && Mt.set(t.strings, i = new J(t)), i;
  }
  k(t) {
    ft(this._$AH) || (this._$AH = [], this._$AR());
    const i = this._$AH;
    let s, r = 0;
    for (const o of t) r === i.length ? i.push(s = new V(this.O(F()), this.O(F()), this, this.options)) : s = i[r], s._$AI(o), r++;
    r < i.length && (this._$AR(s && s._$AB.nextSibling, r), i.length = r);
  }
  _$AR(t = this._$AA.nextSibling, i) {
    for (this._$AP?.(!1, !0, i); t !== this._$AB; ) {
      const s = wt(t).nextSibling;
      wt(t).remove(), t = s;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class ot {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, i, s, r, o) {
    this.type = 1, this._$AH = d, this._$AN = void 0, this.element = t, this.name = i, this._$AM = r, this.options = o, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = d;
  }
  _$AI(t, i = this, s, r) {
    const o = this.strings;
    let n = !1;
    if (o === void 0) t = G(this, t, i, 0), n = !W(t) || t !== this._$AH && t !== H, n && (this._$AH = t);
    else {
      const a = t;
      let l, c;
      for (t = o[0], l = 0; l < o.length - 1; l++) c = G(this, a[s + l], i, l), c === H && (c = this._$AH[l]), n ||= !W(c) || c !== this._$AH[l], c === d ? t = d : t !== d && (t += (c ?? "") + o[l + 1]), this._$AH[l] = c;
    }
    n && !r && this.j(t);
  }
  j(t) {
    t === d ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class oe extends ot {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === d ? void 0 : t;
  }
}
class ne extends ot {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== d);
  }
}
class ae extends ot {
  constructor(t, i, s, r, o) {
    super(t, i, s, r, o), this.type = 5;
  }
  _$AI(t, i = this) {
    if ((t = G(this, t, i, 0) ?? d) === H) return;
    const s = this._$AH, r = t === d && s !== d || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, o = t !== d && (s === d || r);
    r && this.element.removeEventListener(this.name, this, s), o && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class le {
  constructor(t, i, s) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = i, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    G(this, t);
  }
}
const he = pt.litHtmlPolyfillSupport;
he?.(J, V), (pt.litHtmlVersions ??= []).push("3.3.3");
const ce = (e, t, i) => {
  const s = i?.renderBefore ?? t;
  let r = s._$litPart$;
  if (r === void 0) {
    const o = i?.renderBefore ?? null;
    s._$litPart$ = r = new V(t.insertBefore(F(), o), o, void 0, i ?? {});
  }
  return r._$AI(e), r;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const mt = globalThis;
class O extends R {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const i = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = ce(i, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return H;
  }
}
O._$litElement$ = !0, O.finalized = !0, mt.litElementHydrateSupport?.({ LitElement: O });
const de = mt.litElementPolyfillSupport;
de?.({ LitElement: O });
(mt.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const gt = (e) => (t, i) => {
  i !== void 0 ? i.addInitializer(() => {
    customElements.define(e, t);
  }) : customElements.define(e, t);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ue = { attribute: !0, type: String, converter: et, reflect: !1, hasChanged: ut }, pe = (e = ue, t, i) => {
  const { kind: s, metadata: r } = i;
  let o = globalThis.litPropertyMetadata.get(r);
  if (o === void 0 && globalThis.litPropertyMetadata.set(r, o = /* @__PURE__ */ new Map()), s === "setter" && ((e = Object.create(e)).wrapped = !0), o.set(i.name, e), s === "accessor") {
    const { name: n } = i;
    return { set(a) {
      const l = t.get.call(this);
      t.set.call(this, a), this.requestUpdate(n, l, e, !0, a);
    }, init(a) {
      return a !== void 0 && this.C(n, void 0, e, a), a;
    } };
  }
  if (s === "setter") {
    const { name: n } = i;
    return function(a) {
      const l = this[n];
      t.call(this, a), this.requestUpdate(n, l, e, !0, a);
    };
  }
  throw Error("Unsupported decorator location: " + s);
};
function y(e) {
  return (t, i) => typeof i == "object" ? pe(e, t, i) : ((s, r, o) => {
    const n = r.hasOwnProperty(o);
    return r.constructor.createProperty(o, s), n ? Object.getOwnPropertyDescriptor(r, o) : void 0;
  })(e, t, i);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function m(e) {
  return y({ ...e, state: !0, attribute: !1 });
}
const k = 1440;
function _(e, t) {
  return t.left + e / k * t.width;
}
function Y(e, t) {
  const i = (e - t.left) / t.width;
  return vt(Math.round(i * k), 0, k - 1);
}
function Tt(e, t) {
  return t.top + (1 - e / 100) * t.height;
}
function fe(e, t) {
  const i = 1 - (e - t.top) / t.height;
  return vt(Math.round(i * 100), 1, 100);
}
function vt(e, t, i) {
  return Math.min(i, Math.max(t, e));
}
function me(e, t = 5) {
  return vt(Math.round(e / t) * t, 0, k - 1);
}
function ge(e, t, i = 12) {
  let s = null, r = 1 / 0;
  for (const o of t) {
    const n = Math.abs(o.minute - e);
    n < r && (r = n, s = o);
  }
  return s && r <= i ? { minute: s.minute, event: s.event } : { minute: me(e), event: null };
}
function ve(e, t, i, s = 22) {
  let r = null, o = s;
  for (const n of i) {
    const a = Math.hypot(n.x - e, n.y - t);
    a <= o && (o = a, r = n.id);
  }
  return r;
}
function P(e) {
  const t = (e % k + k) % k, i = Math.floor(t / 60), s = t % 60;
  return `${String(i).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function Et(e) {
  const t = /^(\d{1,2}):(\d{2})$/.exec(e.trim());
  if (!t) return null;
  const i = Number(t[1]), s = Number(t[2]);
  return i > 23 || s > 59 ? null : i * 60 + s;
}
var be = Object.defineProperty, $e = Object.getOwnPropertyDescriptor, S = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? $e(t, i) : t, o = e.length - 1, n; o >= 0; o--)
    (n = e[o]) && (r = (s ? n(t, i, r) : n(r)) || r);
  return s && r && be(t, i, r), r;
};
const Ct = 150, Nt = 74, ye = 26, j = 46, xe = 14, Ot = 22, L = 34, we = 20;
let $ = class extends O {
  constructor() {
    super(...arguments), this.samples = [], this.keyframes = [], this.sun = {}, this.nowMinute = 0, this.selectedId = null, this.scrubMinute = null, this.width = 900, this.painting = !1, this.scrubbing = !1, this.draggingMarker = null;
  }
  get plotWidth() {
    return Math.max(120, this.width - j - xe);
  }
  get brightnessPlot() {
    return { left: j, top: Ot, width: this.plotWidth, height: Ct };
  }
  get ribbonPlot() {
    return {
      left: j,
      top: Ot + Ct + ye,
      width: this.plotWidth,
      height: Nt
    };
  }
  get scrubTop() {
    return this.ribbonPlot.top + Nt + we + 10;
  }
  get totalHeight() {
    return this.scrubTop + L + 8;
  }
  render() {
    return h`
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
  renderBrightness() {
    const e = this.brightnessPlot, t = this.samples.filter((i) => i.brightness_pct !== null).map(
      (i) => `${_(i.minute, e).toFixed(1)},${Tt(
        i.brightness_pct,
        e
      ).toFixed(1)}`
    );
    return b`
      <g>
        <text class="lane-title" x=${e.left} y=${e.top - 7}>Brightness</text>
        <rect class="lane-bg" x=${e.left} y=${e.top}
              width=${e.width} height=${e.height} rx="6" />
        ${this.renderGrid(e, !1)}
        ${[100, 50, 1].map(
      (i) => b`<text class="axis-label" x=${e.left - 6}
                             y=${Tt(i, e) + 3}
                             text-anchor="end">${i}%</text>`
    )}
        ${t.length > 1 ? b`<polyline class="curve" points=${t.join(" ")} />` : ""}
        ${this.keyframes.map((i) => {
      const s = _(i.minute, e);
      return b`<line class="kf-tick" x1=${s} y1=${e.top + e.height - 8}
                           x2=${s} y2=${e.top + e.height} />`;
    })}
        ${this.renderSun(e)} ${this.renderNow(e)} ${this.renderScrub(e)}
      </g>
    `;
  }
  // --- colour ribbon --------------------------------------------------------
  renderRibbon() {
    const e = this.ribbonPlot;
    return b`
      <g>
        <text class="lane-title" x=${e.left} y=${e.top - 7}>
          Colour — tap to set
        </text>
        ${this.samples.map((t, i) => {
      const s = this.samples[i + 1], r = _(t.minute, e), o = s ? _(s.minute, e) : e.left + e.width, n = t.rgb ?? [80, 80, 80];
      return b`<rect class="ribbon" x=${r} y=${e.top}
                           width=${Math.max(1, o - r + 0.5)} height=${e.height}
                           fill="rgb(${n[0]},${n[1]},${n[2]})" />`;
    })}
        <rect class="ribbon-frame" x=${e.left} y=${e.top}
              width=${e.width} height=${e.height} rx="6" />
        ${this.renderSun(e)} ${this.renderNow(e)} ${this.renderScrub(e)}
        ${this.markers().map((t) => {
      const i = this.keyframes.find((r) => r.id === t.id), s = i.mode === "hs" ? `hsl(${i.hs?.[0] ?? 0}, ${i.hs?.[1] ?? 100}%, 50%)` : "#ffffff";
      return b`
            <g>
              <circle class="marker-hit" cx=${t.x} cy=${t.y} r="22"
                      data-id=${t.id} />
              <circle class="marker ${this.selectedId === t.id ? "selected" : ""}"
                      cx=${t.x} cy=${t.y} r="9" fill=${s}>
                <title>${P(i.minute)} — tap to set the colour</title>
              </circle>
            </g>`;
    })}
        ${this.renderHourLabels(e)}
      </g>
    `;
  }
  /** One marker per keyframe, sitting on the ribbon. */
  markers() {
    const e = this.ribbonPlot;
    return this.keyframes.map((t) => ({
      id: t.id,
      x: _(t.minute, e),
      y: e.top + e.height / 2
    }));
  }
  // --- shared furniture -----------------------------------------------------
  renderGrid(e, t) {
    const i = [];
    for (let s = 0; s <= 24; s += 3) {
      const r = _(s * 60, e);
      i.push(b`<line class="grid" x1=${r} y1=${e.top} x2=${r}
                         y2=${e.top + e.height} />`), t && i.push(b`<text class="axis-label" x=${r} y=${e.top + e.height + 16}
                           text-anchor="middle">${String(s).padStart(2, "0")}</text>`);
    }
    return b`${i}`;
  }
  renderHourLabels(e) {
    const t = [];
    for (let i = 0; i <= 24; i += 3) {
      const s = _(i * 60, e);
      t.push(b`<text class="axis-label" x=${s} y=${e.top + e.height + 16}
                         text-anchor="middle">${String(i).padStart(2, "0")}</text>`);
    }
    return b`${t}`;
  }
  renderSun(e) {
    return b`${Object.entries(this.sun).map(([t, i]) => {
      if (!i) return b``;
      const s = _(i.minute, e);
      return b`<line class="sun" x1=${s} y1=${e.top} x2=${s}
                       y2=${e.top + e.height}>
                   <title>${t} ${P(i.minute)}</title>
                 </line>`;
    })}`;
  }
  renderNow(e) {
    const t = _(this.nowMinute, e);
    return b`<line class="now" x1=${t} y1=${e.top} x2=${t}
                     y2=${e.top + e.height} />`;
  }
  renderScrub(e) {
    if (this.scrubMinute === null) return b``;
    const t = _(this.scrubMinute, e);
    return b`<line class="scrub" x1=${t} y1=${e.top} x2=${t}
                     y2=${e.top + e.height} />`;
  }
  renderScrubBar() {
    const e = {
      left: j,
      top: this.scrubTop,
      width: this.plotWidth,
      height: L
    }, t = this.scrubMinute === null ? null : _(this.scrubMinute, e);
    return b`
      <g>
        <rect class="scrub-bar" x=${e.left} y=${e.top}
              width=${e.width} height=${e.height} rx=${L / 2} />
        <text class="axis-label" x=${e.left - 6} y=${e.top + L / 2 + 3}
              text-anchor="end">preview</text>
        ${t === null ? "" : b`<circle class="scrub-handle" cx=${t}
                        cy=${e.top + L / 2} r="9" />`}
      </g>
    `;
  }
  // --- interaction ----------------------------------------------------------
  localPoint(e) {
    const i = this.renderRoot.querySelector("svg").getBoundingClientRect(), s = this.width / i.width;
    return {
      x: (e.clientX - i.left) * s,
      y: (e.clientY - i.top) * s
    };
  }
  onPointerDown(e) {
    const t = this.localPoint(e);
    e.target.setPointerCapture?.(e.pointerId);
    const i = this.brightnessPlot, s = this.ribbonPlot;
    if (t.y >= this.scrubTop) {
      this.scrubbing = !0, this.emitScrub(t.x);
      return;
    }
    if (t.y >= s.top - 12 && t.y <= s.top + s.height + 12) {
      const r = ve(t.x, t.y, this.markers());
      if (r) {
        this.draggingMarker = r, this.selectedId = r, this.emit("colour-pick", { id: r, minute: null });
        return;
      }
      this.emit("colour-pick", { id: null, minute: Y(t.x, s) });
      return;
    }
    t.y >= i.top - 10 && t.y <= i.top + i.height + 10 && (this.painting = !0, this.emitPaint(t));
  }
  onPointerMove(e) {
    const t = this.localPoint(e);
    if (this.scrubbing) {
      this.emitScrub(t.x);
      return;
    }
    if (this.draggingMarker) {
      const i = Object.entries(this.sun).filter(([, r]) => r).map(([r, o]) => ({ event: r, minute: o.minute })), s = ge(Y(t.x, this.ribbonPlot), i);
      this.emit("marker-move", {
        id: this.draggingMarker,
        minute: s.minute,
        sunEvent: s.event
      });
      return;
    }
    this.painting && this.emitPaint(t);
  }
  onPointerUp() {
    if (this.draggingMarker) {
      this.draggingMarker = null, this.emit("marker-commit", {});
      return;
    }
    if (this.painting) {
      this.painting = !1, this.emit("paint-commit", {});
      return;
    }
    this.scrubbing && (this.scrubbing = !1, this.emit("scrub-end", {}));
  }
  emitPaint(e) {
    const t = this.brightnessPlot;
    this.emit("curve-paint", {
      minute: Y(e.x, t),
      value: fe(e.y, t)
    });
  }
  emitScrub(e) {
    const t = {
      left: j,
      top: this.scrubTop,
      width: this.plotWidth
    };
    this.emit("scrub", { minute: Y(e, t) });
  }
  emit(e, t) {
    this.dispatchEvent(new CustomEvent(e, { detail: t, bubbles: !0, composed: !0 }));
  }
};
$.styles = dt`
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
S([
  y({ attribute: !1 })
], $.prototype, "samples", 2);
S([
  y({ attribute: !1 })
], $.prototype, "keyframes", 2);
S([
  y({ attribute: !1 })
], $.prototype, "sun", 2);
S([
  y({ type: Number })
], $.prototype, "nowMinute", 2);
S([
  y({ type: String })
], $.prototype, "selectedId", 2);
S([
  y({ type: Number })
], $.prototype, "scrubMinute", 2);
S([
  y({ type: Number })
], $.prototype, "width", 2);
S([
  m()
], $.prototype, "painting", 2);
S([
  m()
], $.prototype, "scrubbing", 2);
S([
  m()
], $.prototype, "draggingMarker", 2);
$ = S([
  gt("lightcurve-curve-graph")
], $);
function _e(e, t, i, s) {
  const r = e - i, o = t - i, a = (Math.atan2(r, -o) * (180 / Math.PI) + 360) % 360, l = Math.hypot(r, o), c = Math.min(100, Math.round(l / s * 100));
  return { hue: Math.round(a), saturation: c };
}
function ke(e, t, i, s) {
  const r = e % 360 * Math.PI / 180, o = Math.min(100, Math.max(0, t)) / 100 * s;
  return {
    x: i + Math.sin(r) * o,
    y: i - Math.cos(r) * o
  };
}
function Lt(e, t) {
  return `hsl(${Math.round(e)}, ${Math.round(t)}%, 50%)`;
}
function Kt(e) {
  const t = Math.min(Math.max(e, 1e3), 4e4) / 100;
  let i, s, r;
  t <= 66 ? (i = 255, s = 99.4708025861 * Math.log(t) - 161.1195681661) : (i = 329.698727446 * (t - 60) ** -0.1332047592, s = 288.1221695283 * (t - 60) ** -0.0755148492), t >= 66 ? r = 255 : t <= 19 ? r = 0 : r = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const o = (n) => Math.round(Math.min(255, Math.max(0, n)));
  return `rgb(${o(i)}, ${o(s)}, ${o(r)})`;
}
var Se = Object.defineProperty, Ae = Object.getOwnPropertyDescriptor, nt = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? Ae(t, i) : t, o = e.length - 1, n; o >= 0; o--)
    (n = e[o]) && (r = (s ? n(t, i, r) : n(r)) || r);
  return s && r && Se(t, i, r), r;
};
const U = 220, It = U / 2 - 10;
let D = class extends O {
  constructor() {
    super(...arguments), this.hue = 0, this.saturation = 100, this.brightness = 50, this.dragging = !1, this.onDown = (e) => {
      this.dragging = !0, e.target.setPointerCapture?.(e.pointerId), this.pick(e);
    }, this.onMove = (e) => {
      this.dragging && this.pick(e);
    }, this.onUp = () => {
      this.dragging = !1;
    };
  }
  render() {
    const e = ke(this.hue, this.saturation, U / 2, It), t = 12 + this.brightness / 100 * 43;
    return h`
      <div
        class="wheel"
        @pointerdown=${this.onDown}
        @pointermove=${this.onMove}
        @pointerup=${this.onUp}
        @pointercancel=${this.onUp}
      >
        <div
          class="handle"
          style="left:${e.x}px; top:${e.y}px;
                 background: hsl(${this.hue}, ${this.saturation}%, 50%)"
        ></div>
      </div>
      <div class="side">
        <div
          class="preview"
          style="background: hsl(${this.hue}, ${this.saturation}%, ${t}%)"
        ></div>
        <div>
          <label for="brightness">Brightness — ${this.brightness}%</label>
          <input
            id="brightness"
            type="range"
            min="1"
            max="100"
            .value=${String(this.brightness)}
            @input=${(i) => this.emit({ brightness: Number(i.target.value) })}
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
            @input=${(i) => this.emit({ saturation: Number(i.target.value) })}
          />
        </div>
        <div class="readout">hue ${Math.round(this.hue)}°</div>
      </div>
    `;
  }
  pick(e) {
    const i = this.renderRoot.querySelector(".wheel").getBoundingClientRect(), s = U / i.width, { hue: r, saturation: o } = _e(
      (e.clientX - i.left) * s,
      (e.clientY - i.top) * s,
      U / 2,
      It
    );
    this.emit({ hue: r, saturation: o });
  }
  emit(e) {
    this.dispatchEvent(
      new CustomEvent("colour-change", {
        detail: {
          hue: e.hue ?? this.hue,
          saturation: e.saturation ?? this.saturation,
          brightness: e.brightness ?? this.brightness
        },
        bubbles: !0,
        composed: !0
      })
    );
  }
};
D.styles = dt`
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      align-items: center;
    }
    .wheel {
      position: relative;
      width: ${U}px;
      height: ${U}px;
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
nt([
  y({ type: Number })
], D.prototype, "hue", 2);
nt([
  y({ type: Number })
], D.prototype, "saturation", 2);
nt([
  y({ type: Number })
], D.prototype, "brightness", 2);
D = nt([
  gt("lightcurve-colour-wheel")
], D);
function st(e, t) {
  if (e.length <= 2) return [...e];
  let i = 0, s = 0;
  const r = e[0], o = e[e.length - 1];
  for (let l = 1; l < e.length - 1; l++) {
    const c = Pe(e[l], r, o);
    c > s && (s = c, i = l);
  }
  if (s <= t)
    return [r, o];
  const n = st(e.slice(0, i + 1), t), a = st(e.slice(i), t);
  return [...n.slice(0, -1), ...a];
}
function Pe(e, t, i) {
  const s = i.minute - t.minute;
  if (s === 0) return Math.abs(e.value - t.value);
  const r = (i.value - t.value) / s, o = t.value + (e.minute - t.minute) * r;
  return Math.abs(e.value - o);
}
function Me(e, t, i = 1.5) {
  let s = i, r = st(e, s);
  for (let o = 0; o < 24 && r.length > t; o++)
    s *= 1.6, r = st(e, s);
  return { points: r, tolerance: s };
}
function at(e, t) {
  const i = Math.abs(e - t);
  return Math.min(i, k - i);
}
const Te = 48, Ee = 5;
function Ce(e, t) {
  if (e.kind === "radial")
    return at(t, e.centre) <= e.radius;
  const { from: i, to: s } = e;
  return i <= s ? t >= i && t <= s : t >= i || t <= s;
}
function Ne(e, t) {
  let i = null, s = 1 / 0;
  for (const r of e) {
    const o = at(r.minute, t);
    o < s && (s = o, i = r);
  }
  return i ? i.value : null;
}
function Rt(e, t, i, s) {
  if (t === "brightness")
    e.brightness = Math.round(Math.min(100, Math.max(1, i)));
  else if (t === "warmth")
    e.colour = { mode: "kelvin", kelvin: Math.round(i) };
  else {
    const r = s ?? e.colour.hs?.[1] ?? 100;
    e.colour = { mode: "hs", hs: [Math.round(i) % 360, Math.round(r)] };
  }
}
function Oe(e) {
  const t = (e % 1440 + 1440) % 1440, i = String(Math.floor(t / 60)).padStart(2, "0"), s = String(t % 60).padStart(2, "0");
  return `${i}:${s}`;
}
function Ie(e, t, i, s, r, o = Te, n) {
  const a = new Map(t.map((v) => [v.id, v.minute])), l = (v) => Ce(r, v), c = e.map((v) => {
    const q = a.get(v.id);
    if (q === void 0 || !l(q)) return v;
    const T = Ne(s, q);
    if (T === null) return v;
    const z = JSON.parse(JSON.stringify(v));
    return Rt(z, i, T, n), z;
  }), f = s.filter((v) => l(v.minute));
  if (f.length < 3) return c;
  const u = i === "brightness" ? 2.5 : i === "warmth" ? 90 : 8, { points: w } = Me(f, o, u), A = c.map((v) => a.get(v.id)).filter((v) => v !== void 0), M = [];
  for (const v of w) {
    if (c.length + M.length >= o) break;
    if ([...A, ...M.map((X) => Re(X))].some(
      (X) => X !== null && at(X, v.minute) < Ee
    )) continue;
    const T = Ue(c, a, v.minute), z = {
      id: `k_${Math.random().toString(36).slice(2, 8)}`,
      time: { type: "fixed", value: Oe(v.minute) },
      colour: T ? JSON.parse(JSON.stringify(T.colour)) : { mode: "kelvin", kelvin: 3e3 },
      brightness: T ? T.brightness : 50,
      easing: T ? T.easing : "ease_in_out"
    };
    Rt(z, i, v.value, n), M.push(z);
  }
  return [...c, ...M];
}
function Re(e) {
  if (e.time.type !== "fixed" || !e.time.value) return null;
  const [t, i] = e.time.value.split(":").map(Number);
  return t * 60 + i;
}
function Ue(e, t, i) {
  let s = null, r = 1 / 0;
  for (const o of e) {
    const n = t.get(o.id);
    if (n === void 0) continue;
    const a = at(n, i);
    a < r && (r = a, s = o);
  }
  return s;
}
function He() {
  return { values: /* @__PURE__ */ new Map(), first: -1, last: -1 };
}
function Ge(e, t, i, s = 5) {
  const r = new Map(e.values);
  if (e.last >= 0 && e.last !== t) {
    const o = e.last, n = r.get(o) ?? i, a = t - o, l = Math.max(1, Math.round(Math.abs(a) / s));
    for (let c = 1; c <= l; c++) {
      const f = c / l, u = Q(o + a * f, s);
      r.set(tt(u), n + (i - n) * f);
    }
  }
  return r.set(tt(Q(t, s)), i), {
    values: r,
    first: e.first < 0 ? tt(Q(t, s)) : e.first,
    last: t
  };
}
function De(e, t) {
  return t.values.size === 0 ? e : e.map((i) => {
    const s = t.values.get(i.minute);
    return s === void 0 ? i : { minute: i.minute, value: s };
  });
}
function ze(e) {
  if (e.values.size === 0) return null;
  const t = [...e.values.keys()].sort((r, o) => r - o), i = e.first >= 0 ? e.first : t[0], s = tt(Q(e.last, 5));
  return i <= s ? { from: i, to: s } : { from: s, to: i };
}
function Q(e, t) {
  return Math.round(e / t) * t;
}
function tt(e) {
  return (e % k + k) % k;
}
var Be = Object.defineProperty, je = Object.getOwnPropertyDescriptor, g = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? je(t, i) : t, o = e.length - 1, n; o >= 0; o--)
    (n = e[o]) && (r = (s ? n(t, i, r) : n(r)) || r);
  return s && r && Be(t, i, r), r;
};
const Le = 300;
let p = class extends O {
  constructor() {
    super(...arguments), this.narrow = !1, this.profiles = [], this.groups = [], this.themes = [], this.editingTheme = null, this.themeTarget = [], this.colourPickFor = null, this.profile = null, this.variant = "default", this.samples = [], this.resolved = [], this.sun = {}, this.issues = [], this.selectedId = null, this.previewGroupId = null, this.scrubMinute = null, this.dirty = !1, this.busy = !1, this.error = null, this.graphWidth = 900, this.lastScrubAt = 0, this.stroke = null, this.onKeyframeMove = (e) => {
      const { id: t, minute: i, sunEvent: s, brightness: r, kelvin: o, hue: n } = e.detail;
      this.mutate(t, (a) => {
        if (s ? a.time = { type: "sun", event: s, offset_min: 0 } : a.time = { type: "fixed", value: P(i) }, r !== void 0 && (a.brightness = r), o !== void 0 && (a.colour = { mode: "kelvin", kelvin: o }), n !== void 0) {
          const l = a.colour.hs?.[1] ?? 100;
          a.colour = { mode: "hs", hs: [n, l] };
        }
      });
    }, this.onKeyframeCommit = () => {
      this.refreshGraph();
    }, this.onSelect = (e) => {
      this.selectedId = e.detail.id;
    }, this.onPaint = (e) => {
      const { minute: t, value: i } = e.detail, s = "brightness";
      this.stroke = Ge(this.stroke ?? He(), t, i);
      const r = this.samples.map((n) => ({
        minute: n.minute,
        value: Ut(n)
      })), o = De(r, this.stroke);
      this.samples = this.samples.map(
        (n, a) => Fe(n, s, o[a].value)
      ), this.dirty = !0;
    }, this.onPaintCommit = () => {
      const e = this.stroke;
      if (this.stroke = null, !this.profile || !e) return;
      const t = ze(e);
      if (!t) return;
      const i = "brightness", s = this.samples.map((o) => ({
        minute: o.minute,
        value: Ut(o)
      })), r = Ie(
        this.keyframes,
        this.resolved,
        i,
        s,
        { kind: "span", ...t }
      );
      this.profile = {
        ...this.profile,
        variants: { ...this.profile.variants, [this.variant]: { keyframes: r } }
      }, this.refreshGraph();
    }, this.onColourPick = (e) => {
      const { id: t, minute: i } = e.detail;
      if (t) {
        this.selectedId = t, this.colourPickFor = t;
        return;
      }
      if (i === null || !this.profile) return;
      const s = this.resolved.find((a) => Math.abs(a.minute - i) <= 10);
      if (s) {
        this.selectedId = s.id, this.colourPickFor = s.id;
        return;
      }
      const r = this.samples.reduce(
        (a, l) => Math.abs(l.minute - i) < Math.abs(a.minute - i) ? l : a,
        this.samples[0]
      ), o = `k_${Math.random().toString(36).slice(2, 8)}`, n = [
        ...this.keyframes,
        {
          id: o,
          time: { type: "fixed", value: P(i) },
          colour: r?.mode === "hs" && r.hs ? { mode: "hs", hs: r.hs } : { mode: "kelvin", kelvin: r?.kelvin ?? 2700 },
          brightness: r?.brightness_pct ?? 50,
          easing: "ease_in_out"
        }
      ];
      this.profile = {
        ...this.profile,
        variants: { ...this.profile.variants, [this.variant]: { keyframes: n } }
      }, this.selectedId = o, this.colourPickFor = o, this.dirty = !0, this.refreshGraph();
    }, this.onMarkerMove = (e) => {
      const { id: t, minute: i, sunEvent: s } = e.detail;
      this.mutate(t, (r) => {
        r.time = s ? { type: "sun", event: s, offset_min: 0 } : { type: "fixed", value: P(i) };
      });
    }, this.onMarkerCommit = () => {
      this.refreshGraph();
    }, this.onScrub = (e) => {
      this.scrubMinute = e.detail.minute;
      const t = Date.now();
      t - this.lastScrubAt < Le || (this.lastScrubAt = t, this.previewAt(e.detail.minute));
    }, this.onScrubEnd = () => {
      this.scrubMinute = null, this.stopPreview();
    };
  }
  connectedCallback() {
    super.connectedCallback(), this.resizeObserver = new ResizeObserver((e) => {
      const t = e[0]?.contentRect.width ?? 900;
      this.graphWidth = Math.max(320, Math.round(t - 32));
    }), this.resizeObserver.observe(this), this.load();
  }
  disconnectedCallback() {
    this.resizeObserver?.disconnect(), this.previewGroupId && this.stopPreview(), super.disconnectedCallback();
  }
  async send(e) {
    return this.hass.connection.sendMessagePromise(e);
  }
  async load() {
    this.busy = !0, this.error = null;
    try {
      const [e, t, i, s] = await Promise.all([
        this.send({ type: "lightcurve/profiles/list" }),
        this.send({ type: "lightcurve/groups/list" }),
        this.send({ type: "lightcurve/sun" }),
        this.send({ type: "lightcurve/themes/list" })
      ]);
      this.profiles = e.profiles, this.groups = t.groups, this.sun = i.events, this.themes = s.themes, this.previewGroupId ??= this.groups[0]?.id ?? null, this.profiles.length > 0 && await this.openProfile(this.profiles[0].id);
    } catch (e) {
      this.error = x(e);
    } finally {
      this.busy = !1;
    }
  }
  async openProfile(e) {
    const t = await this.send({
      type: "lightcurve/profiles/get",
      profile_id: e
    });
    this.profile = t.profile, this.variant = Object.keys(t.profile.variants)[0] ?? "default", this.dirty = !1, this.selectedId = null, await this.refreshGraph();
  }
  /** Redraw from the server so the curve shown is the engine's, not an approximation. */
  async refreshGraph() {
    if (this.profile)
      try {
        const [e, t] = await Promise.all([
          this.send({
            type: "lightcurve/evaluate",
            profile_id: this.profile.id,
            variant: this.variant,
            step_minutes: 5
          }),
          this.send({
            type: "lightcurve/profiles/validate",
            profile: this.profile
          })
        ]);
        this.samples = e.samples, this.resolved = e.keyframes, this.issues = t.issues;
      } catch (e) {
        this.error = x(e);
      }
  }
  get keyframes() {
    return this.profile?.variants[this.variant]?.keyframes ?? [];
  }
  get selected() {
    return this.keyframes.find((e) => e.id === this.selectedId);
  }
  get blocked() {
    return this.issues.some((e) => e.level === "error");
  }
  // --- editing --------------------------------------------------------------
  mutate(e, t) {
    if (!this.profile) return;
    const i = this.keyframes.map((s) => {
      if (s.id !== e) return s;
      const r = JSON.parse(JSON.stringify(s));
      return t(r), r;
    });
    this.profile = {
      ...this.profile,
      variants: { ...this.profile.variants, [this.variant]: { keyframes: i } }
    }, this.dirty = !0;
  }
  async previewAt(e) {
    if (!(!this.previewGroupId || !this.profile))
      try {
        await this.send({
          type: "lightcurve/preview/start",
          group_id: this.previewGroupId,
          minute: e,
          profile_id: this.profile.id,
          variant: this.variant
        });
      } catch (t) {
        this.error = x(t);
      }
  }
  async stopPreview() {
    if (this.previewGroupId)
      try {
        await this.send({ type: "lightcurve/preview/stop", group_id: this.previewGroupId });
      } catch {
      }
  }
  async refreshThemes() {
    try {
      const e = await this.send({ type: "lightcurve/themes/list" });
      this.themes = e.themes;
    } catch (e) {
      this.error = x(e);
    }
  }
  async applyTheme(e) {
    this.error = null;
    try {
      await this.send({
        type: "lightcurve/themes/apply",
        theme_id: e.id,
        ...this.themeTarget.length > 0 ? { group_ids: this.themeTarget } : {}
      });
    } catch (t) {
      this.error = x(t);
    }
    await Promise.all([this.refreshThemes(), this.reloadGroups()]);
  }
  async releaseThemes() {
    this.error = null;
    try {
      await this.send({ type: "lightcurve/themes/release" });
    } catch (e) {
      this.error = x(e);
    }
    await this.refreshThemes();
  }
  /** Create a profile, starting from the one on screen.
   *
   *  Copying beats starting blank: a new profile almost always wants to be "the
   *  everyday one, but dimmer", and rebuilding a day's curve from two keyframes is
   *  a chore nobody asked for.
   */
  async newProfile(e) {
    const t = prompt(
      e ? "Name for the copy" : "Name for the new profile"
    );
    if (!t) return;
    const i = `p_${t.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`.slice(0, 40), s = e && this.profile ? JSON.parse(JSON.stringify(this.profile.variants)) : {
      default: {
        keyframes: [
          {
            id: "k_morning",
            time: { type: "fixed", value: "07:00" },
            colour: { mode: "kelvin", kelvin: 2700 },
            brightness: 40,
            easing: "ease_in_out"
          },
          {
            id: "k_evening",
            time: { type: "fixed", value: "21:00" },
            colour: { mode: "kelvin", kelvin: 2200 },
            brightness: 10,
            easing: "ease_in_out"
          }
        ]
      }
    };
    try {
      await this.send({
        type: "lightcurve/profiles/save",
        profile: { id: i, name: t, variants: s }
      }), await this.reloadProfiles(), await this.openProfile(i);
    } catch (r) {
      this.error = x(r);
    }
  }
  async renameProfile() {
    if (!this.profile) return;
    const e = prompt("Rename profile", this.profile.name);
    e && (this.profile = { ...this.profile, name: e }, await this.save(), await this.reloadProfiles());
  }
  async deleteProfile() {
    if (this.profile)
      try {
        await this.send({
          type: "lightcurve/profiles/delete",
          profile_id: this.profile.id
        }), await this.reloadProfiles(), this.profiles.length > 0 && await this.openProfile(this.profiles[0].id);
      } catch (e) {
        this.error = x(e);
      }
  }
  async reloadProfiles() {
    const e = await this.send({
      type: "lightcurve/profiles/list"
    });
    this.profiles = e.profiles;
  }
  async reloadGroups() {
    const e = await this.send({
      type: "lightcurve/groups/list"
    });
    this.groups = e.groups;
  }
  /** Point one room at a different profile, so the bathroom need not follow the
   *  lounge. */
  async assignProfile(e, t) {
    this.error = null;
    try {
      await this.send({
        type: "lightcurve/groups/set_profile",
        group_id: e.id,
        profile_id: t
      }), await Promise.all([this.reloadGroups(), this.reloadProfiles()]);
    } catch (i) {
      this.error = x(i);
    }
  }
  editTheme(e) {
    this.editingTheme = e ? JSON.parse(JSON.stringify(e)) : {
      id: `t_${Math.random().toString(36).slice(2, 8)}`,
      name: "New theme",
      mode: "static",
      colour: { mode: "hs", hs: [30, 80] },
      brightness: 50,
      effect: null,
      groups: [],
      hold_minutes: null,
      covers: [],
      holding: !1,
      holding_in: []
    };
  }
  patchTheme(e) {
    this.editingTheme && (this.editingTheme = { ...this.editingTheme, ...e });
  }
  async saveTheme() {
    if (!this.editingTheme) return;
    const { covers: e, holding: t, ...i } = this.editingTheme;
    this.error = null;
    try {
      await this.send({ type: "lightcurve/themes/save", theme: i }), this.editingTheme = null, await this.refreshThemes();
    } catch (s) {
      this.error = x(s);
    }
  }
  async deleteTheme() {
    if (this.editingTheme)
      try {
        await this.send({
          type: "lightcurve/themes/delete",
          theme_id: this.editingTheme.id
        }), this.editingTheme = null, await this.refreshThemes();
      } catch (e) {
        this.error = x(e);
      }
  }
  async save() {
    if (!(!this.profile || this.blocked)) {
      this.busy = !0, this.error = null;
      try {
        await this.send({ type: "lightcurve/profiles/save", profile: this.profile }), this.dirty = !1, await this.refreshGraph();
      } catch (e) {
        this.error = x(e);
      } finally {
        this.busy = !1;
      }
    }
  }
  async revert() {
    this.profile && await this.openProfile(this.profile.id);
  }
  addKeyframe() {
    if (!this.profile) return;
    const e = this.scrubMinute ?? 720, t = `k_${Math.random().toString(36).slice(2, 8)}`, i = [
      ...this.keyframes,
      {
        id: t,
        time: { type: "fixed", value: P(e) },
        colour: { mode: "kelvin", kelvin: 3e3 },
        brightness: 50,
        easing: "ease_in_out"
      }
    ];
    this.profile = {
      ...this.profile,
      variants: { ...this.profile.variants, [this.variant]: { keyframes: i } }
    }, this.selectedId = t, this.dirty = !0, this.refreshGraph();
  }
  deleteSelected() {
    if (!this.profile || !this.selectedId) return;
    const e = this.keyframes.filter((t) => t.id !== this.selectedId);
    this.profile = {
      ...this.profile,
      variants: { ...this.profile.variants, [this.variant]: { keyframes: e } }
    }, this.selectedId = null, this.dirty = !0, this.refreshGraph();
  }
  // --- rendering ------------------------------------------------------------
  render() {
    const e = this.groups.find((t) => t.id === this.previewGroupId);
    return h`
      ${this.error ? h`<div class="error-banner">${this.error}</div>` : d}
      <div class="bar">
        <div>
          <label for="profile">Profile</label>
          <select id="profile" @change=${(t) => void this.openProfile(t.target.value)}>
            ${this.profiles.map(
      (t) => h`<option value=${t.id} ?selected=${t.id === this.profile?.id}>
                ${t.name}${t.used_by.length > 1 ? ` (${t.used_by.length} rooms)` : ""}
              </option>`
    )}
          </select>
        </div>
        <div>
          <label for="group">Preview on</label>
          <select id="group" @change=${(t) => {
      this.previewGroupId = t.target.value;
    }}>
            ${this.groups.map(
      (t) => h`<option value=${t.id} ?selected=${t.id === this.previewGroupId}>
                ${t.name}
              </option>`
    )}
          </select>
        </div>
        <button class="secondary small" @click=${() => void this.newProfile(!0)}>
          Duplicate
        </button>
        <button class="secondary small" @click=${() => void this.newProfile(!1)}>
          New profile
        </button>
        <button class="secondary small" @click=${() => void this.renameProfile()}>
          Rename
        </button>
        <button
          class="secondary small"
          ?disabled=${this.profiles.length <= 1}
          title=${this.profiles.length <= 1 ? "The last profile cannot be deleted" : "Delete this profile"}
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
          .nowMinute=${We()}
          @keyframe-move=${this.onKeyframeMove}
          @keyframe-commit=${this.onKeyframeCommit}
          @keyframe-select=${this.onSelect}
          @curve-paint=${this.onPaint}
          @paint-commit=${this.onPaintCommit}
          @colour-pick=${this.onColourPick}
          @marker-move=${this.onMarkerMove}
          @marker-commit=${this.onMarkerCommit}
          @scrub=${this.onScrub}
          @scrub-end=${this.onScrubEnd}
        ></lightcurve-curve-graph>
        <p class="hint">
          <strong>Brightness:</strong> drag across it to draw — every moment your
          cursor passes takes its height.
          <strong>Colour:</strong> tap the ribbon at any time of day to set the
          colour there, white or coloured; drag a marker to move it in time, or onto
          a sun line to make it follow sunrise or sunset.
          The strip at the bottom previews a time of day on
          ${e ? e.name : "the selected room"}.
        </p>
      </div>

      ${this.renderRooms()}

      ${this.renderKeyframeTable()}

      ${this.renderThemes()}

      ${this.issues.length > 0 ? h`<div class="card">
            <ul class="issues">
              ${this.issues.map(
      (t) => h`<li class=${t.level}>${t.message}</li>`
    )}
            </ul>
          </div>` : d}

      ${this.selected ? this.renderSheet(this.selected) : d}
    `;
  }
  /** Buttons for the saved themes, and the editor for one of them. */
  renderThemes() {
    if (this.themes.length === 0) return h`${d}`;
    const e = this.groups.some(
      (t) => t.override_colour || t.override_brightness
    );
    return h`
      <div class="card">
        <div class="themes-head">
          <h2>Themes</h2>
          <label class="inline-label" for="theme-target">Apply to</label>
          <select
            id="theme-target"
            class="cell"
            @change=${(t) => {
      const i = t.target.value;
      this.themeTarget = i === "" ? [] : [i];
    }}
          >
            <option value="" ?selected=${this.themeTarget.length === 0}>
              rooms each theme covers
            </option>
            ${this.groups.map(
      (t) => h`<option
                value=${t.id}
                ?selected=${this.themeTarget[0] === t.id}
              >
                ${t.name} only
              </option>`
    )}
          </select>
          <button class="secondary small" @click=${() => this.editTheme(null)}>
            New theme
          </button>
          <button
            class="secondary small"
            ?disabled=${!e}
            title=${e ? "Return every room to its curve" : "Every room is already following its curve"}
            @click=${() => void this.releaseThemes()}
          >
            Back to curve
          </button>
        </div>
        <div class="themes">
          ${this.themes.map(
      (t) => h`
              <div class="theme-card ${t.holding ? "holding" : ""}">
                <button
                  class="theme-apply"
                  @click=${() => void this.applyTheme(t)}
                  title=${`Apply to ${t.covers.join(", ")}`}
                >
                  <span class="swatch" style="background:${Ke(t)}"></span>
                  <span class="theme-text">
                    <span class="theme-name">${t.name}</span>
                    <span class="theme-detail">
                      ${t.mode === "effect" ? t.effect : `${t.brightness}%${t.colour?.mode === "kelvin" ? ` · ${t.colour.kelvin}K` : ""}`}
                    </span>
                    <span class="theme-covers">
                      ${t.holding && t.holding_in.length < t.covers.length ? `showing in ${t.holding_in.join(", ")}` : t.covers.join(", ")}
                    </span>
                  </span>
                </button>
                <button
                  class="theme-edit"
                  @click=${() => this.editTheme(t)}
                  title=${`Edit ${t.name}`}
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
        ${this.editingTheme ? this.renderThemeEditor(this.editingTheme) : d}
      </div>
    `;
  }
  renderThemeEditor(e) {
    const t = e.colour?.hs ?? [30, 80], i = this.themes.some((s) => s.id === e.id);
    return h`
      <div class="editor">
        <h3>${i ? `Editing ${e.name}` : "New theme"}</h3>
        <div class="row">
          <div class="grow">
            <label for="theme-name">Name</label>
            <input
              id="theme-name"
              .value=${e.name}
              @change=${(s) => this.patchTheme({ name: s.target.value })}
            />
          </div>
          <div>
            <label for="theme-mode">Type</label>
            <select
              id="theme-mode"
              @change=${(s) => {
      const r = s.target.value;
      this.patchTheme(
        r === "effect" ? { mode: r, effect: e.effect ?? "", colour: null, brightness: null } : {
          mode: r,
          effect: null,
          colour: e.colour ?? { mode: "hs", hs: [30, 80] },
          brightness: e.brightness ?? 50
        }
      );
    }}
            >
              <option value="static" ?selected=${e.mode === "static"}>
                Colour and brightness
              </option>
              <option value="effect" ?selected=${e.mode === "effect"}>
                Bulb effect
              </option>
            </select>
          </div>
        </div>

        ${e.mode === "effect" ? h`<div class="row">
              <div class="grow">
                <label for="theme-effect">Effect name</label>
                <input
                  id="theme-effect"
                  .value=${e.effect ?? ""}
                  placeholder="Party"
                  @change=${(s) => this.patchTheme({ effect: s.target.value })}
                />
                <p class="hint">
                  The bulb runs this itself. It must be one your bulbs offer — check
                  the light's effect list in Developer Tools.
                </p>
              </div>
            </div>` : h`
              <lightcurve-colour-wheel
                .hue=${t[0]}
                .saturation=${t[1]}
                .brightness=${e.brightness ?? 50}
                @colour-change=${(s) => this.patchTheme({
      colour: { mode: "hs", hs: [s.detail.hue, s.detail.saturation] },
      brightness: s.detail.brightness
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
              @change=${(s) => {
      const r = s.target;
      this.patchTheme({
        groups: Array.from(r.selectedOptions).map((o) => o.value)
      });
    }}
            >
              ${this.groups.map(
      (s) => h`<option
                  value=${s.id}
                  ?selected=${e.groups.includes(s.id)}
                >
                  ${s.name}
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
              .value=${e.hold_minutes === null ? "" : String(e.hold_minutes)}
              placeholder="never"
              @change=${(s) => {
      const r = s.target.value;
      this.patchTheme({ hold_minutes: r === "" ? null : Number(r) });
    }}
            />
          </div>
        </div>

        <div class="row">
          <button @click=${() => void this.saveTheme()}>Save theme</button>
          <button class="secondary" @click=${() => this.editingTheme = null}>
            Cancel
          </button>
          <div class="grow"></div>
          ${i ? h`<button class="secondary" @click=${() => void this.deleteTheme()}>
                Delete
              </button>` : d}
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
  renderRooms() {
    return this.groups.length === 0 ? h`${d}` : h`
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
      (e) => h`
                  <tr>
                    <td>${e.name}</td>
                    <td>
                      <select
                        class="cell"
                        @change=${(t) => void this.assignProfile(
        e,
        t.target.value
      )}
                      >
                        ${this.profiles.map(
        (t) => h`<option
                            value=${t.id}
                            ?selected=${t.id === e.profile_id}
                          >
                            ${t.name}
                          </option>`
      )}
                      </select>
                    </td>
                    <td class="muted">
                      ${e.members_available.length}${e.members_available.length !== e.members_resolved.length ? ` of ${e.members_resolved.length}` : ""}
                    </td>
                    <td class="muted">
                      ${e.enabled ? e.override_colour || e.override_brightness ? "held" : e.is_on ? "following" : "off" : "curve off"}
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
  renderKeyframeTable() {
    const e = new Map(this.resolved.map((i) => [i.id, i])), t = [...this.keyframes].sort(
      (i, s) => (e.get(i.id)?.minute ?? 0) - (e.get(s.id)?.minute ?? 0)
    );
    return h`
      <div class="card">
        <div class="themes-head">
          <h2>Keyframes</h2>
          <span class="hint">${t.length} of 48</span>
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
              ${t.map((i) => this.renderKeyframeRow(i, e))}
            </tbody>
          </table>
        </div>
        ${this.colourPickFor ? this.renderKeyframeColour(this.colourPickFor) : d}
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
  renderKeyframeColour(e) {
    const t = this.keyframes.find((r) => r.id === e);
    if (!t) return h`${d}`;
    const i = this.resolved.find((r) => r.id === e), s = t.colour.hs ?? [30, 90];
    return h`
      <div class="editor">
        <h3>Colour at ${i ? P(i.minute) : e}</h3>
        <div class="row">
          <div>
            <label for="kf-mode">Type</label>
            <select
              id="kf-mode"
              @change=${(r) => {
      const o = r.target.value;
      this.mutate(t.id, (n) => {
        n.colour = o === "kelvin" ? { mode: "kelvin", kelvin: 2700 } : { mode: "hs", hs: [30, 90] };
      }), this.refreshGraph();
    }}
            >
              <option value="kelvin" ?selected=${t.colour.mode === "kelvin"}>
                White (colour temperature)
              </option>
              <option value="hs" ?selected=${t.colour.mode === "hs"}>
                Colour
              </option>
            </select>
          </div>
          ${t.colour.mode === "kelvin" ? h`<div class="grow">
                <label for="kf-kelvin">
                  ${t.colour.kelvin}K — warm to cool
                </label>
                <input
                  id="kf-kelvin"
                  type="range"
                  min="2200"
                  max="6500"
                  step="50"
                  .value=${String(t.colour.kelvin ?? 2700)}
                  @input=${(r) => {
      this.mutate(t.id, (o) => {
        o.colour = {
          mode: "kelvin",
          kelvin: Number(r.target.value)
        };
      });
    }}
                  @change=${() => void this.refreshGraph()}
                />
              </div>` : d}
        </div>
        ${t.colour.mode === "hs" ? h`<lightcurve-colour-wheel
              .hue=${s[0]}
              .saturation=${s[1]}
              .brightness=${t.brightness}
              @colour-change=${(r) => {
      this.mutate(t.id, (o) => {
        o.colour = {
          mode: "hs",
          hs: [r.detail.hue, r.detail.saturation]
        }, o.brightness = r.detail.brightness;
      }), this.refreshGraph();
    }}
            ></lightcurve-colour-wheel>` : d}
        <div class="row">
          <button class="secondary" @click=${() => this.colourPickFor = null}>
            Done
          </button>
        </div>
      </div>
    `;
  }
  renderKeyframeRow(e, t) {
    const i = t.get(e.id), s = e.time.type === "sun", r = e.colour.mode === "kelvin" ? Kt(e.colour.kelvin ?? 3e3) : Lt(e.colour.hs?.[0] ?? 0, e.colour.hs?.[1] ?? 100);
    return h`
      <tr class=${this.selectedId === e.id ? "selected" : ""}
          @click=${() => this.selectedId = e.id}>
        <td>
          ${s ? h`<span class="sun-pill" title="Follows the sun, so it moves daily">
                ${e.time.event}${(e.time.offset_min ?? 0) !== 0 ? ` ${e.time.offset_min > 0 ? "+" : ""}${e.time.offset_min}m` : ""}
              </span>` : h`<input
                class="cell"
                .value=${e.time.value ?? "00:00"}
                @change=${(o) => {
      const n = Et(o.target.value);
      n !== null && (this.mutate(e.id, (a) => {
        a.time = { type: "fixed", value: P(n) };
      }), this.refreshGraph());
    }}
              />`}
        </td>
        <td class="muted">
          ${i ? P(i.minute) : "—"}
        </td>
        <td>
          <button
            class="swatch-button"
            title="Pick this keyframe's colour"
            @click=${(o) => {
      o.stopPropagation(), this.selectedId = e.id, this.colourPickFor = this.colourPickFor === e.id ? null : e.id;
    }}
          >
            <span class="swatch inline" style="background:${r}"></span>
          </button>
          ${e.colour.mode === "kelvin" ? h`<input
                class="cell narrow"
                type="number"
                min="1000"
                max="20000"
                step="50"
                .value=${String(e.colour.kelvin ?? 3e3)}
                @change=${(o) => {
      this.mutate(e.id, (n) => {
        n.colour = {
          mode: "kelvin",
          kelvin: Number(o.target.value)
        };
      }), this.refreshGraph();
    }}
              />K` : h`<input
                class="cell narrow"
                type="number"
                min="0"
                max="360"
                .value=${String(Math.round(e.colour.hs?.[0] ?? 0))}
                @change=${(o) => {
      const n = e.colour.hs?.[1] ?? 100;
      this.mutate(e.id, (a) => {
        a.colour = {
          mode: "hs",
          hs: [Number(o.target.value), n]
        };
      }), this.refreshGraph();
    }}
              />°`}
        </td>
        <td>
          <input
            class="cell narrow"
            type="number"
            min="1"
            max="100"
            .value=${String(e.brightness)}
            @change=${(o) => {
      this.mutate(e.id, (n) => {
        n.brightness = Number(o.target.value);
      }), this.refreshGraph();
    }}
          />%
        </td>
        <td>
          <select
            class="cell"
            @change=${(o) => {
      this.mutate(e.id, (n) => {
        n.easing = o.target.value;
      }), this.refreshGraph();
    }}
          >
            ${["linear", "ease_in_out", "step"].map(
      (o) => h`<option value=${o} ?selected=${e.easing === o}>
                ${o}
              </option>`
    )}
          </select>
        </td>
        <td>
          <button
            class="secondary small"
            ?disabled=${this.keyframes.length <= 2}
            @click=${(o) => {
      o.stopPropagation(), this.selectedId = e.id, this.deleteSelected();
    }}
          >✕</button>
        </td>
      </tr>
    `;
  }
  renderSheet(e) {
    return h`
      <div class="sheet">
        <div class="row">
          <div>
            <label for="time">Time</label>
            ${e.time.type === "sun" ? h`<input id="time" .value=${`${e.time.event} ${e.time.offset_min ?? 0}m`} readonly />` : h`<input
                  id="time"
                  .value=${e.time.value ?? "00:00"}
                  @change=${(t) => {
      const i = Et(t.target.value);
      i !== null && (this.mutate(e.id, (s) => {
        s.time = { type: "fixed", value: P(i) };
      }), this.refreshGraph());
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
              .value=${String(e.brightness)}
              @change=${(t) => {
      this.mutate(e.id, (i) => {
        i.brightness = Number(t.target.value);
      }), this.refreshGraph();
    }}
            />
          </div>
          <div>
            <label for="mode">Colour</label>
            <select
              id="mode"
              @change=${(t) => {
      const i = t.target.value;
      this.mutate(e.id, (s) => {
        s.colour = i === "kelvin" ? { mode: "kelvin", kelvin: 3e3 } : { mode: "hs", hs: [0, 100] };
      }), this.refreshGraph();
    }}
            >
              <option value="kelvin" ?selected=${e.colour.mode === "kelvin"}>
                Colour temperature
              </option>
              <option value="hs" ?selected=${e.colour.mode === "hs"}>
                Colour
              </option>
            </select>
          </div>
          <div>
            <label for="easing">Easing</label>
            <select
              id="easing"
              @change=${(t) => {
      this.mutate(e.id, (i) => {
        i.easing = t.target.value;
      }), this.refreshGraph();
    }}
            >
              ${["linear", "ease_in_out", "step"].map(
      (t) => h`<option value=${t} ?selected=${e.easing === t}>
                  ${t}
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
};
p.styles = dt`
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
g([
  y({ attribute: !1 })
], p.prototype, "hass", 2);
g([
  y({ type: Boolean })
], p.prototype, "narrow", 2);
g([
  m()
], p.prototype, "profiles", 2);
g([
  m()
], p.prototype, "groups", 2);
g([
  m()
], p.prototype, "themes", 2);
g([
  m()
], p.prototype, "editingTheme", 2);
g([
  m()
], p.prototype, "themeTarget", 2);
g([
  m()
], p.prototype, "colourPickFor", 2);
g([
  m()
], p.prototype, "profile", 2);
g([
  m()
], p.prototype, "variant", 2);
g([
  m()
], p.prototype, "samples", 2);
g([
  m()
], p.prototype, "resolved", 2);
g([
  m()
], p.prototype, "sun", 2);
g([
  m()
], p.prototype, "issues", 2);
g([
  m()
], p.prototype, "selectedId", 2);
g([
  m()
], p.prototype, "previewGroupId", 2);
g([
  m()
], p.prototype, "scrubMinute", 2);
g([
  m()
], p.prototype, "dirty", 2);
g([
  m()
], p.prototype, "busy", 2);
g([
  m()
], p.prototype, "error", 2);
g([
  m()
], p.prototype, "graphWidth", 2);
p = g([
  gt("lightcurve-panel")
], p);
function Ke(e) {
  if (e.mode === "effect")
    return "linear-gradient(135deg, #ff4081, #7c4dff, #00bcd4)";
  if (e.colour?.mode === "kelvin")
    return Kt(e.colour.kelvin ?? 3e3);
  const t = e.colour?.hs ?? [30, 80];
  return Lt(t[0], t[1]);
}
function Ut(e, t) {
  return e.brightness_pct ?? 1;
}
function Fe(e, t, i, s) {
  return { ...e, brightness_pct: Math.round(i) };
}
function We() {
  const e = /* @__PURE__ */ new Date();
  return e.getHours() * 60 + e.getMinutes();
}
function x(e) {
  return e && typeof e == "object" && "message" in e ? String(e.message) : String(e);
}
export {
  p as LightcurvePanel
};
