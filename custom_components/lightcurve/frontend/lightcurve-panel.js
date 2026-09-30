/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const X = globalThis, at = X.ShadowRoot && (X.ShadyCSS === void 0 || X.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, ht = Symbol(), pt = /* @__PURE__ */ new WeakMap();
let Tt = class {
  constructor(t, i, s) {
    if (this._$cssResult$ = !0, s !== ht) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = i;
  }
  get styleSheet() {
    let t = this.o;
    const i = this.t;
    if (at && t === void 0) {
      const s = i !== void 0 && i.length === 1;
      s && (t = pt.get(i)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), s && pt.set(i, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const Dt = (e) => new Tt(typeof e == "string" ? e : e + "", void 0, ht), Ot = (e, ...t) => {
  const i = e.length === 1 ? e[0] : t.reduce((s, r, n) => s + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(r) + e[n + 1], e[0]);
  return new Tt(i, e, ht);
}, Gt = (e, t) => {
  if (at) e.adoptedStyleSheets = t.map((i) => i instanceof CSSStyleSheet ? i : i.styleSheet);
  else for (const i of t) {
    const s = document.createElement("style"), r = X.litNonce;
    r !== void 0 && s.setAttribute("nonce", r), s.textContent = i.cssText, e.appendChild(s);
  }
}, ft = at ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((t) => {
  let i = "";
  for (const s of t.cssRules) i += s.cssText;
  return Dt(i);
})(e) : e;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: Kt, defineProperty: jt, getOwnPropertyDescriptor: zt, getOwnPropertyNames: Bt, getOwnPropertySymbols: Wt, getPrototypeOf: Ft } = Object, et = globalThis, mt = et.trustedTypes, Vt = mt ? mt.emptyScript : "", qt = et.reactiveElementPolyfillSupport, K = (e, t) => e, Z = { toAttribute(e, t) {
  switch (t) {
    case Boolean:
      e = e ? Vt : null;
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
} }, lt = (e, t) => !Kt(e, t), vt = { attribute: !0, type: String, converter: Z, reflect: !1, useDefault: !1, hasChanged: lt };
Symbol.metadata ??= Symbol("metadata"), et.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let I = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, i = vt) {
    if (i.state && (i.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((i = Object.create(i)).wrapped = !0), this.elementProperties.set(t, i), !i.noAccessor) {
      const s = Symbol(), r = this.getPropertyDescriptor(t, s, i);
      r !== void 0 && jt(this.prototype, t, r);
    }
  }
  static getPropertyDescriptor(t, i, s) {
    const { get: r, set: n } = zt(this.prototype, t) ?? { get() {
      return this[i];
    }, set(o) {
      this[i] = o;
    } };
    return { get: r, set(o) {
      const a = r?.call(this);
      n?.call(this, o), this.requestUpdate(t, a, s);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? vt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(K("elementProperties"))) return;
    const t = Ft(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(K("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(K("properties"))) {
      const i = this.properties, s = [...Bt(i), ...Wt(i)];
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
      for (const r of s) i.unshift(ft(r));
    } else t !== void 0 && i.push(ft(t));
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
    return Gt(t, this.constructor.elementStyles), t;
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
      const n = (s.converter?.toAttribute !== void 0 ? s.converter : Z).toAttribute(i, s.type);
      this._$Em = t, n == null ? this.removeAttribute(r) : this.setAttribute(r, n), this._$Em = null;
    }
  }
  _$AK(t, i) {
    const s = this.constructor, r = s._$Eh.get(t);
    if (r !== void 0 && this._$Em !== r) {
      const n = s.getPropertyOptions(r), o = typeof n.converter == "function" ? { fromAttribute: n.converter } : n.converter?.fromAttribute !== void 0 ? n.converter : Z;
      this._$Em = r;
      const a = o.fromAttribute(i, n.type);
      this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
    }
  }
  requestUpdate(t, i, s, r = !1, n) {
    if (t !== void 0) {
      const o = this.constructor;
      if (r === !1 && (n = this[t]), s ??= o.getPropertyOptions(t), !((s.hasChanged ?? lt)(n, i) || s.useDefault && s.reflect && n === this._$Ej?.get(t) && !this.hasAttribute(o._$Eu(t, s)))) return;
      this.C(t, i, s);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, i, { useDefault: s, reflect: r, wrapped: n }, o) {
    s && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, o ?? i ?? this[t]), n !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || s || (i = void 0), this._$AL.set(t, i)), r === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
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
        for (const [r, n] of this._$Ep) this[r] = n;
        this._$Ep = void 0;
      }
      const s = this.constructor.elementProperties;
      if (s.size > 0) for (const [r, n] of s) {
        const { wrapped: o } = n, a = this[r];
        o !== !0 || this._$AL.has(r) || a === void 0 || this.C(r, void 0, n, a);
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
I.elementStyles = [], I.shadowRootOptions = { mode: "open" }, I[K("elementProperties")] = /* @__PURE__ */ new Map(), I[K("finalized")] = /* @__PURE__ */ new Map(), qt?.({ ReactiveElement: I }), (et.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ct = globalThis, gt = (e) => e, Q = ct.trustedTypes, $t = Q ? Q.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, It = "$lit$", E = `lit$${Math.random().toFixed(9).slice(2)}$`, Nt = "?" + E, Yt = `<${Nt}>`, T = document, z = () => T.createComment(""), B = (e) => e === null || typeof e != "object" && typeof e != "function", ut = Array.isArray, Jt = (e) => ut(e) || typeof e?.[Symbol.iterator] == "function", st = `[ 	
\f\r]`, D = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, bt = /-->/g, yt = />/g, M = RegExp(`>|${st}(?:([^\\s"'>=/]+)(${st}*=${st}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), xt = /'/g, _t = /"/g, Ut = /^(?:script|style|textarea|title)$/i, Rt = (e) => (t, ...i) => ({ _$litType$: e, strings: t, values: i }), b = Rt(1), p = Rt(2), U = Symbol.for("lit-noChange"), f = Symbol.for("lit-nothing"), wt = /* @__PURE__ */ new WeakMap(), C = T.createTreeWalker(T, 129);
function Ht(e, t) {
  if (!ut(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return $t !== void 0 ? $t.createHTML(t) : t;
}
const Xt = (e, t) => {
  const i = e.length - 1, s = [];
  let r, n = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = D;
  for (let a = 0; a < i; a++) {
    const h = e[a];
    let l, c, u = -1, w = 0;
    for (; w < h.length && (o.lastIndex = w, c = o.exec(h), c !== null); ) w = o.lastIndex, o === D ? c[1] === "!--" ? o = bt : c[1] !== void 0 ? o = yt : c[2] !== void 0 ? (Ut.test(c[2]) && (r = RegExp("</" + c[2], "g")), o = M) : c[3] !== void 0 && (o = M) : o === M ? c[0] === ">" ? (o = r ?? D, u = -1) : c[1] === void 0 ? u = -2 : (u = o.lastIndex - c[2].length, l = c[1], o = c[3] === void 0 ? M : c[3] === '"' ? _t : xt) : o === _t || o === xt ? o = M : o === bt || o === yt ? o = D : (o = M, r = void 0);
    const y = o === M && e[a + 1].startsWith("/>") ? " " : "";
    n += o === D ? h + Yt : u >= 0 ? (s.push(l), h.slice(0, u) + It + h.slice(u) + E + y) : h + E + (u === -2 ? a : y);
  }
  return [Ht(e, n + (e[i] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), s];
};
class W {
  constructor({ strings: t, _$litType$: i }, s) {
    let r;
    this.parts = [];
    let n = 0, o = 0;
    const a = t.length - 1, h = this.parts, [l, c] = Xt(t, i);
    if (this.el = W.createElement(l, s), C.currentNode = this.el.content, i === 2 || i === 3) {
      const u = this.el.content.firstChild;
      u.replaceWith(...u.childNodes);
    }
    for (; (r = C.nextNode()) !== null && h.length < a; ) {
      if (r.nodeType === 1) {
        if (r.hasAttributes()) for (const u of r.getAttributeNames()) if (u.endsWith(It)) {
          const w = c[o++], y = r.getAttribute(u).split(E), d = /([.?@])?(.*)/.exec(w);
          h.push({ type: 1, index: n, name: d[2], strings: y, ctor: d[1] === "." ? Qt : d[1] === "?" ? te : d[1] === "@" ? ee : it }), r.removeAttribute(u);
        } else u.startsWith(E) && (h.push({ type: 6, index: n }), r.removeAttribute(u));
        if (Ut.test(r.tagName)) {
          const u = r.textContent.split(E), w = u.length - 1;
          if (w > 0) {
            r.textContent = Q ? Q.emptyScript : "";
            for (let y = 0; y < w; y++) r.append(u[y], z()), C.nextNode(), h.push({ type: 2, index: ++n });
            r.append(u[w], z());
          }
        }
      } else if (r.nodeType === 8) if (r.data === Nt) h.push({ type: 2, index: n });
      else {
        let u = -1;
        for (; (u = r.data.indexOf(E, u + 1)) !== -1; ) h.push({ type: 7, index: n }), u += E.length - 1;
      }
      n++;
    }
  }
  static createElement(t, i) {
    const s = T.createElement("template");
    return s.innerHTML = t, s;
  }
}
function R(e, t, i = e, s) {
  if (t === U) return t;
  let r = s !== void 0 ? i._$Co?.[s] : i._$Cl;
  const n = B(t) ? void 0 : t._$litDirective$;
  return r?.constructor !== n && (r?._$AO?.(!1), n === void 0 ? r = void 0 : (r = new n(e), r._$AT(e, i, s)), s !== void 0 ? (i._$Co ??= [])[s] = r : i._$Cl = r), r !== void 0 && (t = R(e, r._$AS(e, t.values), r, s)), t;
}
class Zt {
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
    const { el: { content: i }, parts: s } = this._$AD, r = (t?.creationScope ?? T).importNode(i, !0);
    C.currentNode = r;
    let n = C.nextNode(), o = 0, a = 0, h = s[0];
    for (; h !== void 0; ) {
      if (o === h.index) {
        let l;
        h.type === 2 ? l = new F(n, n.nextSibling, this, t) : h.type === 1 ? l = new h.ctor(n, h.name, h.strings, this, t) : h.type === 6 && (l = new ie(n, this, t)), this._$AV.push(l), h = s[++a];
      }
      o !== h?.index && (n = C.nextNode(), o++);
    }
    return C.currentNode = T, r;
  }
  p(t) {
    let i = 0;
    for (const s of this._$AV) s !== void 0 && (s.strings !== void 0 ? (s._$AI(t, s, i), i += s.strings.length - 2) : s._$AI(t[i])), i++;
  }
}
class F {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, i, s, r) {
    this.type = 2, this._$AH = f, this._$AN = void 0, this._$AA = t, this._$AB = i, this._$AM = s, this.options = r, this._$Cv = r?.isConnected ?? !0;
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
    t = R(this, t, i), B(t) ? t === f || t == null || t === "" ? (this._$AH !== f && this._$AR(), this._$AH = f) : t !== this._$AH && t !== U && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Jt(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== f && B(this._$AH) ? this._$AA.nextSibling.data = t : this.T(T.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: i, _$litType$: s } = t, r = typeof s == "number" ? this._$AC(t) : (s.el === void 0 && (s.el = W.createElement(Ht(s.h, s.h[0]), this.options)), s);
    if (this._$AH?._$AD === r) this._$AH.p(i);
    else {
      const n = new Zt(r, this), o = n.u(this.options);
      n.p(i), this.T(o), this._$AH = n;
    }
  }
  _$AC(t) {
    let i = wt.get(t.strings);
    return i === void 0 && wt.set(t.strings, i = new W(t)), i;
  }
  k(t) {
    ut(this._$AH) || (this._$AH = [], this._$AR());
    const i = this._$AH;
    let s, r = 0;
    for (const n of t) r === i.length ? i.push(s = new F(this.O(z()), this.O(z()), this, this.options)) : s = i[r], s._$AI(n), r++;
    r < i.length && (this._$AR(s && s._$AB.nextSibling, r), i.length = r);
  }
  _$AR(t = this._$AA.nextSibling, i) {
    for (this._$AP?.(!1, !0, i); t !== this._$AB; ) {
      const s = gt(t).nextSibling;
      gt(t).remove(), t = s;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class it {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, i, s, r, n) {
    this.type = 1, this._$AH = f, this._$AN = void 0, this.element = t, this.name = i, this._$AM = r, this.options = n, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = f;
  }
  _$AI(t, i = this, s, r) {
    const n = this.strings;
    let o = !1;
    if (n === void 0) t = R(this, t, i, 0), o = !B(t) || t !== this._$AH && t !== U, o && (this._$AH = t);
    else {
      const a = t;
      let h, l;
      for (t = n[0], h = 0; h < n.length - 1; h++) l = R(this, a[s + h], i, h), l === U && (l = this._$AH[h]), o ||= !B(l) || l !== this._$AH[h], l === f ? t = f : t !== f && (t += (l ?? "") + n[h + 1]), this._$AH[h] = l;
    }
    o && !r && this.j(t);
  }
  j(t) {
    t === f ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Qt extends it {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === f ? void 0 : t;
  }
}
class te extends it {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== f);
  }
}
class ee extends it {
  constructor(t, i, s, r, n) {
    super(t, i, s, r, n), this.type = 5;
  }
  _$AI(t, i = this) {
    if ((t = R(this, t, i, 0) ?? f) === U) return;
    const s = this._$AH, r = t === f && s !== f || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, n = t !== f && (s === f || r);
    r && this.element.removeEventListener(this.name, this, s), n && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class ie {
  constructor(t, i, s) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = i, this.options = s;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    R(this, t);
  }
}
const se = ct.litHtmlPolyfillSupport;
se?.(W, F), (ct.litHtmlVersions ??= []).push("3.3.3");
const re = (e, t, i) => {
  const s = i?.renderBefore ?? t;
  let r = s._$litPart$;
  if (r === void 0) {
    const n = i?.renderBefore ?? null;
    s._$litPart$ = r = new F(t.insertBefore(z(), n), n, void 0, i ?? {});
  }
  return r._$AI(e), r;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const dt = globalThis;
class N extends I {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const i = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = re(i, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return U;
  }
}
N._$litElement$ = !0, N.finalized = !0, dt.litElementHydrateSupport?.({ LitElement: N });
const ne = dt.litElementPolyfillSupport;
ne?.({ LitElement: N });
(dt.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Lt = (e) => (t, i) => {
  i !== void 0 ? i.addInitializer(() => {
    customElements.define(e, t);
  }) : customElements.define(e, t);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const oe = { attribute: !0, type: String, converter: Z, reflect: !1, hasChanged: lt }, ae = (e = oe, t, i) => {
  const { kind: s, metadata: r } = i;
  let n = globalThis.litPropertyMetadata.get(r);
  if (n === void 0 && globalThis.litPropertyMetadata.set(r, n = /* @__PURE__ */ new Map()), s === "setter" && ((e = Object.create(e)).wrapped = !0), n.set(i.name, e), s === "accessor") {
    const { name: o } = i;
    return { set(a) {
      const h = t.get.call(this);
      t.set.call(this, a), this.requestUpdate(o, h, e, !0, a);
    }, init(a) {
      return a !== void 0 && this.C(o, void 0, e, a), a;
    } };
  }
  if (s === "setter") {
    const { name: o } = i;
    return function(a) {
      const h = this[o];
      t.call(this, a), this.requestUpdate(o, h, e, !0, a);
    };
  }
  throw Error("Unsupported decorator location: " + s);
};
function _(e) {
  return (t, i) => typeof i == "object" ? ae(e, t, i) : ((s, r, n) => {
    const o = r.hasOwnProperty(n);
    return r.constructor.createProperty(n, s), o ? Object.getOwnPropertyDescriptor(r, n) : void 0;
  })(e, t, i);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function v(e) {
  return _({ ...e, state: !0, attribute: !1 });
}
const S = 1440;
function A(e, t) {
  return t.left + e / S * t.width;
}
function rt(e, t) {
  const i = (e - t.left) / t.width;
  return V(Math.round(i * S), 0, S - 1);
}
function G(e, t) {
  return t.top + (1 - e / 100) * t.height;
}
function At(e, t) {
  const i = 1 - (e - t.top) / t.height;
  return V(Math.round(i * 100), 1, 100);
}
function kt(e, t, i, s) {
  const r = 1e6 / e, n = 1e6 / s, o = 1e6 / i, a = (r - n) / (o - n);
  return t.top + V(a, 0, 1) * t.height;
}
function St(e, t, i, s) {
  const r = V((e - t.top) / t.height, 0, 1), n = 1e6 / s, o = 1e6 / i;
  return Math.round(1e6 / (n + r * (o - n)));
}
function V(e, t, i) {
  return Math.min(i, Math.max(t, e));
}
function he(e, t = 5) {
  return V(Math.round(e / t) * t, 0, S - 1);
}
function le(e, t, i = 12) {
  let s = null, r = 1 / 0;
  for (const n of t) {
    const o = Math.abs(n.minute - e);
    o < r && (r = o, s = n);
  }
  return s && r <= i ? { minute: s.minute, event: s.event } : { minute: he(e), event: null };
}
function ce(e, t, i, s = 22) {
  let r = null, n = s;
  for (const o of i) {
    const a = Math.hypot(o.x - e, o.y - t);
    a <= n && (n = a, r = o.id);
  }
  return r;
}
function j(e) {
  const t = (e % S + S) % S, i = Math.floor(t / 60), s = t % 60;
  return `${String(i).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function ue(e) {
  const t = /^(\d{1,2}):(\d{2})$/.exec(e.trim());
  if (!t) return null;
  const i = Number(t[1]), s = Number(t[2]);
  return i > 23 || s > 59 ? null : i * 60 + s;
}
var de = Object.defineProperty, pe = Object.getOwnPropertyDescriptor, x = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? pe(t, i) : t, n = e.length - 1, o; n >= 0; n--)
    (o = e[n]) && (r = (s ? o(t, i, r) : o(r)) || r);
  return s && r && de(t, i, r), r;
};
const nt = 128, Et = 18, J = 46, fe = 14, Mt = 22, ot = 26, O = 34;
let $ = class extends N {
  constructor() {
    super(...arguments), this.samples = [], this.keyframes = [], this.sun = {}, this.nowMinute = 0, this.selectedId = null, this.minKelvin = 2200, this.maxKelvin = 6500, this.scrubMinute = null, this.width = 900, this.dragging = null, this.morphing = null, this.scrubbing = !1;
  }
  get plotWidth() {
    return Math.max(120, this.width - J - fe);
  }
  plotFor(e) {
    return {
      left: J,
      top: Mt + (e === "brightness" ? 0 : e === "warmth" ? 1 : 2) * (nt + Et + ot),
      width: this.plotWidth,
      height: nt
    };
  }
  get lanesHeight() {
    return Mt + 3 * (nt + Et + ot);
  }
  get scrubTop() {
    return this.lanesHeight + 6;
  }
  get totalHeight() {
    return this.scrubTop + O + 8;
  }
  render() {
    const e = this.totalHeight;
    return b`
      <svg
        viewBox="0 0 ${this.width} ${e}"
        @pointerdown=${this.onPointerDown}
        @pointermove=${this.onPointerMove}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerUp}
      >
        ${this.renderLane("brightness", "Brightness")}
        ${this.renderLane("warmth", "Warmth")}
        ${this.renderLane("colour", "Colour")}
        ${this.renderScrubBar()}
      </svg>
    `;
  }
  /** Previewing lives here, because dragging a lane now deforms the curve.
   *  Keeping both on the same surface would mean a mode, and a mode means
   *  sometimes dragging and getting the wrong one. */
  renderScrubBar() {
    const e = {
      left: J,
      top: this.scrubTop,
      width: this.plotWidth,
      height: O
    }, t = this.scrubMinute === null ? null : A(this.scrubMinute, e);
    return p`
      <g>
        <rect class="scrub-bar" x=${e.left} y=${e.top}
              width=${e.width} height=${e.height} rx=${O / 2} />
        ${this.samples.map((i, s) => {
      const r = this.samples[s + 1], n = A(i.minute, e), o = r ? A(r.minute, e) : e.left + e.width, a = i.rgb ?? [80, 80, 80];
      return p`<rect x=${n} y=${e.top + 7}
                           width=${Math.max(1, o - n)} height=${O - 14}
                           fill="rgb(${a[0]},${a[1]},${a[2]})" />`;
    })}
        <text class="axis-label" x=${e.left - 6} y=${e.top + O / 2 + 3}
              text-anchor="end">preview</text>
        ${t === null ? "" : p`<circle class="scrub-handle" cx=${t}
                        cy=${e.top + O / 2} r="9" />`}
      </g>
    `;
  }
  renderLane(e, t) {
    const i = this.plotFor(e), r = this.samples.filter((n) => this.laneApplies(e, n)).length === 0 && e !== "brightness";
    return p`
      <g>
        <text class="lane-title" x=${i.left} y=${i.top - 7}>${t}</text>
        <rect class="lane-bg" x=${i.left} y=${i.top}
              width=${i.width} height=${i.height} rx="6" />
        ${this.renderGrid(i, e)}
        ${this.renderGradientStrip(i, e)}
        ${this.renderCurve(i, e)}
        ${this.renderSunMarkers(i)}
        ${this.renderNow(i)}
        ${this.renderScrub(i)}
        ${this.renderHandles(i, e)}
        ${r ? p`
            <rect class="inactive-wash" x=${i.left} y=${i.top}
                  width=${i.width} height=${i.height} rx="6" />
            <text class="inactive-note" x=${i.left + i.width / 2}
                  y=${i.top + i.height / 2} text-anchor="middle">
              ${e === "warmth" ? "this curve has no colour-temperature section" : "this curve has no colour section"}
            </text>` : ""}
      </g>
    `;
  }
  /** Is this sample edited in this lane? Warmth and colour are mutually exclusive. */
  laneApplies(e, t) {
    return e === "brightness" ? t.brightness_pct !== null : e === "warmth" ? t.mode === "kelvin" : t.mode === "hs";
  }
  renderGrid(e, t) {
    const i = [];
    for (let r = 0; r <= 24; r += 3) {
      const n = A(r * 60, e);
      i.push(p`<line class="grid" x1=${n} y1=${e.top} x2=${n}
                          y2=${e.top + e.height} />`), t === "colour" && i.push(p`<text class="axis-label" x=${n} y=${e.top + e.height + 16}
                             text-anchor="middle">${String(r).padStart(2, "0")}</text>`);
    }
    const s = t === "brightness" ? [
      { value: 100, y: G(100, e), text: "100%" },
      { value: 50, y: G(50, e), text: "50%" },
      { value: 1, y: G(1, e), text: "1%" }
    ] : t === "warmth" ? [
      { value: this.maxKelvin, y: e.top, text: `${this.maxKelvin}K` },
      { value: this.minKelvin, y: e.top + e.height, text: `${this.minKelvin}K` }
    ] : [
      { value: 360, y: e.top, text: "360°" },
      { value: 0, y: e.top + e.height, text: "0°" }
    ];
    for (const r of s)
      i.push(p`<text class="axis-label" x=${e.left - 6} y=${r.y + 3}
                           text-anchor="end">${r.text}</text>`);
    return p`${i}`;
  }
  /** The gradient strip under each lane, drawn from the engine's own colours. */
  renderGradientStrip(e, t) {
    if (this.samples.length === 0) return p``;
    const i = e.top + e.height + (t === "colour" ? 22 : 6), s = this.samples.map((r, n) => {
      const o = this.samples[n + 1], a = A(r.minute, e), h = o ? A(o.minute, e) : e.left + e.width, l = r.rgb ?? [80, 80, 80], c = !this.laneApplies(t, r);
      return p`<rect x=${a} y=${i} width=${Math.max(1, h - a)}
                       height=${ot - 10}
                       fill="rgb(${l[0]},${l[1]},${l[2]})"
                       opacity=${c ? 0.25 : 1} />`;
    });
    return p`<g>${s}</g>`;
  }
  renderCurve(e, t) {
    if (this.samples.length < 2) return p``;
    const i = [];
    for (const s of this.samples) {
      const r = this.laneApplies(t, s), n = this.valueY(e, t, s);
      if (n === null) continue;
      const o = `${A(s.minute, e).toFixed(1)},${n.toFixed(1)}`, a = i[i.length - 1];
      a && a.active === r ? a.points.push(o) : i.push({ active: r, points: [o] });
    }
    return p`${i.filter((s) => s.points.length > 1).map(
      (s) => p`<polyline class="curve ${s.active ? "" : "muted"}"
                        points=${s.points.join(" ")} />`
    )}`;
  }
  valueY(e, t, i) {
    if (t === "brightness")
      return i.brightness_pct === null ? null : G(i.brightness_pct, e);
    if (t === "warmth") {
      const r = i.kelvin ?? this.minKelvin;
      return kt(r, e, this.minKelvin, this.maxKelvin);
    }
    const s = i.hs ? i.hs[0] : 0;
    return e.top + (1 - s / 360) * e.height;
  }
  renderSunMarkers(e) {
    return p`${Object.entries(this.sun).map(([t, i]) => {
      if (!i) return p``;
      const s = A(i.minute, e);
      return p`<line class="sun" x1=${s} y1=${e.top} x2=${s}
                       y2=${e.top + e.height}>
                   <title>${t} ${j(i.minute)}</title>
                 </line>`;
    })}`;
  }
  renderNow(e) {
    const t = A(this.nowMinute, e);
    return p`<line class="now" x1=${t} y1=${e.top} x2=${t}
                     y2=${e.top + e.height} />`;
  }
  renderScrub(e) {
    if (this.scrubMinute === null) return p``;
    const t = A(this.scrubMinute, e);
    return p`<line class="scrub" x1=${t} y1=${e.top} x2=${t}
                     y2=${e.top + e.height} />`;
  }
  handlesFor(e, t) {
    return this.keyframes.filter((i) => this.keyframeInLane(t, i)).map((i) => ({
      id: i.id,
      x: A(i.minute, e),
      y: this.keyframeY(e, t, i)
    }));
  }
  keyframeInLane(e, t) {
    return e === "brightness" ? !0 : e === "warmth" ? t.mode === "kelvin" : t.mode === "hs";
  }
  keyframeY(e, t, i) {
    if (t === "brightness") return G(i.brightness_pct, e);
    if (t === "warmth")
      return kt(i.kelvin ?? this.minKelvin, e, this.minKelvin, this.maxKelvin);
    const s = i.hs ? i.hs[0] : 0;
    return e.top + (1 - s / 360) * e.height;
  }
  renderHandles(e, t) {
    return p`${this.handlesFor(e, t).map((i) => {
      const s = this.keyframes.find((n) => n.id === i.id), r = s.mode === "kelvin" ? "var(--primary-color, #03a9f4)" : `hsl(${s.hs?.[0] ?? 0}, ${s.hs?.[1] ?? 100}%, 55%)`;
      return p`
        <g>
          <circle class="hit" cx=${i.x} cy=${i.y} r="22"
                  data-id=${i.id} data-lane=${t} />
          <circle class="handle ${this.selectedId === i.id ? "selected" : ""}"
                  cx=${i.x} cy=${i.y} r="6" fill=${r}
                  data-id=${i.id} data-lane=${t}>
            <title>${s.id} · ${j(s.minute)}</title>
          </circle>
        </g>`;
    })}`;
  }
  // --- interaction ----------------------------------------------------------
  localPoint(e) {
    const i = this.renderRoot.querySelector("svg").getBoundingClientRect(), s = this.width / i.width;
    return {
      x: (e.clientX - i.left) * s,
      y: (e.clientY - i.top) * s
    };
  }
  laneAt(e) {
    for (const t of ["brightness", "warmth", "colour"]) {
      const i = this.plotFor(t);
      if (e >= i.top - 10 && e <= i.top + i.height + 10) return t;
    }
    return null;
  }
  onPointerDown(e) {
    const t = this.localPoint(e);
    if (e.target.setPointerCapture?.(e.pointerId), t.y >= this.scrubTop) {
      this.scrubbing = !0, this.emitScrub(t.x);
      return;
    }
    const i = this.laneAt(t.y);
    if (!i) return;
    const s = this.plotFor(i), r = ce(t.x, t.y, this.handlesFor(s, i));
    if (r) {
      this.dragging = { id: r, lane: i }, this.selectedId = r, this.dispatchEvent(
        new CustomEvent("keyframe-select", { detail: { id: r }, bubbles: !0, composed: !0 })
      );
      return;
    }
    this.morphing = i, this.emitMorph(i, t);
  }
  onPointerMove(e) {
    const t = this.localPoint(e);
    if (this.scrubbing) {
      this.emitScrub(t.x);
      return;
    }
    if (this.morphing) {
      this.emitMorph(this.morphing, t);
      return;
    }
    if (!this.dragging) return;
    const i = t, s = this.plotFor(this.dragging.lane), r = Object.entries(this.sun).filter(([, a]) => a).map(([a, h]) => ({ event: a, minute: h.minute })), n = le(rt(i.x, s), r), o = {
      id: this.dragging.id,
      minute: n.minute,
      sunEvent: n.event
    };
    if (this.dragging.lane === "brightness")
      o.brightness = At(i.y, s);
    else if (this.dragging.lane === "warmth")
      o.kelvin = St(i.y, s, this.minKelvin, this.maxKelvin);
    else {
      const a = 1 - (i.y - s.top) / s.height;
      o.hue = Math.round(Math.min(360, Math.max(0, a * 360)));
    }
    this.dispatchEvent(
      new CustomEvent("keyframe-move", { detail: o, bubbles: !0, composed: !0 })
    );
  }
  onPointerUp() {
    if (this.morphing) {
      const e = this.morphing;
      this.morphing = null, this.dispatchEvent(
        new CustomEvent("morph-commit", { detail: { lane: e }, bubbles: !0, composed: !0 })
      );
      return;
    }
    if (this.scrubbing) {
      this.scrubbing = !1, this.dispatchEvent(new CustomEvent("scrub-end", { bubbles: !0, composed: !0 }));
      return;
    }
    this.dragging && (this.dragging = null, this.dispatchEvent(new CustomEvent("keyframe-commit", { bubbles: !0, composed: !0 })));
  }
  emitScrub(e) {
    const t = {
      left: J,
      top: this.scrubTop,
      width: this.plotWidth
    };
    this.dispatchEvent(
      new CustomEvent("scrub", {
        detail: { minute: rt(e, t) },
        bubbles: !0,
        composed: !0
      })
    );
  }
  /** Report where the cursor is, in this lane's own units. The panel owns the
   *  sample data and does the deformation; the graph stays a view. */
  emitMorph(e, t) {
    const i = this.plotFor(e), s = rt(t.x, i);
    let r;
    if (e === "brightness")
      r = At(t.y, i);
    else if (e === "warmth")
      r = St(t.y, i, this.minKelvin, this.maxKelvin);
    else {
      const n = 1 - (t.y - i.top) / i.height;
      r = Math.round(Math.min(360, Math.max(0, n * 360)));
    }
    this.dispatchEvent(
      new CustomEvent("curve-morph", {
        detail: { lane: e, minute: s, value: r, plotWidth: i.width },
        bubbles: !0,
        composed: !0
      })
    );
  }
};
$.styles = Ot`
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
x([
  _({ attribute: !1 })
], $.prototype, "samples", 2);
x([
  _({ attribute: !1 })
], $.prototype, "keyframes", 2);
x([
  _({ attribute: !1 })
], $.prototype, "sun", 2);
x([
  _({ type: Number })
], $.prototype, "nowMinute", 2);
x([
  _({ type: String })
], $.prototype, "selectedId", 2);
x([
  _({ type: Number })
], $.prototype, "minKelvin", 2);
x([
  _({ type: Number })
], $.prototype, "maxKelvin", 2);
x([
  _({ type: Number })
], $.prototype, "scrubMinute", 2);
x([
  _({ type: Number })
], $.prototype, "width", 2);
x([
  v()
], $.prototype, "dragging", 2);
x([
  v()
], $.prototype, "morphing", 2);
x([
  v()
], $.prototype, "scrubbing", 2);
$ = x([
  Lt("lightcurve-curve-graph")
], $);
function tt(e, t) {
  if (e.length <= 2) return [...e];
  let i = 0, s = 0;
  const r = e[0], n = e[e.length - 1];
  for (let h = 1; h < e.length - 1; h++) {
    const l = me(e[h], r, n);
    l > s && (s = l, i = h);
  }
  if (s <= t)
    return [r, n];
  const o = tt(e.slice(0, i + 1), t), a = tt(e.slice(i), t);
  return [...o.slice(0, -1), ...a];
}
function me(e, t, i) {
  const s = i.minute - t.minute;
  if (s === 0) return Math.abs(e.value - t.value);
  const r = (i.value - t.value) / s, n = t.value + (e.minute - t.minute) * r;
  return Math.abs(e.value - n);
}
function ve(e, t, i = 1.5) {
  let s = i, r = tt(e, s);
  for (let n = 0; n < 24 && r.length > t; n++)
    s *= 1.6, r = tt(e, s);
  return { points: r, tolerance: s };
}
function ge(e, t) {
  if (t <= 0) return e === 0 ? 1 : 0;
  const i = Math.min(1, Math.abs(e) / t);
  return Math.cos(i * Math.PI / 2) ** 2;
}
function H(e, t) {
  const i = Math.abs(e - t);
  return Math.min(i, S - i);
}
function $e(e, t, i, s) {
  const { radiusMinutes: r, min: n, max: o, wrapValue: a } = s;
  return e.map((h) => {
    const l = ge(H(h.minute, t), r);
    if (l === 0) return h;
    let c = h.value + i * l;
    return a ? c = (c % o + o) % o : c = Math.min(o, Math.max(n, c)), { minute: h.minute, value: c };
  });
}
function be(e, t, i, s) {
  const r = ye(e, t);
  return r ? $e(e, t, i - r.value, s) : e;
}
function ye(e, t) {
  let i = null, s = 1 / 0;
  for (const r of e) {
    const n = H(r.minute, t);
    n < s && (s = n, i = r);
  }
  return i;
}
function xe(e, t = 90) {
  return e <= 0 ? 60 : Math.max(15, t / e * S);
}
const _e = 48, we = 5;
function Ae(e, t) {
  let i = null, s = 1 / 0;
  for (const r of e) {
    const n = H(r.minute, t);
    n < s && (s = n, i = r);
  }
  return i ? i.value : null;
}
function Pt(e, t, i) {
  if (t === "brightness")
    e.brightness = Math.round(Math.min(100, Math.max(1, i)));
  else if (t === "warmth")
    e.colour = { mode: "kelvin", kelvin: Math.round(i) };
  else {
    const s = e.colour.hs?.[1] ?? 100;
    e.colour = { mode: "hs", hs: [Math.round(i) % 360, s] };
  }
}
function ke(e) {
  const t = (e % 1440 + 1440) % 1440, i = String(Math.floor(t / 60)).padStart(2, "0"), s = String(t % 60).padStart(2, "0");
  return `${i}:${s}`;
}
function Se(e, t, i, s, r, n = _e) {
  const o = new Map(t.map((d) => [d.id, d.minute])), a = (d) => H(d, r.centre) <= r.radius, h = e.map((d) => {
    const q = o.get(d.id);
    if (q === void 0 || !a(q)) return d;
    const k = Ae(s, q);
    if (k === null) return d;
    const L = JSON.parse(JSON.stringify(d));
    return Pt(L, i, k), L;
  }), l = s.filter((d) => a(d.minute));
  if (l.length < 3) return h;
  const c = i === "brightness" ? 2.5 : i === "warmth" ? 90 : 8, { points: u } = ve(l, n, c), w = h.map((d) => o.get(d.id)).filter((d) => d !== void 0), y = [];
  for (const d of u) {
    if (h.length + y.length >= n) break;
    if ([...w, ...y.map((Y) => Ee(Y))].some(
      (Y) => Y !== null && H(Y, d.minute) < we
    )) continue;
    const k = Me(h, o, d.minute), L = {
      id: `k_${Math.random().toString(36).slice(2, 8)}`,
      time: { type: "fixed", value: ke(d.minute) },
      colour: k ? JSON.parse(JSON.stringify(k.colour)) : { mode: "kelvin", kelvin: 3e3 },
      brightness: k ? k.brightness : 50,
      easing: k ? k.easing : "ease_in_out"
    };
    Pt(L, i, d.value), y.push(L);
  }
  return [...h, ...y];
}
function Ee(e) {
  if (e.time.type !== "fixed" || !e.time.value) return null;
  const [t, i] = e.time.value.split(":").map(Number);
  return t * 60 + i;
}
function Me(e, t, i) {
  let s = null, r = 1 / 0;
  for (const n of e) {
    const o = t.get(n.id);
    if (o === void 0) continue;
    const a = H(o, i);
    a < r && (r = a, s = n);
  }
  return s;
}
var Pe = Object.defineProperty, Ce = Object.getOwnPropertyDescriptor, g = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? Ce(t, i) : t, n = e.length - 1, o; n >= 0; n--)
    (o = e[n]) && (r = (s ? o(t, i, r) : o(r)) || r);
  return s && r && Pe(t, i, r), r;
};
const Te = 300;
let m = class extends N {
  constructor() {
    super(...arguments), this.narrow = !1, this.profiles = [], this.groups = [], this.looks = [], this.profile = null, this.variant = "default", this.samples = [], this.resolved = [], this.sun = {}, this.issues = [], this.selectedId = null, this.previewGroupId = null, this.scrubMinute = null, this.dirty = !1, this.busy = !1, this.error = null, this.graphWidth = 900, this.lastScrubAt = 0, this.morphRegion = null, this.onKeyframeMove = (e) => {
      const { id: t, minute: i, sunEvent: s, brightness: r, kelvin: n, hue: o } = e.detail;
      this.mutate(t, (a) => {
        if (s ? a.time = { type: "sun", event: s, offset_min: 0 } : a.time = { type: "fixed", value: j(i) }, r !== void 0 && (a.brightness = r), n !== void 0 && (a.colour = { mode: "kelvin", kelvin: n }), o !== void 0) {
          const h = a.colour.hs?.[1] ?? 100;
          a.colour = { mode: "hs", hs: [o, h] };
        }
      });
    }, this.onKeyframeCommit = () => {
      this.refreshGraph();
    }, this.onSelect = (e) => {
      this.selectedId = e.detail.id;
    }, this.onMorph = (e) => {
      const { lane: t, minute: i, value: s, plotWidth: r } = e.detail, n = xe(r), o = t === "brightness" ? { min: 1, max: 100 } : t === "warmth" ? { min: 2200, max: 6500 } : { min: 0, max: 360, wrapValue: !0 }, a = this.samples.map((l) => ({
        minute: l.minute,
        value: Ct(l, t)
      })), h = be(a, i, s, { radiusMinutes: n, ...o });
      this.samples = this.samples.map(
        (l, c) => Oe(l, t, h[c].value)
      ), this.morphRegion = { centre: i, radius: n }, this.dirty = !0;
    }, this.onMorphCommit = (e) => {
      if (!this.profile || !this.morphRegion) return;
      const t = e.detail.lane, i = this.samples.map((r) => ({
        minute: r.minute,
        value: Ct(r, t)
      })), s = Se(
        this.keyframes,
        this.resolved,
        t,
        i,
        this.morphRegion
      );
      this.profile = {
        ...this.profile,
        variants: { ...this.profile.variants, [this.variant]: { keyframes: s } }
      }, this.morphRegion = null, this.refreshGraph();
    }, this.onScrub = (e) => {
      this.scrubMinute = e.detail.minute;
      const t = Date.now();
      t - this.lastScrubAt < Te || (this.lastScrubAt = t, this.previewAt(e.detail.minute));
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
        this.send({ type: "lightcurve/looks/list" })
      ]);
      this.profiles = e.profiles, this.groups = t.groups, this.sun = i.events, this.looks = s.looks, this.previewGroupId ??= this.groups[0]?.id ?? null, this.profiles.length > 0 && await this.openProfile(this.profiles[0].id);
    } catch (e) {
      this.error = P(e);
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
        this.error = P(e);
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
        this.error = P(t);
      }
  }
  async stopPreview() {
    if (this.previewGroupId)
      try {
        await this.send({ type: "lightcurve/preview/stop", group_id: this.previewGroupId });
      } catch {
      }
  }
  async refreshLooks() {
    try {
      const e = await this.send({ type: "lightcurve/looks/list" });
      this.looks = e.looks;
    } catch (e) {
      this.error = P(e);
    }
  }
  async applyLook(e) {
    this.error = null;
    try {
      await this.send({ type: "lightcurve/looks/apply", look_id: e.id });
    } catch (t) {
      this.error = P(t);
    }
    await this.refreshLooks();
  }
  async releaseLooks() {
    this.error = null;
    try {
      await this.send({ type: "lightcurve/looks/release" });
    } catch (e) {
      this.error = P(e);
    }
    await this.refreshLooks();
  }
  async save() {
    if (!(!this.profile || this.blocked)) {
      this.busy = !0, this.error = null;
      try {
        await this.send({ type: "lightcurve/profiles/save", profile: this.profile }), this.dirty = !1, await this.refreshGraph();
      } catch (e) {
        this.error = P(e);
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
        time: { type: "fixed", value: j(e) },
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
    return b`
      ${this.error ? b`<div class="error-banner">${this.error}</div>` : f}
      <div class="bar">
        <div>
          <label for="profile">Profile</label>
          <select id="profile" @change=${(t) => void this.openProfile(t.target.value)}>
            ${this.profiles.map(
      (t) => b`<option value=${t.id} ?selected=${t.id === this.profile?.id}>
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
      (t) => b`<option value=${t.id} ?selected=${t.id === this.previewGroupId}>
                ${t.name}
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
          .nowMinute=${Ie()}
          @keyframe-move=${this.onKeyframeMove}
          @keyframe-commit=${this.onKeyframeCommit}
          @keyframe-select=${this.onSelect}
          @curve-morph=${this.onMorph}
          @morph-commit=${this.onMorphCommit}
          @scrub=${this.onScrub}
          @scrub-end=${this.onScrubEnd}
        ></lightcurve-curve-graph>
        <p class="hint">
          Drag anywhere on a lane to bend the curve around your cursor. Drag a
          handle to move that keyframe, and drop it near a sun marker to make it
          follow that event. The strip at the bottom previews a time of day on
          ${e ? e.name : "the selected room"}.
        </p>
      </div>

      ${this.renderLooks()}

      ${this.issues.length > 0 ? b`<div class="card">
            <ul class="issues">
              ${this.issues.map(
      (t) => b`<li class=${t.level}>${t.message}</li>`
    )}
            </ul>
          </div>` : f}

      ${this.selected ? this.renderSheet(this.selected) : f}
    `;
  }
  /** Buttons for the saved looks.
   *
   *  Home Assistant reserves "Themes" for frontend appearance, so these are called
   *  looks here to avoid two unrelated things sharing a word in the same UI.
   */
  renderLooks() {
    if (this.looks.length === 0) return b`${f}`;
    const e = this.looks.some((t) => t.holding);
    return b`
      <div class="card">
        <div class="looks-head">
          <h2>Looks</h2>
          <button
            class="secondary small"
            ?disabled=${!e}
            title=${e ? "Return every room to its curve" : "Nothing is holding a look"}
            @click=${() => void this.releaseLooks()}
          >
            Back to curve
          </button>
        </div>
        <div class="looks">
          ${this.looks.map(
      (t) => b`
              <button
                class="look ${t.holding ? "holding" : ""}"
                @click=${() => void this.applyLook(t)}
                title=${t.covers.join(", ")}
              >
                <span class="look-name">${t.name}</span>
                <span class="look-detail">
                  ${t.mode === "effect" ? t.effect : `${t.brightness}%${t.colour?.mode === "kelvin" ? ` · ${t.colour.kelvin}K` : ""}`}
                </span>
                <span class="look-covers">${t.covers.join(", ")}</span>
              </button>
            `
    )}
        </div>
        <p class="hint">
          A look holds its values against the curve. Switch the room off and on, or
          press Back to curve, to release it.
        </p>
      </div>
    `;
  }
  renderSheet(e) {
    return b`
      <div class="sheet">
        <div class="row">
          <div>
            <label for="time">Time</label>
            ${e.time.type === "sun" ? b`<input id="time" .value=${`${e.time.event} ${e.time.offset_min ?? 0}m`} readonly />` : b`<input
                  id="time"
                  .value=${e.time.value ?? "00:00"}
                  @change=${(t) => {
      const i = ue(t.target.value);
      i !== null && (this.mutate(e.id, (s) => {
        s.time = { type: "fixed", value: j(i) };
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
      (t) => b`<option value=${t} ?selected=${e.easing === t}>
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
m.styles = Ot`
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
    .looks-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0 0 12px;
    }
    .looks-head h2 {
      margin: 0;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--secondary-text-color, #666);
    }
    button.small { padding: 6px 12px; min-height: 36px; font-size: 13px; }
    .looks {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    button.look {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 12px 14px;
      min-height: 64px;
      text-align: left;
      background: var(--secondary-background-color, #eee);
      color: var(--primary-text-color, #222);
      border: 2px solid transparent;
    }
    button.look.holding {
      border-color: var(--primary-color, #03a9f4);
      background: color-mix(in srgb, var(--primary-color, #03a9f4) 14%, transparent);
    }
    .look-name { font-weight: 600; }
    .look-detail { font-size: 12px; opacity: 0.8; }
    .look-covers {
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
  _({ attribute: !1 })
], m.prototype, "hass", 2);
g([
  _({ type: Boolean })
], m.prototype, "narrow", 2);
g([
  v()
], m.prototype, "profiles", 2);
g([
  v()
], m.prototype, "groups", 2);
g([
  v()
], m.prototype, "looks", 2);
g([
  v()
], m.prototype, "profile", 2);
g([
  v()
], m.prototype, "variant", 2);
g([
  v()
], m.prototype, "samples", 2);
g([
  v()
], m.prototype, "resolved", 2);
g([
  v()
], m.prototype, "sun", 2);
g([
  v()
], m.prototype, "issues", 2);
g([
  v()
], m.prototype, "selectedId", 2);
g([
  v()
], m.prototype, "previewGroupId", 2);
g([
  v()
], m.prototype, "scrubMinute", 2);
g([
  v()
], m.prototype, "dirty", 2);
g([
  v()
], m.prototype, "busy", 2);
g([
  v()
], m.prototype, "error", 2);
g([
  v()
], m.prototype, "graphWidth", 2);
m = g([
  Lt("lightcurve-panel")
], m);
function Ct(e, t) {
  return t === "brightness" ? e.brightness_pct ?? 1 : t === "warmth" ? e.kelvin ?? 2700 : e.hs ? e.hs[0] : 0;
}
function Oe(e, t, i) {
  if (t === "brightness")
    return { ...e, brightness_pct: Math.round(i) };
  if (t === "warmth")
    return { ...e, mode: "kelvin", kelvin: Math.round(i) };
  const s = e.hs ? e.hs[1] : 100;
  return { ...e, mode: "hs", hs: [Math.round(i) % 360, s] };
}
function Ie() {
  const e = /* @__PURE__ */ new Date();
  return e.getHours() * 60 + e.getMinutes();
}
function P(e) {
  return e && typeof e == "object" && "message" in e ? String(e.message) : String(e);
}
export {
  m as LightcurvePanel
};
