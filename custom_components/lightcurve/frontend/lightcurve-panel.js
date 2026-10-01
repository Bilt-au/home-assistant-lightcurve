/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const X = globalThis, dt = X.ShadowRoot && (X.ShadyCSS === void 0 || X.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, ut = Symbol(), bt = /* @__PURE__ */ new WeakMap();
let Ht = class {
  constructor(t, i, s) {
    if (this._$cssResult$ = !0, s !== ut) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = i;
  }
  get styleSheet() {
    let t = this.o;
    const i = this.t;
    if (dt && t === void 0) {
      const s = i !== void 0 && i.length === 1;
      s && (t = bt.get(i)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), s && bt.set(i, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const Wt = (e) => new Ht(typeof e == "string" ? e : e + "", void 0, ut), pt = (e, ...t) => {
  const i = e.length === 1 ? e[0] : t.reduce((s, r, n) => s + ((o) => {
    if (o._$cssResult$ === !0) return o.cssText;
    if (typeof o == "number") return o;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + o + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(r) + e[n + 1], e[0]);
  return new Ht(i, e, ut);
}, Ft = (e, t) => {
  if (dt) e.adoptedStyleSheets = t.map((i) => i instanceof CSSStyleSheet ? i : i.styleSheet);
  else for (const i of t) {
    const s = document.createElement("style"), r = X.litNonce;
    r !== void 0 && s.setAttribute("nonce", r), s.textContent = i.cssText, e.appendChild(s);
  }
}, yt = dt ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((t) => {
  let i = "";
  for (const s of t.cssRules) i += s.cssText;
  return Wt(i);
})(e) : e;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: Jt, defineProperty: Vt, getOwnPropertyDescriptor: qt, getOwnPropertyNames: Yt, getOwnPropertySymbols: Xt, getPrototypeOf: Zt } = Object, st = globalThis, xt = st.trustedTypes, Qt = xt ? xt.emptyScript : "", te = st.reactiveElementPolyfillSupport, L = (e, t) => e, tt = { toAttribute(e, t) {
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
} }, ft = (e, t) => !Jt(e, t), wt = { attribute: !0, type: String, converter: tt, reflect: !1, useDefault: !1, hasChanged: ft };
Symbol.metadata ??= Symbol("metadata"), st.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
let I = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ??= []).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, i = wt) {
    if (i.state && (i.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((i = Object.create(i)).wrapped = !0), this.elementProperties.set(t, i), !i.noAccessor) {
      const s = Symbol(), r = this.getPropertyDescriptor(t, s, i);
      r !== void 0 && Vt(this.prototype, t, r);
    }
  }
  static getPropertyDescriptor(t, i, s) {
    const { get: r, set: n } = qt(this.prototype, t) ?? { get() {
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
    return this.elementProperties.get(t) ?? wt;
  }
  static _$Ei() {
    if (this.hasOwnProperty(L("elementProperties"))) return;
    const t = Zt(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(L("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(L("properties"))) {
      const i = this.properties, s = [...Yt(i), ...Xt(i)];
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
      for (const r of s) i.unshift(yt(r));
    } else t !== void 0 && i.push(yt(t));
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
    return Ft(t, this.constructor.elementStyles), t;
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
      const n = (s.converter?.toAttribute !== void 0 ? s.converter : tt).toAttribute(i, s.type);
      this._$Em = t, n == null ? this.removeAttribute(r) : this.setAttribute(r, n), this._$Em = null;
    }
  }
  _$AK(t, i) {
    const s = this.constructor, r = s._$Eh.get(t);
    if (r !== void 0 && this._$Em !== r) {
      const n = s.getPropertyOptions(r), o = typeof n.converter == "function" ? { fromAttribute: n.converter } : n.converter?.fromAttribute !== void 0 ? n.converter : tt;
      this._$Em = r;
      const a = o.fromAttribute(i, n.type);
      this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
    }
  }
  requestUpdate(t, i, s, r = !1, n) {
    if (t !== void 0) {
      const o = this.constructor;
      if (r === !1 && (n = this[t]), s ??= o.getPropertyOptions(t), !((s.hasChanged ?? ft)(n, i) || s.useDefault && s.reflect && n === this._$Ej?.get(t) && !this.hasAttribute(o._$Eu(t, s)))) return;
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
I.elementStyles = [], I.shadowRootOptions = { mode: "open" }, I[L("elementProperties")] = /* @__PURE__ */ new Map(), I[L("finalized")] = /* @__PURE__ */ new Map(), te?.({ ReactiveElement: I }), (st.reactiveElementVersions ??= []).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const mt = globalThis, _t = (e) => e, et = mt.trustedTypes, At = et ? et.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, Dt = "$lit$", T = `lit$${Math.random().toFixed(9).slice(2)}$`, zt = "?" + T, ee = `<${zt}>`, N = document, j = () => N.createComment(""), B = (e) => e === null || typeof e != "object" && typeof e != "function", gt = Array.isArray, ie = (e) => gt(e) || typeof e?.[Symbol.iterator] == "function", lt = `[ 	
\f\r]`, K = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, St = /-->/g, Mt = />/g, E = RegExp(`>|${lt}(?:([^\\s"'>=/]+)(${lt}*=${lt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), kt = /'/g, Tt = /"/g, Gt = /^(?:script|style|textarea|title)$/i, Kt = (e) => (t, ...i) => ({ _$litType$: e, strings: t, values: i }), c = Kt(1), m = Kt(2), H = Symbol.for("lit-noChange"), p = Symbol.for("lit-nothing"), Et = /* @__PURE__ */ new WeakMap(), P = N.createTreeWalker(N, 129);
function Lt(e, t) {
  if (!gt(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return At !== void 0 ? At.createHTML(t) : t;
}
const se = (e, t) => {
  const i = e.length - 1, s = [];
  let r, n = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = K;
  for (let a = 0; a < i; a++) {
    const l = e[a];
    let h, f, d = -1, A = 0;
    for (; A < l.length && (o.lastIndex = A, f = o.exec(l), f !== null); ) A = o.lastIndex, o === K ? f[1] === "!--" ? o = St : f[1] !== void 0 ? o = Mt : f[2] !== void 0 ? (Gt.test(f[2]) && (r = RegExp("</" + f[2], "g")), o = E) : f[3] !== void 0 && (o = E) : o === E ? f[0] === ">" ? (o = r ?? K, d = -1) : f[1] === void 0 ? d = -2 : (d = o.lastIndex - f[2].length, h = f[1], o = f[3] === void 0 ? E : f[3] === '"' ? Tt : kt) : o === Tt || o === kt ? o = E : o === St || o === Mt ? o = K : (o = E, r = void 0);
    const x = o === E && e[a + 1].startsWith("/>") ? " " : "";
    n += o === K ? l + ee : d >= 0 ? (s.push(h), l.slice(0, d) + Dt + l.slice(d) + T + x) : l + T + (d === -2 ? a : x);
  }
  return [Lt(e, n + (e[i] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), s];
};
class W {
  constructor({ strings: t, _$litType$: i }, s) {
    let r;
    this.parts = [];
    let n = 0, o = 0;
    const a = t.length - 1, l = this.parts, [h, f] = se(t, i);
    if (this.el = W.createElement(h, s), P.currentNode = this.el.content, i === 2 || i === 3) {
      const d = this.el.content.firstChild;
      d.replaceWith(...d.childNodes);
    }
    for (; (r = P.nextNode()) !== null && l.length < a; ) {
      if (r.nodeType === 1) {
        if (r.hasAttributes()) for (const d of r.getAttributeNames()) if (d.endsWith(Dt)) {
          const A = f[o++], x = r.getAttribute(d).split(T), u = /([.?@])?(.*)/.exec(A);
          l.push({ type: 1, index: n, name: u[2], strings: x, ctor: u[1] === "." ? ne : u[1] === "?" ? oe : u[1] === "@" ? ae : rt }), r.removeAttribute(d);
        } else d.startsWith(T) && (l.push({ type: 6, index: n }), r.removeAttribute(d));
        if (Gt.test(r.tagName)) {
          const d = r.textContent.split(T), A = d.length - 1;
          if (A > 0) {
            r.textContent = et ? et.emptyScript : "";
            for (let x = 0; x < A; x++) r.append(d[x], j()), P.nextNode(), l.push({ type: 2, index: ++n });
            r.append(d[A], j());
          }
        }
      } else if (r.nodeType === 8) if (r.data === zt) l.push({ type: 2, index: n });
      else {
        let d = -1;
        for (; (d = r.data.indexOf(T, d + 1)) !== -1; ) l.push({ type: 7, index: n }), d += T.length - 1;
      }
      n++;
    }
  }
  static createElement(t, i) {
    const s = N.createElement("template");
    return s.innerHTML = t, s;
  }
}
function D(e, t, i = e, s) {
  if (t === H) return t;
  let r = s !== void 0 ? i._$Co?.[s] : i._$Cl;
  const n = B(t) ? void 0 : t._$litDirective$;
  return r?.constructor !== n && (r?._$AO?.(!1), n === void 0 ? r = void 0 : (r = new n(e), r._$AT(e, i, s)), s !== void 0 ? (i._$Co ??= [])[s] = r : i._$Cl = r), r !== void 0 && (t = D(e, r._$AS(e, t.values), r, s)), t;
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
    const { el: { content: i }, parts: s } = this._$AD, r = (t?.creationScope ?? N).importNode(i, !0);
    P.currentNode = r;
    let n = P.nextNode(), o = 0, a = 0, l = s[0];
    for (; l !== void 0; ) {
      if (o === l.index) {
        let h;
        l.type === 2 ? h = new F(n, n.nextSibling, this, t) : l.type === 1 ? h = new l.ctor(n, l.name, l.strings, this, t) : l.type === 6 && (h = new le(n, this, t)), this._$AV.push(h), l = s[++a];
      }
      o !== l?.index && (n = P.nextNode(), o++);
    }
    return P.currentNode = N, r;
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
    this.type = 2, this._$AH = p, this._$AN = void 0, this._$AA = t, this._$AB = i, this._$AM = s, this.options = r, this._$Cv = r?.isConnected ?? !0;
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
    t = D(this, t, i), B(t) ? t === p || t == null || t === "" ? (this._$AH !== p && this._$AR(), this._$AH = p) : t !== this._$AH && t !== H && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : ie(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== p && B(this._$AH) ? this._$AA.nextSibling.data = t : this.T(N.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    const { values: i, _$litType$: s } = t, r = typeof s == "number" ? this._$AC(t) : (s.el === void 0 && (s.el = W.createElement(Lt(s.h, s.h[0]), this.options)), s);
    if (this._$AH?._$AD === r) this._$AH.p(i);
    else {
      const n = new re(r, this), o = n.u(this.options);
      n.p(i), this.T(o), this._$AH = n;
    }
  }
  _$AC(t) {
    let i = Et.get(t.strings);
    return i === void 0 && Et.set(t.strings, i = new W(t)), i;
  }
  k(t) {
    gt(this._$AH) || (this._$AH = [], this._$AR());
    const i = this._$AH;
    let s, r = 0;
    for (const n of t) r === i.length ? i.push(s = new F(this.O(j()), this.O(j()), this, this.options)) : s = i[r], s._$AI(n), r++;
    r < i.length && (this._$AR(s && s._$AB.nextSibling, r), i.length = r);
  }
  _$AR(t = this._$AA.nextSibling, i) {
    for (this._$AP?.(!1, !0, i); t !== this._$AB; ) {
      const s = _t(t).nextSibling;
      _t(t).remove(), t = s;
    }
  }
  setConnected(t) {
    this._$AM === void 0 && (this._$Cv = t, this._$AP?.(t));
  }
}
class rt {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, i, s, r, n) {
    this.type = 1, this._$AH = p, this._$AN = void 0, this.element = t, this.name = i, this._$AM = r, this.options = n, s.length > 2 || s[0] !== "" || s[1] !== "" ? (this._$AH = Array(s.length - 1).fill(new String()), this.strings = s) : this._$AH = p;
  }
  _$AI(t, i = this, s, r) {
    const n = this.strings;
    let o = !1;
    if (n === void 0) t = D(this, t, i, 0), o = !B(t) || t !== this._$AH && t !== H, o && (this._$AH = t);
    else {
      const a = t;
      let l, h;
      for (t = n[0], l = 0; l < n.length - 1; l++) h = D(this, a[s + l], i, l), h === H && (h = this._$AH[l]), o ||= !B(h) || h !== this._$AH[l], h === p ? t = p : t !== p && (t += (h ?? "") + n[l + 1]), this._$AH[l] = h;
    }
    o && !r && this.j(t);
  }
  j(t) {
    t === p ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}
class ne extends rt {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === p ? void 0 : t;
  }
}
class oe extends rt {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== p);
  }
}
class ae extends rt {
  constructor(t, i, s, r, n) {
    super(t, i, s, r, n), this.type = 5;
  }
  _$AI(t, i = this) {
    if ((t = D(this, t, i, 0) ?? p) === H) return;
    const s = this._$AH, r = t === p && s !== p || t.capture !== s.capture || t.once !== s.once || t.passive !== s.passive, n = t !== p && (s === p || r);
    r && this.element.removeEventListener(this.name, this, s), n && this.element.addEventListener(this.name, this, t), this._$AH = t;
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
    D(this, t);
  }
}
const he = mt.litHtmlPolyfillSupport;
he?.(W, F), (mt.litHtmlVersions ??= []).push("3.3.3");
const ce = (e, t, i) => {
  const s = i?.renderBefore ?? t;
  let r = s._$litPart$;
  if (r === void 0) {
    const n = i?.renderBefore ?? null;
    s._$litPart$ = r = new F(t.insertBefore(j(), n), n, void 0, i ?? {});
  }
  return r._$AI(e), r;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const vt = globalThis;
class C extends I {
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
C._$litElement$ = !0, C.finalized = !0, vt.litElementHydrateSupport?.({ LitElement: C });
const de = vt.litElementPolyfillSupport;
de?.({ LitElement: C });
(vt.litElementVersions ??= []).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const $t = (e) => (t, i) => {
  i !== void 0 ? i.addInitializer(() => {
    customElements.define(e, t);
  }) : customElements.define(e, t);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ue = { attribute: !0, type: String, converter: tt, reflect: !1, hasChanged: ft }, pe = (e = ue, t, i) => {
  const { kind: s, metadata: r } = i;
  let n = globalThis.litPropertyMetadata.get(r);
  if (n === void 0 && globalThis.litPropertyMetadata.set(r, n = /* @__PURE__ */ new Map()), s === "setter" && ((e = Object.create(e)).wrapped = !0), n.set(i.name, e), s === "accessor") {
    const { name: o } = i;
    return { set(a) {
      const l = t.get.call(this);
      t.set.call(this, a), this.requestUpdate(o, l, e, !0, a);
    }, init(a) {
      return a !== void 0 && this.C(o, void 0, e, a), a;
    } };
  }
  if (s === "setter") {
    const { name: o } = i;
    return function(a) {
      const l = this[o];
      t.call(this, a), this.requestUpdate(o, l, e, !0, a);
    };
  }
  throw Error("Unsupported decorator location: " + s);
};
function b(e) {
  return (t, i) => typeof i == "object" ? pe(e, t, i) : ((s, r, n) => {
    const o = r.hasOwnProperty(n);
    return r.constructor.createProperty(n, s), o ? Object.getOwnPropertyDescriptor(r, n) : void 0;
  })(e, t, i);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function $(e) {
  return b({ ...e, state: !0, attribute: !1 });
}
const M = 1440;
function S(e, t) {
  return t.left + e / M * t.width;
}
function Pt(e, t) {
  const i = (e - t.left) / t.width;
  return nt(Math.round(i * M), 0, M - 1);
}
function q(e, t) {
  return t.top + (1 - e / 100) * t.height;
}
function fe(e, t) {
  const i = 1 - (e - t.top) / t.height;
  return nt(Math.round(i * 100), 1, 100);
}
function me(e, t, i, s) {
  const r = 1e6 / e, n = 1e6 / s, o = 1e6 / i, a = (r - n) / (o - n);
  return t.top + nt(a, 0, 1) * t.height;
}
function ge(e, t, i, s) {
  const r = nt((e - t.top) / t.height, 0, 1), n = 1e6 / s, o = 1e6 / i;
  return Math.round(1e6 / (n + r * (o - n)));
}
function nt(e, t, i) {
  return Math.min(i, Math.max(t, e));
}
function R(e) {
  const t = (e % M + M) % M, i = Math.floor(t / 60), s = t % 60;
  return `${String(i).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function Ct(e) {
  const t = /^(\d{1,2}):(\d{2})$/.exec(e.trim());
  if (!t) return null;
  const i = Number(t[1]), s = Number(t[2]);
  return i > 23 || s > 59 ? null : i * 60 + s;
}
var ve = Object.defineProperty, $e = Object.getOwnPropertyDescriptor, _ = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? $e(t, i) : t, n = e.length - 1, o; n >= 0; n--)
    (o = e[n]) && (r = (s ? o(t, i, r) : o(r)) || r);
  return s && r && ve(t, i, r), r;
};
const ht = 128, Nt = 18, Y = 46, be = 14, Ot = 22, ct = 26, O = 34;
let y = class extends C {
  constructor() {
    super(...arguments), this.samples = [], this.keyframes = [], this.sun = {}, this.nowMinute = 0, this.selectedId = null, this.minKelvin = 2200, this.maxKelvin = 6500, this.scrubMinute = null, this.width = 900, this.painting = null, this.scrubbing = !1;
  }
  get plotWidth() {
    return Math.max(120, this.width - Y - be);
  }
  plotFor(e) {
    return {
      left: Y,
      top: Ot + (e === "brightness" ? 0 : e === "warmth" ? 1 : 2) * (ht + Nt + ct),
      width: this.plotWidth,
      height: ht
    };
  }
  get lanesHeight() {
    return Ot + 3 * (ht + Nt + ct);
  }
  get scrubTop() {
    return this.lanesHeight + 6;
  }
  get totalHeight() {
    return this.scrubTop + O + 8;
  }
  render() {
    const e = this.totalHeight;
    return c`
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
      left: Y,
      top: this.scrubTop,
      width: this.plotWidth,
      height: O
    }, t = this.scrubMinute === null ? null : S(this.scrubMinute, e);
    return m`
      <g>
        <rect class="scrub-bar" x=${e.left} y=${e.top}
              width=${e.width} height=${e.height} rx=${O / 2} />
        ${this.samples.map((i, s) => {
      const r = this.samples[s + 1], n = S(i.minute, e), o = r ? S(r.minute, e) : e.left + e.width, a = i.rgb ?? [80, 80, 80];
      return m`<rect x=${n} y=${e.top + 7}
                           width=${Math.max(1, o - n)} height=${O - 14}
                           fill="rgb(${a[0]},${a[1]},${a[2]})" />`;
    })}
        <text class="axis-label" x=${e.left - 6} y=${e.top + O / 2 + 3}
              text-anchor="end">preview</text>
        ${t === null ? "" : m`<circle class="scrub-handle" cx=${t}
                        cy=${e.top + O / 2} r="9" />`}
      </g>
    `;
  }
  renderLane(e, t) {
    const i = this.plotFor(e), r = this.samples.filter((n) => this.laneApplies(e, n)).length === 0 && e !== "brightness";
    return m`
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
        ${this.renderKeyframeTicks(i, e)}
        ${r ? m`
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
      const n = S(r * 60, e);
      i.push(m`<line class="grid" x1=${n} y1=${e.top} x2=${n}
                          y2=${e.top + e.height} />`), t === "colour" && i.push(m`<text class="axis-label" x=${n} y=${e.top + e.height + 16}
                             text-anchor="middle">${String(r).padStart(2, "0")}</text>`);
    }
    const s = t === "brightness" ? [
      { value: 100, y: q(100, e), text: "100%" },
      { value: 50, y: q(50, e), text: "50%" },
      { value: 1, y: q(1, e), text: "1%" }
    ] : t === "warmth" ? [
      { value: this.maxKelvin, y: e.top, text: `${this.maxKelvin}K` },
      { value: this.minKelvin, y: e.top + e.height, text: `${this.minKelvin}K` }
    ] : [
      { value: 360, y: e.top, text: "360°" },
      { value: 0, y: e.top + e.height, text: "0°" }
    ];
    for (const r of s)
      i.push(m`<text class="axis-label" x=${e.left - 6} y=${r.y + 3}
                           text-anchor="end">${r.text}</text>`);
    return m`${i}`;
  }
  /** The gradient strip under each lane, drawn from the engine's own colours. */
  renderGradientStrip(e, t) {
    if (this.samples.length === 0) return m``;
    const i = e.top + e.height + (t === "colour" ? 22 : 6), s = this.samples.map((r, n) => {
      const o = this.samples[n + 1], a = S(r.minute, e), l = o ? S(o.minute, e) : e.left + e.width, h = r.rgb ?? [80, 80, 80], f = !this.laneApplies(t, r);
      return m`<rect x=${a} y=${i} width=${Math.max(1, l - a)}
                       height=${ct - 10}
                       fill="rgb(${h[0]},${h[1]},${h[2]})"
                       opacity=${f ? 0.25 : 1} />`;
    });
    return m`<g>${s}</g>`;
  }
  renderCurve(e, t) {
    if (this.samples.length < 2) return m``;
    const i = [];
    for (const s of this.samples) {
      const r = this.laneApplies(t, s), n = this.valueY(e, t, s);
      if (n === null) continue;
      const o = `${S(s.minute, e).toFixed(1)},${n.toFixed(1)}`, a = i[i.length - 1];
      a && a.active === r ? a.points.push(o) : i.push({ active: r, points: [o] });
    }
    return m`${i.filter((s) => s.points.length > 1).map(
      (s) => m`<polyline class="curve ${s.active ? "" : "muted"}"
                        points=${s.points.join(" ")} />`
    )}`;
  }
  valueY(e, t, i) {
    if (t === "brightness")
      return i.brightness_pct === null ? null : q(i.brightness_pct, e);
    if (t === "warmth") {
      const r = i.kelvin ?? this.minKelvin;
      return me(r, e, this.minKelvin, this.maxKelvin);
    }
    const s = i.hs ? i.hs[0] : 0;
    return e.top + (1 - s / 360) * e.height;
  }
  renderSunMarkers(e) {
    return m`${Object.entries(this.sun).map(([t, i]) => {
      if (!i) return m``;
      const s = S(i.minute, e);
      return m`<line class="sun" x1=${s} y1=${e.top} x2=${s}
                       y2=${e.top + e.height}>
                   <title>${t} ${R(i.minute)}</title>
                 </line>`;
    })}`;
  }
  renderNow(e) {
    const t = S(this.nowMinute, e);
    return m`<line class="now" x1=${t} y1=${e.top} x2=${t}
                     y2=${e.top + e.height} />`;
  }
  renderScrub(e) {
    if (this.scrubMinute === null) return m``;
    const t = S(this.scrubMinute, e);
    return m`<line class="scrub" x1=${t} y1=${e.top} x2=${t}
                     y2=${e.top + e.height} />`;
  }
  /** Faint ticks where the keyframes fall.
   *
   *  Not handles: the lane is a drawing surface, and anything that looks draggable
   *  invites a gesture that no longer exists. These only mark where the control
   *  points ended up, which is otherwise invisible until you read the table.
   */
  renderKeyframeTicks(e, t) {
    return m`${this.keyframes.filter((i) => this.keyframeInLane(t, i)).map((i) => {
      const s = S(i.minute, e);
      return m`<line class="kf-tick" x1=${s} y1=${e.top + e.height - 8}
                         x2=${s} y2=${e.top + e.height} />`;
    })}`;
  }
  keyframeInLane(e, t) {
    return e === "brightness" ? !0 : e === "warmth" ? t.mode === "kelvin" : t.mode === "hs";
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
    i && (this.painting = i, this.emitPaint(i, t));
  }
  onPointerMove(e) {
    const t = this.localPoint(e);
    if (this.scrubbing) {
      this.emitScrub(t.x);
      return;
    }
    this.painting && this.emitPaint(this.painting, t);
  }
  onPointerUp() {
    if (this.painting) {
      const e = this.painting;
      this.painting = null, this.dispatchEvent(
        new CustomEvent("paint-commit", { detail: { lane: e }, bubbles: !0, composed: !0 })
      );
      return;
    }
    this.scrubbing && (this.scrubbing = !1, this.dispatchEvent(new CustomEvent("scrub-end", { bubbles: !0, composed: !0 })));
  }
  emitScrub(e) {
    const t = {
      left: Y,
      top: this.scrubTop,
      width: this.plotWidth
    };
    this.dispatchEvent(
      new CustomEvent("scrub", {
        detail: { minute: Pt(e, t) },
        bubbles: !0,
        composed: !0
      })
    );
  }
  /** Report where the cursor is, in this lane's own units. The panel owns the
   *  sample data and records the stroke; the graph stays a view. */
  emitPaint(e, t) {
    const i = this.plotFor(e), s = Pt(t.x, i);
    let r;
    if (e === "brightness")
      r = fe(t.y, i);
    else if (e === "warmth")
      r = ge(t.y, i, this.minKelvin, this.maxKelvin);
    else {
      const n = 1 - (t.y - i.top) / i.height;
      r = Math.round(Math.min(360, Math.max(0, n * 360)));
    }
    this.dispatchEvent(
      new CustomEvent("curve-paint", {
        detail: { lane: e, minute: s, value: r },
        bubbles: !0,
        composed: !0
      })
    );
  }
};
y.styles = pt`
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
    .kf-tick {
      stroke: var(--secondary-text-color, #999);
      stroke-width: 2;
      opacity: 0.5;
    }
    .lane-bg { cursor: crosshair; }
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
_([
  b({ attribute: !1 })
], y.prototype, "samples", 2);
_([
  b({ attribute: !1 })
], y.prototype, "keyframes", 2);
_([
  b({ attribute: !1 })
], y.prototype, "sun", 2);
_([
  b({ type: Number })
], y.prototype, "nowMinute", 2);
_([
  b({ type: String })
], y.prototype, "selectedId", 2);
_([
  b({ type: Number })
], y.prototype, "minKelvin", 2);
_([
  b({ type: Number })
], y.prototype, "maxKelvin", 2);
_([
  b({ type: Number })
], y.prototype, "scrubMinute", 2);
_([
  b({ type: Number })
], y.prototype, "width", 2);
_([
  $()
], y.prototype, "painting", 2);
_([
  $()
], y.prototype, "scrubbing", 2);
y = _([
  $t("lightcurve-curve-graph")
], y);
function ye(e, t, i, s) {
  const r = e - i, n = t - i, a = (Math.atan2(r, -n) * (180 / Math.PI) + 360) % 360, l = Math.hypot(r, n), h = Math.min(100, Math.round(l / s * 100));
  return { hue: Math.round(a), saturation: h };
}
function xe(e, t, i, s) {
  const r = e % 360 * Math.PI / 180, n = Math.min(100, Math.max(0, t)) / 100 * s;
  return {
    x: i + Math.sin(r) * n,
    y: i - Math.cos(r) * n
  };
}
function jt(e, t) {
  return `hsl(${Math.round(e)}, ${Math.round(t)}%, 50%)`;
}
function Bt(e) {
  const t = Math.min(Math.max(e, 1e3), 4e4) / 100;
  let i, s, r;
  t <= 66 ? (i = 255, s = 99.4708025861 * Math.log(t) - 161.1195681661) : (i = 329.698727446 * (t - 60) ** -0.1332047592, s = 288.1221695283 * (t - 60) ** -0.0755148492), t >= 66 ? r = 255 : t <= 19 ? r = 0 : r = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const n = (o) => Math.round(Math.min(255, Math.max(0, o)));
  return `rgb(${n(i)}, ${n(s)}, ${n(r)})`;
}
var we = Object.defineProperty, _e = Object.getOwnPropertyDescriptor, ot = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? _e(t, i) : t, n = e.length - 1, o; n >= 0; n--)
    (o = e[n]) && (r = (s ? o(t, i, r) : o(r)) || r);
  return s && r && we(t, i, r), r;
};
const U = 220, It = U / 2 - 10;
let z = class extends C {
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
    const e = xe(this.hue, this.saturation, U / 2, It), t = 12 + this.brightness / 100 * 43;
    return c`
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
    const i = this.renderRoot.querySelector(".wheel").getBoundingClientRect(), s = U / i.width, { hue: r, saturation: n } = ye(
      (e.clientX - i.left) * s,
      (e.clientY - i.top) * s,
      U / 2,
      It
    );
    this.emit({ hue: r, saturation: n });
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
z.styles = pt`
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
ot([
  b({ type: Number })
], z.prototype, "hue", 2);
ot([
  b({ type: Number })
], z.prototype, "saturation", 2);
ot([
  b({ type: Number })
], z.prototype, "brightness", 2);
z = ot([
  $t("lightcurve-colour-wheel")
], z);
function it(e, t) {
  if (e.length <= 2) return [...e];
  let i = 0, s = 0;
  const r = e[0], n = e[e.length - 1];
  for (let l = 1; l < e.length - 1; l++) {
    const h = Ae(e[l], r, n);
    h > s && (s = h, i = l);
  }
  if (s <= t)
    return [r, n];
  const o = it(e.slice(0, i + 1), t), a = it(e.slice(i), t);
  return [...o.slice(0, -1), ...a];
}
function Ae(e, t, i) {
  const s = i.minute - t.minute;
  if (s === 0) return Math.abs(e.value - t.value);
  const r = (i.value - t.value) / s, n = t.value + (e.minute - t.minute) * r;
  return Math.abs(e.value - n);
}
function Se(e, t, i = 1.5) {
  let s = i, r = it(e, s);
  for (let n = 0; n < 24 && r.length > t; n++)
    s *= 1.6, r = it(e, s);
  return { points: r, tolerance: s };
}
function at(e, t) {
  const i = Math.abs(e - t);
  return Math.min(i, M - i);
}
const Me = 48, ke = 5;
function Te(e, t) {
  if (e.kind === "radial")
    return at(t, e.centre) <= e.radius;
  const { from: i, to: s } = e;
  return i <= s ? t >= i && t <= s : t >= i || t <= s;
}
function Ee(e, t) {
  let i = null, s = 1 / 0;
  for (const r of e) {
    const n = at(r.minute, t);
    n < s && (s = n, i = r);
  }
  return i ? i.value : null;
}
function Rt(e, t, i) {
  if (t === "brightness")
    e.brightness = Math.round(Math.min(100, Math.max(1, i)));
  else if (t === "warmth")
    e.colour = { mode: "kelvin", kelvin: Math.round(i) };
  else {
    const s = e.colour.hs?.[1] ?? 100;
    e.colour = { mode: "hs", hs: [Math.round(i) % 360, s] };
  }
}
function Pe(e) {
  const t = (e % 1440 + 1440) % 1440, i = String(Math.floor(t / 60)).padStart(2, "0"), s = String(t % 60).padStart(2, "0");
  return `${i}:${s}`;
}
function Ce(e, t, i, s, r, n = Me) {
  const o = new Map(t.map((u) => [u.id, u.minute])), a = (u) => Te(r, u), l = e.map((u) => {
    const J = o.get(u.id);
    if (J === void 0 || !a(J)) return u;
    const k = Ee(s, J);
    if (k === null) return u;
    const G = JSON.parse(JSON.stringify(u));
    return Rt(G, i, k), G;
  }), h = s.filter((u) => a(u.minute));
  if (h.length < 3) return l;
  const f = i === "brightness" ? 2.5 : i === "warmth" ? 90 : 8, { points: d } = Se(h, n, f), A = l.map((u) => o.get(u.id)).filter((u) => u !== void 0), x = [];
  for (const u of d) {
    if (l.length + x.length >= n) break;
    if ([...A, ...x.map((V) => Ne(V))].some(
      (V) => V !== null && at(V, u.minute) < ke
    )) continue;
    const k = Oe(l, o, u.minute), G = {
      id: `k_${Math.random().toString(36).slice(2, 8)}`,
      time: { type: "fixed", value: Pe(u.minute) },
      colour: k ? JSON.parse(JSON.stringify(k.colour)) : { mode: "kelvin", kelvin: 3e3 },
      brightness: k ? k.brightness : 50,
      easing: k ? k.easing : "ease_in_out"
    };
    Rt(G, i, u.value), x.push(G);
  }
  return [...l, ...x];
}
function Ne(e) {
  if (e.time.type !== "fixed" || !e.time.value) return null;
  const [t, i] = e.time.value.split(":").map(Number);
  return t * 60 + i;
}
function Oe(e, t, i) {
  let s = null, r = 1 / 0;
  for (const n of e) {
    const o = t.get(n.id);
    if (o === void 0) continue;
    const a = at(o, i);
    a < r && (r = a, s = n);
  }
  return s;
}
function Ie() {
  return { values: /* @__PURE__ */ new Map(), first: -1, last: -1 };
}
function Re(e, t, i, s = 5) {
  const r = new Map(e.values);
  if (e.last >= 0 && e.last !== t) {
    const n = e.last, o = r.get(n) ?? i, a = t - n, l = Math.max(1, Math.round(Math.abs(a) / s));
    for (let h = 1; h <= l; h++) {
      const f = h / l, d = Z(n + a * f, s);
      r.set(Q(d), o + (i - o) * f);
    }
  }
  return r.set(Q(Z(t, s)), i), {
    values: r,
    first: e.first < 0 ? Q(Z(t, s)) : e.first,
    last: t
  };
}
function Ue(e, t) {
  return t.values.size === 0 ? e : e.map((i) => {
    const s = t.values.get(i.minute);
    return s === void 0 ? i : { minute: i.minute, value: s };
  });
}
function He(e) {
  if (e.values.size === 0) return null;
  const t = [...e.values.keys()].sort((r, n) => r - n), i = e.first >= 0 ? e.first : t[0], s = Q(Z(e.last, 5));
  return i <= s ? { from: i, to: s } : { from: s, to: i };
}
function Z(e, t) {
  return Math.round(e / t) * t;
}
function Q(e) {
  return (e % M + M) % M;
}
var De = Object.defineProperty, ze = Object.getOwnPropertyDescriptor, v = (e, t, i, s) => {
  for (var r = s > 1 ? void 0 : s ? ze(t, i) : t, n = e.length - 1, o; n >= 0; n--)
    (o = e[n]) && (r = (s ? o(t, i, r) : o(r)) || r);
  return s && r && De(t, i, r), r;
};
const Ge = 300;
let g = class extends C {
  constructor() {
    super(...arguments), this.narrow = !1, this.profiles = [], this.groups = [], this.themes = [], this.editingTheme = null, this.themeTarget = [], this.profile = null, this.variant = "default", this.samples = [], this.resolved = [], this.sun = {}, this.issues = [], this.selectedId = null, this.previewGroupId = null, this.scrubMinute = null, this.dirty = !1, this.busy = !1, this.error = null, this.graphWidth = 900, this.lastScrubAt = 0, this.stroke = null, this.onKeyframeMove = (e) => {
      const { id: t, minute: i, sunEvent: s, brightness: r, kelvin: n, hue: o } = e.detail;
      this.mutate(t, (a) => {
        if (s ? a.time = { type: "sun", event: s, offset_min: 0 } : a.time = { type: "fixed", value: R(i) }, r !== void 0 && (a.brightness = r), n !== void 0 && (a.colour = { mode: "kelvin", kelvin: n }), o !== void 0) {
          const l = a.colour.hs?.[1] ?? 100;
          a.colour = { mode: "hs", hs: [o, l] };
        }
      });
    }, this.onKeyframeCommit = () => {
      this.refreshGraph();
    }, this.onSelect = (e) => {
      this.selectedId = e.detail.id;
    }, this.onPaint = (e) => {
      const { lane: t, minute: i, value: s } = e.detail;
      this.stroke = Re(this.stroke ?? Ie(), i, s);
      const r = this.samples.map((o) => ({
        minute: o.minute,
        value: Ut(o, t)
      })), n = Ue(r, this.stroke);
      this.samples = this.samples.map(
        (o, a) => Le(o, t, n[a].value)
      ), this.dirty = !0;
    }, this.onPaintCommit = (e) => {
      const t = this.stroke;
      if (this.stroke = null, !this.profile || !t) return;
      const i = He(t);
      if (!i) return;
      const s = e.detail.lane, r = this.samples.map((o) => ({
        minute: o.minute,
        value: Ut(o, s)
      })), n = Ce(this.keyframes, this.resolved, s, r, {
        kind: "span",
        ...i
      });
      this.profile = {
        ...this.profile,
        variants: { ...this.profile.variants, [this.variant]: { keyframes: n } }
      }, this.refreshGraph();
    }, this.onScrub = (e) => {
      this.scrubMinute = e.detail.minute;
      const t = Date.now();
      t - this.lastScrubAt < Ge || (this.lastScrubAt = t, this.previewAt(e.detail.minute));
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
      this.error = w(e);
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
        this.error = w(e);
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
        this.error = w(t);
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
      this.error = w(e);
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
      this.error = w(t);
    }
    await this.refreshThemes();
  }
  async releaseThemes() {
    this.error = null;
    try {
      await this.send({ type: "lightcurve/themes/release" });
    } catch (e) {
      this.error = w(e);
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
      this.error = w(r);
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
        this.error = w(e);
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
      this.error = w(i);
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
      holding: !1
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
      this.error = w(s);
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
        this.error = w(e);
      }
  }
  async save() {
    if (!(!this.profile || this.blocked)) {
      this.busy = !0, this.error = null;
      try {
        await this.send({ type: "lightcurve/profiles/save", profile: this.profile }), this.dirty = !1, await this.refreshGraph();
      } catch (e) {
        this.error = w(e);
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
        time: { type: "fixed", value: R(e) },
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
    return c`
      ${this.error ? c`<div class="error-banner">${this.error}</div>` : p}
      <div class="bar">
        <div>
          <label for="profile">Profile</label>
          <select id="profile" @change=${(t) => void this.openProfile(t.target.value)}>
            ${this.profiles.map(
      (t) => c`<option value=${t.id} ?selected=${t.id === this.profile?.id}>
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
      (t) => c`<option value=${t.id} ?selected=${t.id === this.previewGroupId}>
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
          .nowMinute=${je()}
          @keyframe-move=${this.onKeyframeMove}
          @keyframe-commit=${this.onKeyframeCommit}
          @keyframe-select=${this.onSelect}
          @curve-paint=${this.onPaint}
          @paint-commit=${this.onPaintCommit}
          @scrub=${this.onScrub}
          @scrub-end=${this.onScrubEnd}
        ></lightcurve-curve-graph>
        <p class="hint">
          Drag across a lane to draw it: every moment your cursor passes takes its
          height. Keyframes are rebuilt from what you drew, and the ones you did not
          paint over are left alone. The strip at the bottom previews a time of day
          on ${e ? e.name : "the selected room"}.
        </p>
      </div>

      ${this.renderRooms()}

      ${this.renderKeyframeTable()}

      ${this.renderThemes()}

      ${this.issues.length > 0 ? c`<div class="card">
            <ul class="issues">
              ${this.issues.map(
      (t) => c`<li class=${t.level}>${t.message}</li>`
    )}
            </ul>
          </div>` : p}

      ${this.selected ? this.renderSheet(this.selected) : p}
    `;
  }
  /** Buttons for the saved themes, and the editor for one of them. */
  renderThemes() {
    if (this.themes.length === 0) return c`${p}`;
    const e = this.themes.some((t) => t.holding);
    return c`
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
      (t) => c`<option
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
            title=${e ? "Return every room to its curve" : "Nothing is holding a theme"}
            @click=${() => void this.releaseThemes()}
          >
            Back to curve
          </button>
        </div>
        <div class="themes">
          ${this.themes.map(
      (t) => c`
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
                    <span class="theme-covers">${t.covers.join(", ")}</span>
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
        ${this.editingTheme ? this.renderThemeEditor(this.editingTheme) : p}
      </div>
    `;
  }
  renderThemeEditor(e) {
    const t = e.colour?.hs ?? [30, 80], i = this.themes.some((s) => s.id === e.id);
    return c`
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

        ${e.mode === "effect" ? c`<div class="row">
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
            </div>` : c`
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
        groups: Array.from(r.selectedOptions).map((n) => n.value)
      });
    }}
            >
              ${this.groups.map(
      (s) => c`<option
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
          ${i ? c`<button class="secondary" @click=${() => void this.deleteTheme()}>
                Delete
              </button>` : p}
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
    return this.groups.length === 0 ? c`${p}` : c`
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
      (e) => c`
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
        (t) => c`<option
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
    return c`
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
      </div>
    `;
  }
  renderKeyframeRow(e, t) {
    const i = t.get(e.id), s = e.time.type === "sun", r = e.colour.mode === "kelvin" ? Bt(e.colour.kelvin ?? 3e3) : jt(e.colour.hs?.[0] ?? 0, e.colour.hs?.[1] ?? 100);
    return c`
      <tr class=${this.selectedId === e.id ? "selected" : ""}
          @click=${() => this.selectedId = e.id}>
        <td>
          ${s ? c`<span class="sun-pill" title="Follows the sun, so it moves daily">
                ${e.time.event}${(e.time.offset_min ?? 0) !== 0 ? ` ${e.time.offset_min > 0 ? "+" : ""}${e.time.offset_min}m` : ""}
              </span>` : c`<input
                class="cell"
                .value=${e.time.value ?? "00:00"}
                @change=${(n) => {
      const o = Ct(n.target.value);
      o !== null && (this.mutate(e.id, (a) => {
        a.time = { type: "fixed", value: R(o) };
      }), this.refreshGraph());
    }}
              />`}
        </td>
        <td class="muted">
          ${i ? R(i.minute) : "—"}
        </td>
        <td>
          <span class="swatch inline" style="background:${r}"></span>
          ${e.colour.mode === "kelvin" ? c`<input
                class="cell narrow"
                type="number"
                min="1000"
                max="20000"
                step="50"
                .value=${String(e.colour.kelvin ?? 3e3)}
                @change=${(n) => {
      this.mutate(e.id, (o) => {
        o.colour = {
          mode: "kelvin",
          kelvin: Number(n.target.value)
        };
      }), this.refreshGraph();
    }}
              />K` : c`<input
                class="cell narrow"
                type="number"
                min="0"
                max="360"
                .value=${String(Math.round(e.colour.hs?.[0] ?? 0))}
                @change=${(n) => {
      const o = e.colour.hs?.[1] ?? 100;
      this.mutate(e.id, (a) => {
        a.colour = {
          mode: "hs",
          hs: [Number(n.target.value), o]
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
            @change=${(n) => {
      this.mutate(e.id, (o) => {
        o.brightness = Number(n.target.value);
      }), this.refreshGraph();
    }}
          />%
        </td>
        <td>
          <select
            class="cell"
            @change=${(n) => {
      this.mutate(e.id, (o) => {
        o.easing = n.target.value;
      }), this.refreshGraph();
    }}
          >
            ${["linear", "ease_in_out", "step"].map(
      (n) => c`<option value=${n} ?selected=${e.easing === n}>
                ${n}
              </option>`
    )}
          </select>
        </td>
        <td>
          <button
            class="secondary small"
            ?disabled=${this.keyframes.length <= 2}
            @click=${(n) => {
      n.stopPropagation(), this.selectedId = e.id, this.deleteSelected();
    }}
          >✕</button>
        </td>
      </tr>
    `;
  }
  renderSheet(e) {
    return c`
      <div class="sheet">
        <div class="row">
          <div>
            <label for="time">Time</label>
            ${e.time.type === "sun" ? c`<input id="time" .value=${`${e.time.event} ${e.time.offset_min ?? 0}m`} readonly />` : c`<input
                  id="time"
                  .value=${e.time.value ?? "00:00"}
                  @change=${(t) => {
      const i = Ct(t.target.value);
      i !== null && (this.mutate(e.id, (s) => {
        s.time = { type: "fixed", value: R(i) };
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
      (t) => c`<option value=${t} ?selected=${e.easing === t}>
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
g.styles = pt`
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
v([
  b({ attribute: !1 })
], g.prototype, "hass", 2);
v([
  b({ type: Boolean })
], g.prototype, "narrow", 2);
v([
  $()
], g.prototype, "profiles", 2);
v([
  $()
], g.prototype, "groups", 2);
v([
  $()
], g.prototype, "themes", 2);
v([
  $()
], g.prototype, "editingTheme", 2);
v([
  $()
], g.prototype, "themeTarget", 2);
v([
  $()
], g.prototype, "profile", 2);
v([
  $()
], g.prototype, "variant", 2);
v([
  $()
], g.prototype, "samples", 2);
v([
  $()
], g.prototype, "resolved", 2);
v([
  $()
], g.prototype, "sun", 2);
v([
  $()
], g.prototype, "issues", 2);
v([
  $()
], g.prototype, "selectedId", 2);
v([
  $()
], g.prototype, "previewGroupId", 2);
v([
  $()
], g.prototype, "scrubMinute", 2);
v([
  $()
], g.prototype, "dirty", 2);
v([
  $()
], g.prototype, "busy", 2);
v([
  $()
], g.prototype, "error", 2);
v([
  $()
], g.prototype, "graphWidth", 2);
g = v([
  $t("lightcurve-panel")
], g);
function Ke(e) {
  if (e.mode === "effect")
    return "linear-gradient(135deg, #ff4081, #7c4dff, #00bcd4)";
  if (e.colour?.mode === "kelvin")
    return Bt(e.colour.kelvin ?? 3e3);
  const t = e.colour?.hs ?? [30, 80];
  return jt(t[0], t[1]);
}
function Ut(e, t) {
  return t === "brightness" ? e.brightness_pct ?? 1 : t === "warmth" ? e.kelvin ?? 2700 : e.hs ? e.hs[0] : 0;
}
function Le(e, t, i) {
  if (t === "brightness")
    return { ...e, brightness_pct: Math.round(i) };
  if (t === "warmth")
    return { ...e, mode: "kelvin", kelvin: Math.round(i) };
  const s = e.hs ? e.hs[1] : 100;
  return { ...e, mode: "hs", hs: [Math.round(i) % 360, s] };
}
function je() {
  const e = /* @__PURE__ */ new Date();
  return e.getHours() * 60 + e.getMinutes();
}
function w(e) {
  return e && typeof e == "object" && "message" in e ? String(e.message) : String(e);
}
export {
  g as LightcurvePanel
};
