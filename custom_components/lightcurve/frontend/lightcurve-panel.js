/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const B = globalThis, Z = B.ShadowRoot && (B.ShadyCSS === void 0 || B.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, Q = Symbol(), rt = /* @__PURE__ */ new WeakMap();
let bt = class {
  constructor(t, e, i) {
    if (this._$cssResult$ = !0, i !== Q) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (Z && t === void 0) {
      const i = e !== void 0 && e.length === 1;
      i && (t = rt.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), i && rt.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const Pt = (s) => new bt(typeof s == "string" ? s : s + "", void 0, Q), _t = (s, ...t) => {
  const e = s.length === 1 ? s[0] : t.reduce((i, r, n) => i + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(r) + s[n + 1], s[0]);
  return new bt(e, s, Q);
}, Mt = (s, t) => {
  if (Z) s.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const i = document.createElement("style"), r = B.litNonce;
    r !== void 0 && i.setAttribute("nonce", r), i.textContent = e.cssText, s.appendChild(i);
  }
}, nt = Z ? (s) => s : (s) => s instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const i of t.cssRules) e += i.cssText;
  return Pt(e);
})(s) : s;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: Ct, defineProperty: Ot, getOwnPropertyDescriptor: Tt, getOwnPropertyNames: Ut, getOwnPropertySymbols: It, getPrototypeOf: Nt } = Object, q = globalThis, ot = q.trustedTypes, Ht = ot ? ot.emptyScript : "", Rt = q.reactiveElementPolyfillSupport, N = (s, t) => s, W = { toAttribute(s, t) {
  switch (t) {
    case Boolean:
      s = s ? Ht : null;
      break;
    case Object:
    case Array:
      s = s == null ? s : JSON.stringify(s);
  }
  return s;
}, fromAttribute(s, t) {
  let e = s;
  switch (t) {
    case Boolean:
      e = s !== null;
      break;
    case Number:
      e = s === null ? null : Number(s);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(s);
      } catch {
        e = null;
      }
  }
  return e;
} }, tt = (s, t) => !Ct(s, t), at = { attribute: !0, type: String, converter: W, reflect: !1, useDefault: !1, hasChanged: tt };
Symbol.metadata ??= Symbol("metadata"), q.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let M = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = at) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const i = Symbol(), r = this.getPropertyDescriptor(t, i, e);
      r !== void 0 && Ot(this.prototype, t, r);
    }
  }
  static getPropertyDescriptor(t, e, i) {
    const { get: r, set: n } = Tt(this.prototype, t) ?? { get() {
      return this[e];
    }, set(o) {
      this[e] = o;
    } };
    return { get: r, set(o) {
      const a = r?.call(this);
      n?.call(this, o), this.requestUpdate(t, a, i);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? at;
  }
  static _$Ei() {
    if (this.hasOwnProperty(N("elementProperties"))) return;
    const t = Nt(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(N("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(N("properties"))) {
      const e = this.properties, i = [...Ut(e), ...It(e)];
      for (const r of i) this.createProperty(r, e[r]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [i, r] of e) this.elementProperties.set(i, r);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, i] of this.elementProperties) {
      const r = this._$Eu(e, i);
      r !== void 0 && this._$Eh.set(r, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const i = new Set(t.flat(1 / 0).reverse());
      for (const r of i) e.unshift(nt(r));
    } else t !== void 0 && e.push(nt(t));
    return e;
  }
  static _$Eu(t, e) {
    const i = e.attribute;
    return i === !1 ? void 0 : typeof i == "string" ? i : typeof t == "string" ? t.toLowerCase() : void 0;
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
    const t = /* @__PURE__ */ new Map(), e = this.constructor.elementProperties;
    for (const i of e.keys()) this.hasOwnProperty(i) && (t.set(i, this[i]), delete this[i]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return Mt(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((t) => t.hostConnected?.());
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t) => t.hostDisconnected?.());
  }
  attributeChangedCallback(t, e, i) {
    this._$AK(t, i);
  }
  _$ET(t, e) {
    const i = this.constructor.elementProperties.get(t), r = this.constructor._$Eu(t, i);
    if (r !== void 0 && i.reflect === !0) {
      const n = (i.converter?.toAttribute !== void 0 ? i.converter : W).toAttribute(e, i.type);
      this._$Em = t, n == null ? this.removeAttribute(r) : this.setAttribute(r, n), this._$Em = null;
    }
  }
  _$AK(t, e) {
    const i = this.constructor, r = i._$Eh.get(t);
    if (r !== void 0 && this._$Em !== r) {
      const n = i.getPropertyOptions(r), o = typeof n.converter == "function" ? { fromAttribute: n.converter } : n.converter?.fromAttribute !== void 0 ? n.converter : W;
      this._$Em = r;
      const a = o.fromAttribute(e, n.type);
      this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
    }
  }
  requestUpdate(t, e, i, r = !1, n) {
    if (t !== void 0) {
      const o = this.constructor;
      if (r === !1 && (n = this[t]), i ??= o.getPropertyOptions(t), !((i.hasChanged ?? tt)(n, e) || i.useDefault && i.reflect && n === this._$Ej?.get(t) && !this.hasAttribute(o._$Eu(t, i)))) return;
      this.C(t, e, i);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: i, reflect: r, wrapped: n }, o) {
    i && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(t) && (this._$Ej.set(t, o ?? e ?? this[t]), n !== !0 || o !== void 0) || (this._$AL.has(t) || (this.hasUpdated || i || (e = void 0), this._$AL.set(t, e)), r === !0 && this._$Em !== t && (this._$Eq ??= /* @__PURE__ */ new Set()).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (e) {
      Promise.reject(e);
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
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [r, n] of i) {
        const { wrapped: o } = n, a = this[r];
        o !== !0 || this._$AL.has(r) || a === void 0 || this.C(r, void 0, n, a);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), this._$EO?.forEach((i) => i.hostUpdate?.()), this.update(e)) : this._$EM();
    } catch (i) {
      throw t = !1, this._$EM(), i;
    }
    t && this._$AE(e);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
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
    this._$Eq &&= this._$Eq.forEach((e) => this._$ET(e, this[e])), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
M.elementStyles = [], M.shadowRootOptions = { mode: "open" }, M[N("elementProperties")] = /* @__PURE__ */ new Map(), M[N("finalized")] = /* @__PURE__ */ new Map(), Rt?.({ ReactiveElement: M }), (q.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const et = globalThis, ht = (s) => s, F = et.trustedTypes, lt = F ? F.createPolicy("lit-html", { createHTML: (s) => s }) : void 0, xt = "$lit$", A = `lit$${Math.random().toFixed(9).slice(2)}$`, wt = "?" + A, Dt = `<${wt}>`, P = document, R = () => P.createComment(""), D = (s) => s === null || typeof s != "object" && typeof s != "function", st = Array.isArray, Gt = (s) => st(s) || typeof s?.[Symbol.iterator] == "function", Y = `[ 	
\f\r]`, U = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, ct = /-->/g, dt = />/g, E = RegExp(`>|${Y}(?:([^\\s"'>=/]+)(${Y}*=${Y}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), ut = /'/g, pt = /"/g, At = /^(?:script|style|textarea|title)$/i, Et = (s) => (t, ...e) => ({ _$litType$: s, strings: t, values: e }), y = Et(1), u = Et(2), O = Symbol.for("lit-noChange"), d = Symbol.for("lit-nothing"), ft = /* @__PURE__ */ new WeakMap(), S = P.createTreeWalker(P, 129);
function St(s, t) {
  if (!st(s) || !s.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return lt !== void 0 ? lt.createHTML(t) : t;
}
const jt = (s, t) => {
  const e = s.length - 1, i = [];
  let r, n = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = U;
  for (let a = 0; a < e; a++) {
    const h = s[a];
    let c, f, l = -1, _ = 0;
    for (; _ < h.length && (o.lastIndex = _, f = o.exec(h), f !== null); ) _ = o.lastIndex, o === U ? f[1] === "!--" ? o = ct : f[1] !== void 0 ? o = dt : f[2] !== void 0 ? (At.test(f[2]) && (r = RegExp("</" + f[2], "g")), o = E) : f[3] !== void 0 && (o = E) : o === E ? f[0] === ">" ? (o = r ?? U, l = -1) : f[1] === void 0 ? l = -2 : (l = o.lastIndex - f[2].length, c = f[1], o = f[3] === void 0 ? E : f[3] === '"' ? pt : ut) : o === pt || o === ut ? o = E : o === ct || o === dt ? o = U : (o = E, r = void 0);
    const x = o === E && s[a + 1].startsWith("/>") ? " " : "";
    n += o === U ? h + Dt : l >= 0 ? (i.push(c), h.slice(0, l) + xt + h.slice(l) + A + x) : h + A + (l === -2 ? a : x);
  }
  return [St(s, n + (s[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), i];
};
class G {
  constructor({ strings: t, _$litType$: e }, i) {
    let r;
    this.parts = [];
    let n = 0, o = 0;
    const a = t.length - 1, h = this.parts, [c, f] = jt(t, e);
    if (this.el = G.createElement(c, i), S.currentNode = this.el.content, e === 2 || e === 3) {
      const l = this.el.content.firstChild;
      l.replaceWith(...l.childNodes);
    }
    for (; (r = S.nextNode()) !== null && h.length < a; ) {
      if (r.nodeType === 1) {
        if (r.hasAttributes()) for (const l of r.getAttributeNames()) if (l.endsWith(xt)) {
          const _ = f[o++], x = r.getAttribute(l).split(A), L = /([.?@])?(.*)/.exec(_);
          h.push({ type: 1, index: n, name: L[2], strings: x, ctor: L[1] === "." ? Lt : L[1] === "?" ? zt : L[1] === "@" ? Bt : V }), r.removeAttribute(l);
        } else l.startsWith(A) && (h.push({ type: 6, index: n }), r.removeAttribute(l));
        if (At.test(r.tagName)) {
          const l = r.textContent.split(A), _ = l.length - 1;
          if (_ > 0) {
            r.textContent = F ? F.emptyScript : "";
            for (let x = 0; x < _; x++) r.append(l[x], R()), S.nextNode(), h.push({ type: 2, index: ++n });
            r.append(l[_], R());
          }
        }
      } else if (r.nodeType === 8) if (r.data === wt) h.push({ type: 2, index: n });
      else {
        let l = -1;
        for (; (l = r.data.indexOf(A, l + 1)) !== -1; ) h.push({ type: 7, index: n }), l += A.length - 1;
      }
      n++;
    }
  }
  static createElement(t, e) {
    const i = P.createElement("template");
    return i.innerHTML = t, i;
  }
}
function T(s, t, e = s, i) {
  if (t === O) return t;
  let r = i !== void 0 ? e._$Co?.[i] : e._$Cl;
  const n = D(t) ? void 0 : t._$litDirective$;
  return r?.constructor !== n && (r?._$AO?.(!1), n === void 0 ? r = void 0 : (r = new n(s), r._$AT(s, e, i)), i !== void 0 ? (e._$Co ??= [])[i] = r : e._$Cl = r), r !== void 0 && (t = T(s, r._$AS(s, t.values), r, i)), t;
}
class Kt {
  constructor(t, e) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = e;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: e }, parts: i } = this._$AD, r = (t?.creationScope ?? P).importNode(e, !0);
    S.currentNode = r;
    let n = S.nextNode(), o = 0, a = 0, h = i[0];
    for (; h !== void 0; ) {
      if (o === h.index) {
        let c;
        h.type === 2 ? c = new j(n, n.nextSibling, this, t) : h.type === 1 ? c = new h.ctor(n, h.name, h.strings, this, t) : h.type === 6 && (c = new Wt(n, this, t)), this._$AV.push(c), h = i[++a];
      }
      o !== h?.index && (n = S.nextNode(), o++);
    }
    return S.currentNode = P, r;
  }
  p(t) {
    let e = 0;
    for (const i of this._$AV) i !== void 0 && (i.strings !== void 0 ? (i._$AI(t, i, e), e += i.strings.length - 2) : i._$AI(t[e])), e++;
  }
}
class j {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t, e, i, r) {
    this.type = 2, this._$AH = d, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = i, this.options = r, this._$Cv = r?.isConnected ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const e = this._$AM;
    return e !== void 0 && t?.nodeType === 11 && (t = e.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, e = this) {
    t = T(this, t, e), D(t) ? t === d || t == null || t === "" ? (this._$AH !== d && this._$AR(), this._$AH = d) : t !== this._$AH && t !== O && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Gt(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== d && D(this._$AH) ? this._$AA.nextSibling.data = t : this.T(P.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: e, _$litType$: i } = t, r = typeof i == "number" ? this._$AC(t) : (i.el === void 0 && (i.el = G.createElement(St(i.h, i.h[0]), this.options)), i);
    if (this._$AH?._$AD === r) this._$AH.p(e);
    else {
      const n = new Kt(r, this), o = n.u(this.options);
      n.p(e), this.T(o), this._$AH = n;
    }
  }
  _$AC(t) {
    let e = ft.get(t.strings);
    return e === void 0 && ft.set(t.strings, e = new G(t)), e;
  }
  k(t) {
    st(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let i, r = 0;
    for (const n of t) r === e.length ? e.push(i = new j(this.O(R()), this.O(R()), this, this.options)) : i = e[r], i._$AI(n), r++;
    r < e.length && (this._$AR(i && i._$AB.nextSibling, r), e.length = r);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    for (this._$AP?.(!1, !0, e); t !== this._$AB; ) {
      const i = ht(t).nextSibling;
      ht(t).remove(), t = i;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class V {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, i, r, n) {
    this.type = 1, this._$AH = d, this._$AN = void 0, this.element = t, this.name = e, this._$AM = r, this.options = n, i.length > 2 || i[0] !== "" || i[1] !== "" ? (this._$AH = Array(i.length - 1).fill(new String()), this.strings = i) : this._$AH = d;
  }
  _$AI(t, e = this, i, r) {
    const n = this.strings;
    let o = !1;
    if (n === void 0) t = T(this, t, e, 0), o = !D(t) || t !== this._$AH && t !== O, o && (this._$AH = t);
    else {
      const a = t;
      let h, c;
      for (t = n[0], h = 0; h < n.length - 1; h++) c = T(this, a[i + h], e, h), c === O && (c = this._$AH[h]), o ||= !D(c) || c !== this._$AH[h], c === d ? t = d : t !== d && (t += (c ?? "") + n[h + 1]), this._$AH[h] = c;
    }
    o && !r && this.j(t);
  }
  j(t) {
    t === d ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class Lt extends V {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === d ? void 0 : t;
  }
}
class zt extends V {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== d);
  }
}
class Bt extends V {
  constructor(t, e, i, r, n) {
    super(t, e, i, r, n), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = T(this, t, e, 0) ?? d) === O) return;
    const i = this._$AH, r = t === d && i !== d || t.capture !== i.capture || t.once !== i.once || t.passive !== i.passive, n = t !== d && (i === d || r);
    r && this.element.removeEventListener(this.name, this, i), n && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, t) : this._$AH.handleEvent(t);
  }
}
class Wt {
  constructor(t, e, i) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = i;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    T(this, t);
  }
}
const Ft = et.litHtmlPolyfillSupport;
Ft?.(G, j), (et.litHtmlVersions ??= []).push("3.3.3");
const qt = (s, t, e) => {
  const i = e?.renderBefore ?? t;
  let r = i._$litPart$;
  if (r === void 0) {
    const n = e?.renderBefore ?? null;
    i._$litPart$ = r = new j(t.insertBefore(R(), n), n, void 0, e ?? {});
  }
  return r._$AI(s), r;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const it = globalThis;
class C extends M {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    const t = super.createRenderRoot();
    return this.renderOptions.renderBefore ??= t.firstChild, t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = qt(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(!0);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(!1);
  }
  render() {
    return O;
  }
}
C._$litElement$ = !0, C.finalized = !0, it.litElementHydrateSupport?.({ LitElement: C });
const Vt = it.litElementPolyfillSupport;
Vt?.({ LitElement: C });
(it.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const kt = (s) => (t, e) => {
  e !== void 0 ? e.addInitializer(() => {
    customElements.define(s, t);
  }) : customElements.define(s, t);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Yt = { attribute: !0, type: String, converter: W, reflect: !1, hasChanged: tt }, Jt = (s = Yt, t, e) => {
  const { kind: i, metadata: r } = e;
  let n = globalThis.litPropertyMetadata.get(r);
  if (n === void 0 && globalThis.litPropertyMetadata.set(r, n = /* @__PURE__ */ new Map()), i === "setter" && ((s = Object.create(s)).wrapped = !0), n.set(e.name, s), i === "accessor") {
    const { name: o } = e;
    return { set(a) {
      const h = t.get.call(this);
      t.set.call(this, a), this.requestUpdate(o, h, s, !0, a);
    }, init(a) {
      return a !== void 0 && this.C(o, void 0, s, a), a;
    } };
  }
  if (i === "setter") {
    const { name: o } = e;
    return function(a) {
      const h = this[o];
      t.call(this, a), this.requestUpdate(o, h, s, !0, a);
    };
  }
  throw Error("Unsupported decorator location: " + i);
};
function m(s) {
  return (t, e) => typeof e == "object" ? Jt(s, t, e) : ((i, r, n) => {
    const o = r.hasOwnProperty(n);
    return r.constructor.createProperty(n, i), o ? Object.getOwnPropertyDescriptor(r, n) : void 0;
  })(s, t, e);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function $(s) {
  return m({ ...s, state: !0, attribute: !1 });
}
const k = 1440;
function w(s, t) {
  return t.left + s / k * t.width;
}
function vt(s, t) {
  const e = (s - t.left) / t.width;
  return K(Math.round(e * k), 0, k - 1);
}
function I(s, t) {
  return t.top + (1 - s / 100) * t.height;
}
function Xt(s, t) {
  const e = 1 - (s - t.top) / t.height;
  return K(Math.round(e * 100), 1, 100);
}
function $t(s, t, e, i) {
  const r = 1e6 / s, n = 1e6 / i, o = 1e6 / e, a = (r - n) / (o - n);
  return t.top + K(a, 0, 1) * t.height;
}
function Zt(s, t, e, i) {
  const r = K((s - t.top) / t.height, 0, 1), n = 1e6 / i, o = 1e6 / e;
  return Math.round(1e6 / (n + r * (o - n)));
}
function K(s, t, e) {
  return Math.min(e, Math.max(t, s));
}
function Qt(s, t = 5) {
  return K(Math.round(s / t) * t, 0, k - 1);
}
function te(s, t, e = 12) {
  let i = null, r = 1 / 0;
  for (const n of t) {
    const o = Math.abs(n.minute - s);
    o < r && (r = o, i = n);
  }
  return i && r <= e ? { minute: i.minute, event: i.event } : { minute: Qt(s), event: null };
}
function ee(s, t, e, i = 22) {
  let r = null, n = i;
  for (const o of e) {
    const a = Math.hypot(o.x - s, o.y - t);
    a <= n && (n = a, r = o.id);
  }
  return r;
}
function H(s) {
  const t = (s % k + k) % k, e = Math.floor(t / 60), i = t % 60;
  return `${String(e).padStart(2, "0")}:${String(i).padStart(2, "0")}`;
}
function se(s) {
  const t = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!t) return null;
  const e = Number(t[1]), i = Number(t[2]);
  return e > 23 || i > 59 ? null : e * 60 + i;
}
var ie = Object.defineProperty, re = Object.getOwnPropertyDescriptor, b = (s, t, e, i) => {
  for (var r = i > 1 ? void 0 : i ? re(t, e) : t, n = s.length - 1, o; n >= 0; n--)
    (o = s[n]) && (r = (i ? o(t, e, r) : o(r)) || r);
  return i && r && ie(t, e, r), r;
};
const J = 128, gt = 18, mt = 46, ne = 14, yt = 22, X = 26;
let g = class extends C {
  constructor() {
    super(...arguments), this.samples = [], this.keyframes = [], this.sun = {}, this.nowMinute = 0, this.selectedId = null, this.minKelvin = 2200, this.maxKelvin = 6500, this.scrubMinute = null, this.width = 900, this.dragging = null;
  }
  get plotWidth() {
    return Math.max(120, this.width - mt - ne);
  }
  plotFor(s) {
    return {
      left: mt,
      top: yt + (s === "brightness" ? 0 : s === "warmth" ? 1 : 2) * (J + gt + X),
      width: this.plotWidth,
      height: J
    };
  }
  get totalHeight() {
    return yt + 3 * (J + gt + X) + 10;
  }
  render() {
    const s = this.totalHeight;
    return y`
      <svg
        viewBox="0 0 ${this.width} ${s}"
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
  renderLane(s, t) {
    const e = this.plotFor(s), r = this.samples.filter((n) => this.laneApplies(s, n)).length === 0 && s !== "brightness";
    return u`
      <g>
        <text class="lane-title" x=${e.left} y=${e.top - 7}>${t}</text>
        <rect class="lane-bg" x=${e.left} y=${e.top}
              width=${e.width} height=${e.height} rx="6" />
        ${this.renderGrid(e, s)}
        ${this.renderGradientStrip(e, s)}
        ${this.renderCurve(e, s)}
        ${this.renderSunMarkers(e)}
        ${this.renderNow(e)}
        ${this.renderScrub(e)}
        ${this.renderHandles(e, s)}
        ${r ? u`
            <rect class="inactive-wash" x=${e.left} y=${e.top}
                  width=${e.width} height=${e.height} rx="6" />
            <text class="inactive-note" x=${e.left + e.width / 2}
                  y=${e.top + e.height / 2} text-anchor="middle">
              ${s === "warmth" ? "this curve has no colour-temperature section" : "this curve has no colour section"}
            </text>` : ""}
      </g>
    `;
  }
  /** Is this sample edited in this lane? Warmth and colour are mutually exclusive. */
  laneApplies(s, t) {
    return s === "brightness" ? t.brightness_pct !== null : s === "warmth" ? t.mode === "kelvin" : t.mode === "hs";
  }
  renderGrid(s, t) {
    const e = [];
    for (let r = 0; r <= 24; r += 3) {
      const n = w(r * 60, s);
      e.push(u`<line class="grid" x1=${n} y1=${s.top} x2=${n}
                          y2=${s.top + s.height} />`), t === "colour" && e.push(u`<text class="axis-label" x=${n} y=${s.top + s.height + 16}
                             text-anchor="middle">${String(r).padStart(2, "0")}</text>`);
    }
    const i = t === "brightness" ? [
      { value: 100, y: I(100, s), text: "100%" },
      { value: 50, y: I(50, s), text: "50%" },
      { value: 1, y: I(1, s), text: "1%" }
    ] : t === "warmth" ? [
      { value: this.maxKelvin, y: s.top, text: `${this.maxKelvin}K` },
      { value: this.minKelvin, y: s.top + s.height, text: `${this.minKelvin}K` }
    ] : [
      { value: 360, y: s.top, text: "360°" },
      { value: 0, y: s.top + s.height, text: "0°" }
    ];
    for (const r of i)
      e.push(u`<text class="axis-label" x=${s.left - 6} y=${r.y + 3}
                           text-anchor="end">${r.text}</text>`);
    return u`${e}`;
  }
  /** The gradient strip under each lane, drawn from the engine's own colours. */
  renderGradientStrip(s, t) {
    if (this.samples.length === 0) return u``;
    const e = s.top + s.height + (t === "colour" ? 22 : 6), i = this.samples.map((r, n) => {
      const o = this.samples[n + 1], a = w(r.minute, s), h = o ? w(o.minute, s) : s.left + s.width, c = r.rgb ?? [80, 80, 80], f = !this.laneApplies(t, r);
      return u`<rect x=${a} y=${e} width=${Math.max(1, h - a)}
                       height=${X - 10}
                       fill="rgb(${c[0]},${c[1]},${c[2]})"
                       opacity=${f ? 0.25 : 1} />`;
    });
    return u`<g>${i}</g>`;
  }
  renderCurve(s, t) {
    if (this.samples.length < 2) return u``;
    const e = [];
    for (const i of this.samples) {
      const r = this.laneApplies(t, i), n = this.valueY(s, t, i);
      if (n === null) continue;
      const o = `${w(i.minute, s).toFixed(1)},${n.toFixed(1)}`, a = e[e.length - 1];
      a && a.active === r ? a.points.push(o) : e.push({ active: r, points: [o] });
    }
    return u`${e.filter((i) => i.points.length > 1).map(
      (i) => u`<polyline class="curve ${i.active ? "" : "muted"}"
                        points=${i.points.join(" ")} />`
    )}`;
  }
  valueY(s, t, e) {
    if (t === "brightness")
      return e.brightness_pct === null ? null : I(e.brightness_pct, s);
    if (t === "warmth") {
      const r = e.kelvin ?? this.minKelvin;
      return $t(r, s, this.minKelvin, this.maxKelvin);
    }
    const i = e.hs ? e.hs[0] : 0;
    return s.top + (1 - i / 360) * s.height;
  }
  renderSunMarkers(s) {
    return u`${Object.entries(this.sun).map(([t, e]) => {
      if (!e) return u``;
      const i = w(e.minute, s);
      return u`<line class="sun" x1=${i} y1=${s.top} x2=${i}
                       y2=${s.top + s.height}>
                   <title>${t} ${H(e.minute)}</title>
                 </line>`;
    })}`;
  }
  renderNow(s) {
    const t = w(this.nowMinute, s);
    return u`<line class="now" x1=${t} y1=${s.top} x2=${t}
                     y2=${s.top + s.height} />`;
  }
  renderScrub(s) {
    if (this.scrubMinute === null) return u``;
    const t = w(this.scrubMinute, s);
    return u`<line class="scrub" x1=${t} y1=${s.top} x2=${t}
                     y2=${s.top + s.height} />`;
  }
  handlesFor(s, t) {
    return this.keyframes.filter((e) => this.keyframeInLane(t, e)).map((e) => ({
      id: e.id,
      x: w(e.minute, s),
      y: this.keyframeY(s, t, e)
    }));
  }
  keyframeInLane(s, t) {
    return s === "brightness" ? !0 : s === "warmth" ? t.mode === "kelvin" : t.mode === "hs";
  }
  keyframeY(s, t, e) {
    if (t === "brightness") return I(e.brightness_pct, s);
    if (t === "warmth")
      return $t(e.kelvin ?? this.minKelvin, s, this.minKelvin, this.maxKelvin);
    const i = e.hs ? e.hs[0] : 0;
    return s.top + (1 - i / 360) * s.height;
  }
  renderHandles(s, t) {
    return u`${this.handlesFor(s, t).map((e) => {
      const i = this.keyframes.find((n) => n.id === e.id), r = i.mode === "kelvin" ? "var(--primary-color, #03a9f4)" : `hsl(${i.hs?.[0] ?? 0}, ${i.hs?.[1] ?? 100}%, 55%)`;
      return u`
        <g>
          <circle class="hit" cx=${e.x} cy=${e.y} r="22"
                  data-id=${e.id} data-lane=${t} />
          <circle class="handle ${this.selectedId === e.id ? "selected" : ""}"
                  cx=${e.x} cy=${e.y} r="6" fill=${r}
                  data-id=${e.id} data-lane=${t}>
            <title>${i.id} · ${H(i.minute)}</title>
          </circle>
        </g>`;
    })}`;
  }
  // --- interaction ----------------------------------------------------------
  localPoint(s) {
    const e = this.renderRoot.querySelector("svg").getBoundingClientRect(), i = this.width / e.width;
    return {
      x: (s.clientX - e.left) * i,
      y: (s.clientY - e.top) * i
    };
  }
  laneAt(s) {
    for (const t of ["brightness", "warmth", "colour"]) {
      const e = this.plotFor(t);
      if (s >= e.top - 10 && s <= e.top + e.height + 10) return t;
    }
    return null;
  }
  onPointerDown(s) {
    const t = this.localPoint(s), e = this.laneAt(t.y);
    if (!e) return;
    const i = this.plotFor(e), r = ee(t.x, t.y, this.handlesFor(i, e));
    if (r) {
      this.dragging = { id: r, lane: e }, this.selectedId = r, s.target.setPointerCapture?.(s.pointerId), this.dispatchEvent(
        new CustomEvent("keyframe-select", { detail: { id: r }, bubbles: !0, composed: !0 })
      );
      return;
    }
    this.dispatchEvent(
      new CustomEvent("scrub", {
        detail: { minute: vt(t.x, i) },
        bubbles: !0,
        composed: !0
      })
    );
  }
  onPointerMove(s) {
    if (!this.dragging) return;
    const t = this.localPoint(s), e = this.plotFor(this.dragging.lane), i = Object.entries(this.sun).filter(([, o]) => o).map(([o, a]) => ({ event: o, minute: a.minute })), r = te(vt(t.x, e), i), n = {
      id: this.dragging.id,
      minute: r.minute,
      sunEvent: r.event
    };
    if (this.dragging.lane === "brightness")
      n.brightness = Xt(t.y, e);
    else if (this.dragging.lane === "warmth")
      n.kelvin = Zt(t.y, e, this.minKelvin, this.maxKelvin);
    else {
      const o = 1 - (t.y - e.top) / e.height;
      n.hue = Math.round(Math.min(360, Math.max(0, o * 360)));
    }
    this.dispatchEvent(
      new CustomEvent("keyframe-move", { detail: n, bubbles: !0, composed: !0 })
    );
  }
  onPointerUp() {
    this.dragging ? (this.dragging = null, this.dispatchEvent(new CustomEvent("keyframe-commit", { bubbles: !0, composed: !0 }))) : this.dispatchEvent(new CustomEvent("scrub-end", { bubbles: !0, composed: !0 }));
  }
};
g.styles = _t`
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
b([
  m({ attribute: !1 })
], g.prototype, "samples", 2);
b([
  m({ attribute: !1 })
], g.prototype, "keyframes", 2);
b([
  m({ attribute: !1 })
], g.prototype, "sun", 2);
b([
  m({ type: Number })
], g.prototype, "nowMinute", 2);
b([
  m({ type: String })
], g.prototype, "selectedId", 2);
b([
  m({ type: Number })
], g.prototype, "minKelvin", 2);
b([
  m({ type: Number })
], g.prototype, "maxKelvin", 2);
b([
  m({ type: Number })
], g.prototype, "scrubMinute", 2);
b([
  m({ type: Number })
], g.prototype, "width", 2);
b([
  $()
], g.prototype, "dragging", 2);
g = b([
  kt("lightcurve-curve-graph")
], g);
var oe = Object.defineProperty, ae = Object.getOwnPropertyDescriptor, v = (s, t, e, i) => {
  for (var r = i > 1 ? void 0 : i ? ae(t, e) : t, n = s.length - 1, o; n >= 0; n--)
    (o = s[n]) && (r = (i ? o(t, e, r) : o(r)) || r);
  return i && r && oe(t, e, r), r;
};
const he = 300;
let p = class extends C {
  constructor() {
    super(...arguments), this.narrow = !1, this.profiles = [], this.groups = [], this.profile = null, this.variant = "default", this.samples = [], this.resolved = [], this.sun = {}, this.issues = [], this.selectedId = null, this.previewGroupId = null, this.scrubMinute = null, this.dirty = !1, this.busy = !1, this.error = null, this.graphWidth = 900, this.lastScrubAt = 0, this.onKeyframeMove = (s) => {
      const { id: t, minute: e, sunEvent: i, brightness: r, kelvin: n, hue: o } = s.detail;
      this.mutate(t, (a) => {
        if (i ? a.time = { type: "sun", event: i, offset_min: 0 } : a.time = { type: "fixed", value: H(e) }, r !== void 0 && (a.brightness = r), n !== void 0 && (a.colour = { mode: "kelvin", kelvin: n }), o !== void 0) {
          const h = a.colour.hs?.[1] ?? 100;
          a.colour = { mode: "hs", hs: [o, h] };
        }
      });
    }, this.onKeyframeCommit = () => {
      this.refreshGraph();
    }, this.onSelect = (s) => {
      this.selectedId = s.detail.id;
    }, this.onScrub = (s) => {
      this.scrubMinute = s.detail.minute;
      const t = Date.now();
      t - this.lastScrubAt < he || (this.lastScrubAt = t, this.previewAt(s.detail.minute));
    }, this.onScrubEnd = () => {
      this.scrubMinute = null, this.stopPreview();
    };
  }
  connectedCallback() {
    super.connectedCallback(), this.resizeObserver = new ResizeObserver((s) => {
      const t = s[0]?.contentRect.width ?? 900;
      this.graphWidth = Math.max(320, Math.round(t - 32));
    }), this.resizeObserver.observe(this), this.load();
  }
  disconnectedCallback() {
    this.resizeObserver?.disconnect(), this.previewGroupId && this.stopPreview(), super.disconnectedCallback();
  }
  async send(s) {
    return this.hass.connection.sendMessagePromise(s);
  }
  async load() {
    this.busy = !0, this.error = null;
    try {
      const [s, t, e] = await Promise.all([
        this.send({ type: "lightcurve/profiles/list" }),
        this.send({ type: "lightcurve/groups/list" }),
        this.send({ type: "lightcurve/sun" })
      ]);
      this.profiles = s.profiles, this.groups = t.groups, this.sun = e.events, this.previewGroupId ??= this.groups[0]?.id ?? null, this.profiles.length > 0 && await this.openProfile(this.profiles[0].id);
    } catch (s) {
      this.error = z(s);
    } finally {
      this.busy = !1;
    }
  }
  async openProfile(s) {
    const t = await this.send({
      type: "lightcurve/profiles/get",
      profile_id: s
    });
    this.profile = t.profile, this.variant = Object.keys(t.profile.variants)[0] ?? "default", this.dirty = !1, this.selectedId = null, await this.refreshGraph();
  }
  /** Redraw from the server so the curve shown is the engine's, not an approximation. */
  async refreshGraph() {
    if (this.profile)
      try {
        const [s, t] = await Promise.all([
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
        this.samples = s.samples, this.resolved = s.keyframes, this.issues = t.issues;
      } catch (s) {
        this.error = z(s);
      }
  }
  get keyframes() {
    return this.profile?.variants[this.variant]?.keyframes ?? [];
  }
  get selected() {
    return this.keyframes.find((s) => s.id === this.selectedId);
  }
  get blocked() {
    return this.issues.some((s) => s.level === "error");
  }
  // --- editing --------------------------------------------------------------
  mutate(s, t) {
    if (!this.profile) return;
    const e = this.keyframes.map((i) => {
      if (i.id !== s) return i;
      const r = JSON.parse(JSON.stringify(i));
      return t(r), r;
    });
    this.profile = {
      ...this.profile,
      variants: { ...this.profile.variants, [this.variant]: { keyframes: e } }
    }, this.dirty = !0;
  }
  async previewAt(s) {
    if (!(!this.previewGroupId || !this.profile))
      try {
        await this.send({
          type: "lightcurve/preview/start",
          group_id: this.previewGroupId,
          minute: s,
          profile_id: this.profile.id,
          variant: this.variant
        });
      } catch (t) {
        this.error = z(t);
      }
  }
  async stopPreview() {
    if (this.previewGroupId)
      try {
        await this.send({ type: "lightcurve/preview/stop", group_id: this.previewGroupId });
      } catch {
      }
  }
  async save() {
    if (!(!this.profile || this.blocked)) {
      this.busy = !0, this.error = null;
      try {
        await this.send({ type: "lightcurve/profiles/save", profile: this.profile }), this.dirty = !1, await this.refreshGraph();
      } catch (s) {
        this.error = z(s);
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
    const s = this.scrubMinute ?? 720, t = `k_${Math.random().toString(36).slice(2, 8)}`, e = [
      ...this.keyframes,
      {
        id: t,
        time: { type: "fixed", value: H(s) },
        colour: { mode: "kelvin", kelvin: 3e3 },
        brightness: 50,
        easing: "ease_in_out"
      }
    ];
    this.profile = {
      ...this.profile,
      variants: { ...this.profile.variants, [this.variant]: { keyframes: e } }
    }, this.selectedId = t, this.dirty = !0, this.refreshGraph();
  }
  deleteSelected() {
    if (!this.profile || !this.selectedId) return;
    const s = this.keyframes.filter((t) => t.id !== this.selectedId);
    this.profile = {
      ...this.profile,
      variants: { ...this.profile.variants, [this.variant]: { keyframes: s } }
    }, this.selectedId = null, this.dirty = !0, this.refreshGraph();
  }
  // --- rendering ------------------------------------------------------------
  render() {
    const s = this.groups.find((t) => t.id === this.previewGroupId);
    return y`
      ${this.error ? y`<div class="error-banner">${this.error}</div>` : d}
      <div class="bar">
        <div>
          <label for="profile">Profile</label>
          <select id="profile" @change=${(t) => void this.openProfile(t.target.value)}>
            ${this.profiles.map(
      (t) => y`<option value=${t.id} ?selected=${t.id === this.profile?.id}>
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
      (t) => y`<option value=${t.id} ?selected=${t.id === this.previewGroupId}>
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
          .nowMinute=${le()}
          @keyframe-move=${this.onKeyframeMove}
          @keyframe-commit=${this.onKeyframeCommit}
          @keyframe-select=${this.onSelect}
          @scrub=${this.onScrub}
          @scrub-end=${this.onScrubEnd}
        ></lightcurve-curve-graph>
        <p class="hint">
          Drag a handle to move a keyframe. Drop one near a sun marker to make it
          follow that event. Drag anywhere else to preview that time of day on
          ${s ? s.name : "the selected room"}.
        </p>
      </div>

      ${this.issues.length > 0 ? y`<div class="card">
            <ul class="issues">
              ${this.issues.map(
      (t) => y`<li class=${t.level}>${t.message}</li>`
    )}
            </ul>
          </div>` : d}

      ${this.selected ? this.renderSheet(this.selected) : d}
    `;
  }
  renderSheet(s) {
    return y`
      <div class="sheet">
        <div class="row">
          <div>
            <label for="time">Time</label>
            ${s.time.type === "sun" ? y`<input id="time" .value=${`${s.time.event} ${s.time.offset_min ?? 0}m`} readonly />` : y`<input
                  id="time"
                  .value=${s.time.value ?? "00:00"}
                  @change=${(t) => {
      const e = se(t.target.value);
      e !== null && (this.mutate(s.id, (i) => {
        i.time = { type: "fixed", value: H(e) };
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
              .value=${String(s.brightness)}
              @change=${(t) => {
      this.mutate(s.id, (e) => {
        e.brightness = Number(t.target.value);
      }), this.refreshGraph();
    }}
            />
          </div>
          <div>
            <label for="mode">Colour</label>
            <select
              id="mode"
              @change=${(t) => {
      const e = t.target.value;
      this.mutate(s.id, (i) => {
        i.colour = e === "kelvin" ? { mode: "kelvin", kelvin: 3e3 } : { mode: "hs", hs: [0, 100] };
      }), this.refreshGraph();
    }}
            >
              <option value="kelvin" ?selected=${s.colour.mode === "kelvin"}>
                Colour temperature
              </option>
              <option value="hs" ?selected=${s.colour.mode === "hs"}>
                Colour
              </option>
            </select>
          </div>
          <div>
            <label for="easing">Easing</label>
            <select
              id="easing"
              @change=${(t) => {
      this.mutate(s.id, (e) => {
        e.easing = t.target.value;
      }), this.refreshGraph();
    }}
            >
              ${["linear", "ease_in_out", "step"].map(
      (t) => y`<option value=${t} ?selected=${s.easing === t}>
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
p.styles = _t`
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
v([
  m({ attribute: !1 })
], p.prototype, "hass", 2);
v([
  m({ type: Boolean })
], p.prototype, "narrow", 2);
v([
  $()
], p.prototype, "profiles", 2);
v([
  $()
], p.prototype, "groups", 2);
v([
  $()
], p.prototype, "profile", 2);
v([
  $()
], p.prototype, "variant", 2);
v([
  $()
], p.prototype, "samples", 2);
v([
  $()
], p.prototype, "resolved", 2);
v([
  $()
], p.prototype, "sun", 2);
v([
  $()
], p.prototype, "issues", 2);
v([
  $()
], p.prototype, "selectedId", 2);
v([
  $()
], p.prototype, "previewGroupId", 2);
v([
  $()
], p.prototype, "scrubMinute", 2);
v([
  $()
], p.prototype, "dirty", 2);
v([
  $()
], p.prototype, "busy", 2);
v([
  $()
], p.prototype, "error", 2);
v([
  $()
], p.prototype, "graphWidth", 2);
p = v([
  kt("lightcurve-panel")
], p);
function le() {
  const s = /* @__PURE__ */ new Date();
  return s.getHours() * 60 + s.getMinutes();
}
function z(s) {
  return s && typeof s == "object" && "message" in s ? String(s.message) : String(s);
}
export {
  p as LightcurvePanel
};
