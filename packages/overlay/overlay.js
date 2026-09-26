/**
 * EditLayer — Figma-style overlay for localhost apps (dependency-free ES module).
 */
import { COACH_STEPS, ONBOARDING_KEY, advanceCoach, coachBlocksEdit, readCoach } from "./onboarding.js";

const FEEL_WORDS = [
  "tighter", "airier", "subtler", "bolder", "sharper",
  "softer", "calmer", "livelier", "premium", "playful",
];

const SCOPES = [
  { value: "this", label: "Just this" },
  { value: "instances", label: "Every one like this" },
  { value: "component", label: "The component" },
  { value: "token", label: "The token" },
  { value: "frame", label: "This frame" },
];

const FRAMES = [
  { value: "desktop", label: "Desk" },
  { value: "tablet", label: "Tab" },
  { value: "phone", label: "Phone" },
];

const TOKEN_APPLY_ERROR = "This uses a token. Choose The token, or Ask the agent.";

if (!window.__editlayer) {
  window.__editlayer = true;
  boot();
}

function boot() {
  const scriptEl =
    document.querySelector('script[src*="overlay.js"][data-api]') ||
    document.querySelector('script[src*="overlay.js"]');
  const api = (scriptEl && scriptEl.getAttribute("data-api")) || "http://localhost:3001";
  const applyMode = scriptEl?.getAttribute("data-apply");
  const canApply = applyMode === "true" || applyMode === "server";
  const fileApi = applyMode === "server" ? api : "";

  const host = document.createElement("editlayer-root");
  host.style.cssText =
    "all:initial;position:fixed;inset:0;width:0;height:0;z-index:2147483000;pointer-events:none;display:none;";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const state = {
    editMode: false,
    selected: null,
    hoverEl: null,
    instances: [],
    changes: {},
    changeMeta: {},
    classBase: [],
    classAdd: new Set(),
    classRemove: new Set(),
    previews: new Map(),
    applied: [],
    feel: new Set(),
    scope: "this",
    frame: "desktop",
    sessionOn: false,
    askText: "",
    briefText: "",
    requests: new Map(),
    serverOnline: true,
    activeTab: "design",
    rafId: 0,
    panelOpen: false,
  };

  const $ = (sel, root = shadow) => root.querySelector(sel);
  const $$ = (sel, root = shadow) => [...root.querySelectorAll(sel)];

  shadow.innerHTML = buildShell();
  injectStyles(shadow);

  const els = {
    pill: $(".el-pill"),
    pillBadge: $(".el-pill-badge"),
    panel: $(".el-panel"),
    panelHeader: $(".el-panel-header"),
    tabs: $$(".el-tab"),
    tabDesign: $('[data-tab-panel="design"]'),
    tabAsk: $('[data-tab-panel="ask"]'),
    tabBrief: $('[data-tab-panel="brief"]'),
    toastStack: $(".el-toasts"),
    hoverLayer: $(".el-hover-layer"),
    selectLayer: $(".el-select-layer"),
    pinLayer: $(".el-pin-layer"),
    popover: $(".el-popover"),
    serverBanner: $(".el-server-offline"),
    designFields: $(".el-design-fields"),
    changesList: $(".el-changes-list"),
    applyBtn: $(".el-btn-apply"),
    resetBtn: $(".el-btn-reset"),
    askAgentBtn: $(".el-btn-ask-tab"),
    askTextarea: $(".el-ask-text"),
    feelChips: $('.el-feel-chips[data-chips="feel"]'),
    scopeChips: $(".el-scope-chips"),
    frameChips: $(".el-frame-chips"),
    scopeLine: $(".el-scope-line"),
    previewTweaks: $(".el-preview-tweaks"),
    sendAgent: $(".el-btn-send"),
    briefArea: $(".el-brief-text"),
    briefSave: $(".el-btn-brief-save"),
    briefNote: $(".el-brief-note"),
    tipsBtn: $(".el-btn-tips"),
    coach: $(".el-coach"),
    coachKicker: $(".el-coach-kicker"),
    coachTitle: $(".el-coach-title"),
    coachBody: $(".el-coach-body"),
    coachNext: $(".el-coach-next"),
    selectParentBtn: $(".el-btn-parent"),
    errorInline: $(".el-inline-error"),
  };

  buildFeelChips();
  renderChoiceChips();
  if (!canApply) {
    els.briefNote.hidden = false;
    els.briefArea.disabled = true;
    els.briefSave.disabled = true;
  }

  // --- utilities ---

  function parseStamp(el) {
    const raw = el?.getAttribute?.("data-editlayer-source");
    if (!raw) return null;
    const m = raw.match(/^([^:]+):(\d+):(\d+)$/);
    if (!m) return null;
    return { file: m[1], line: +m[2], column: +m[3], raw };
  }

  function stampKey(el) {
    return el?.getAttribute?.("data-editlayer-source") || null;
  }

  function componentName(el) {
    return el?.getAttribute?.("data-editlayer-component") || el?.tagName?.toLowerCase() || "element";
  }

  function findInstances(el) {
    const key = stampKey(el);
    if (!key) return [el];
    return [...document.querySelectorAll(`[data-editlayer-source="${CSS.escape(key)}"]`)];
  }

  function cssPath(el) {
    if (!(el instanceof Element)) return "body";
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node !== document.body && depth < 6) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        part = `#${CSS.escape(node.id)}`;
        parts.unshift(part);
        break;
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(node) + 1;
          part += `:nth-of-type(${idx})`;
        }
      }
      parts.unshift(part);
      node = parent;
      depth++;
    }
    return parts.join(" > ") || "body";
  }

  function camelToKebab(s) {
    return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  }

  function fileEndpoint(kind) {
    const path = applyMode === "server" ? `/overlay/${kind}` : `/__editlayer/${kind}`;
    return `${fileApi}${path}`;
  }

  function projectFileFromHref(href) {
    if (!href) return null;
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(href).pathname);
    } catch {
      return null;
    }
    const srcAt = pathname.lastIndexOf("/src/");
    if (pathname.includes("/@fs/") && srcAt !== -1) pathname = pathname.slice(srcAt + 1);
    else pathname = pathname.replace(/^\//, "");
    if (!pathname.endsWith(".css") || pathname.includes("..") || pathname.includes("node_modules")) return null;
    return pathname;
  }

  function projectFileFromSheet(sheet) {
    const fromHref = projectFileFromHref(sheet?.href);
    if (fromHref) return fromHref;
    const id = sheet?.ownerNode?.getAttribute?.("data-vite-dev-id");
    if (!id) return null;
    const clean = id.split("?")[0].replace(/\\/g, "/");
    const at = clean.lastIndexOf("/src/");
    if (at !== -1) return clean.slice(at + 1);
    const name = clean.slice(clean.lastIndexOf("/") + 1);
    return name.endsWith(".css") && !name.includes("..") ? name : null;
  }

  function eachStyleRule(visit) {
    const walk = (rules, sheet) => {
      for (const rule of rules) {
        if (rule.type === CSSRule.STYLE_RULE) visit(rule, sheet);
        else if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules, sheet);
      }
    };
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      if (rules) walk(rules, sheet);
    }
  }

  function selectorIsLocal(el, selector) {
    if (!selector || selector === "*" || selector === "body" || selector === "html") return false;
    if (el.id && selector.includes(`#${CSS.escape(el.id)}`)) return true;
    for (const cls of el.classList) {
      if (selector.split(",").some((part) => part.split(/[^A-Za-z0-9_-]+/).includes(cls))) return true;
    }
    return false;
  }

  function matchingSelector(el, selectorText) {
    let hit = null;
    for (const part of selectorText.split(",")) {
      const sel = part.trim();
      try {
        if (el.matches(sel)) hit = sel;
      } catch {
        /* ignore invalid selectors */
      }
    }
    return hit;
  }

  function originFor(el, prop) {
    const kebab = camelToKebab(prop);
    let found = null;
    eachStyleRule((rule, sheet) => {
      if (!rule.style.getPropertyValue(kebab)) return;
      const sel = matchingSelector(el, rule.selectorText);
      if (!sel || !selectorIsLocal(el, sel)) return;
      const file = projectFileFromSheet(sheet);
      if (!file) return;
      found = { file, selector: sel, property: kebab, specified: rule.style.getPropertyValue(kebab).trim() };
    });
    if (!found) return null;
    const token = found.specified.match(/^var\(\s*(--[a-z0-9-]+)/);
    return {
      css: { file: found.file, selector: found.selector, property: found.property },
      replaces: token ? token[1] : null,
    };
  }

  function destLabel(prop) {
    const o = state.changeMeta[prop];
    if (!o) return "inline style";
    if (o.css) {
      const via = o.replaces ? `, was var(${o.replaces})` : "";
      return `${o.css.selector} in ${o.css.file}${via}`;
    }
    return "inline style";
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb === "transparent") return "#000000";
    if (rgb.startsWith("#")) return rgb.length === 4 ? expandShortHex(rgb) : rgb.slice(0, 7);
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return "#000000";
    const h = (n) => Number(n).toString(16).padStart(2, "0");
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  }

  function expandShortHex(h) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }

  function parsePxNum(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }

  function roundRect(r) {
    return {
      x: Math.round(r.x + window.scrollX),
      y: Math.round(r.y + window.scrollY),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  }

  function isFormFocus() {
    const a = document.activeElement === host ? shadow.activeElement : document.activeElement;
    if (!a) return false;
    const tag = a.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || a.isContentEditable;
  }

  function singleTextChild(el) {
    if (!el) return null;
    const nodes = [...el.childNodes].filter((n) => {
      if (n.nodeType === Node.TEXT_NODE) return n.textContent.trim().length > 0;
      return n.nodeType === Node.ELEMENT_NODE;
    });
    if (nodes.length !== 1 || nodes[0].nodeType !== Node.TEXT_NODE) return null;
    return nodes[0];
  }

  // previews: element -> { style: { prop: inline value before preview }, text?: { node, value } }
  function previewEntry(el) {
    if (!state.previews.has(el)) state.previews.set(el, { style: {} });
    return state.previews.get(el);
  }

  function setPreview(el, prop, value) {
    const entry = previewEntry(el);
    const kebab = camelToKebab(prop);
    if (!(prop in entry.style)) entry.style[prop] = el.style.getPropertyValue(kebab);
    el.style.setProperty(kebab, value);
  }

  function setTextPreview(el, value) {
    const node = singleTextChild(el);
    if (!node) return;
    const entry = previewEntry(el);
    if (!entry.text) entry.text = { node, value: node.textContent };
    node.textContent = value;
  }

  function restorePreviews(previews) {
    for (const [el, entry] of previews) {
      for (const [prop, orig] of Object.entries(entry.style)) {
        if (orig === "") el.style.removeProperty(camelToKebab(prop));
        else el.style.setProperty(camelToKebab(prop), orig);
      }
      if (entry.text) entry.text.node.textContent = entry.text.value;
      if (entry.className !== undefined) el.className = entry.className;
    }
  }

  function previewClasses() {
    const next = state.classBase.filter((c) => !state.classRemove.has(c));
    for (const c of state.classAdd) if (!next.includes(c)) next.push(c);
    const value = next.join(" ");
    for (const el of state.instances) {
      if (typeof el.className !== "string") continue;
      const entry = previewEntry(el);
      if (entry.className === undefined) entry.className = el.className;
      el.className = value;
    }
  }

  function resetChanges() {
    els.errorInline.hidden = true;
    state.previews = new Map();
    state.changes = {};
    state.changeMeta = {};
    state.classAdd = new Set();
    state.classRemove = new Set();
    renderChanges();
    if (state.selected) renderDesignFields(state.selected);
  }

  function restoreAllPreviews() {
    restorePreviews(state.previews);
    resetChanges();
  }

  function trackChange(prop, from, to, el) {
    if (!(prop in state.changeMeta) && el) state.changeMeta[prop] = originFor(el, prop);
    const base = state.changes[prop]?.from ?? from;
    if (base === to) {
      delete state.changes[prop];
      delete state.changeMeta[prop];
    } else {
      state.changes[prop] = { from: base, to };
    }
    renderChanges();
  }

  function computedSubset(el) {
    const cs = getComputedStyle(el);
    return {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      padding: cs.padding,
      margin: cs.margin,
      borderRadius: cs.borderRadius,
      gap: cs.gap,
      width: cs.width,
      height: cs.height,
      display: cs.display,
    };
  }

  function buildTarget(el) {
    const instances = findInstances(el);
    const rect = el.getBoundingClientRect();
    const stamp = parseStamp(el);
    const textNode = singleTextChild(el);
    const text =
      (textNode?.textContent || el.textContent || "").trim().slice(0, 120) ||
      undefined;
    return {
      url: location.href,
      selector: cssPath(el),
      source: stamp ? { file: stamp.file, line: stamp.line, column: stamp.column } : undefined,
      component: componentName(el),
      tag: el.tagName.toLowerCase(),
      text,
      instances: instances.length,
      rect: roundRect(rect),
      styles: computedSubset(el),
    };
  }

  function elementFromPoint(x, y) {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (el === host || el.closest?.("editlayer-root")) continue;
      return el;
    }
    return null;
  }

  // --- UI builders ---

  function buildShell() {
    return `
<div class="el-root">
  <div class="el-hover-layer"></div>
  <div class="el-select-layer"></div>
  <div class="el-pin-layer"></div>
  <div class="el-popover" hidden></div>
  <button type="button" class="el-pill" aria-label="Toggle EditLayer (E)">
    <span class="el-pill-label">EditLayer</span>
    <kbd>E</kbd>
    <span class="el-pill-badge" hidden>0</span>
  </button>
  <aside class="el-panel" hidden aria-label="EditLayer inspector">
    <div class="el-server-offline" hidden>EditLayer server offline — Design & Apply still work locally.</div>
    <header class="el-panel-header"></header>
    <nav class="el-tabs" role="tablist">
      <button type="button" class="el-tab is-active" data-tab="design" role="tab">Design</button>
      <button type="button" class="el-tab" data-tab="ask" role="tab">Ask agent</button>
      <button type="button" class="el-tab" data-tab="brief" role="tab">Brief</button>
    </nav>
    <div class="el-panel-body">
      <div class="el-tab-panel" data-tab-panel="design">
        <div class="el-toolbar-row">
          <button type="button" class="el-btn-ghost el-btn-parent">Select parent</button>
        </div>
        <div class="el-design-fields"></div>
        <div class="el-section">
          <div class="el-section-title">Changes</div>
          <ul class="el-changes-list"></ul>
        </div>
        <p class="el-inline-error" hidden></p>
        <div class="el-actions">
          <button type="button" class="el-btn-primary el-btn-apply">Apply to code</button>
          <button type="button" class="el-btn-ghost el-btn-reset">Reset</button>
          <button type="button" class="el-btn-ghost el-btn-ask-tab">Ask agent</button>
        </div>
      </div>
      <div class="el-tab-panel" data-tab-panel="ask" hidden>
        <div class="el-section">
          <div class="el-section-title">Scope</div>
          <div class="el-feel-chips el-scope-chips"></div>
        </div>
        <div class="el-section">
          <div class="el-section-title">Frame</div>
          <div class="el-feel-chips el-frame-chips"></div>
        </div>
        <label class="el-field el-section">
          <span class="el-label">How should this look or feel?</span>
          <textarea class="el-ask-text" rows="4" placeholder="Describe the change…"></textarea>
        </label>
        <div class="el-section">
          <div class="el-section-title">Feel</div>
          <div class="el-feel-chips" data-chips="feel"></div>
        </div>
        <div class="el-section">
          <div class="el-section-title">Previewed tweaks</div>
          <ul class="el-preview-tweaks"></ul>
        </div>
        <p class="el-hint el-scope-line"></p>
        <button type="button" class="el-btn-primary el-btn-send">Send to agent</button>
        <p class="el-hint">Ctrl/Cmd+Enter to send</p>
      </div>
      <div class="el-tab-panel" data-tab-panel="brief" hidden>
        <p class="el-brief-note" hidden>Brief lives in <code>editlayer.brief.md</code> when Apply is unavailable.</p>
        <label class="el-field">
          <span class="el-label">Project brief</span>
          <textarea class="el-brief-text" rows="10" placeholder="Describe how this product should look and feel — the agent reads this before every change"></textarea>
        </label>
        <button type="button" class="el-btn-primary el-btn-brief-save">Save</button>
        <button type="button" class="el-btn-ghost el-btn-tips">Show tips</button>
      </div>
    </div>
  </aside>
  <div class="el-toasts" aria-live="polite"></div>
  <aside class="el-coach" hidden>
    <p class="el-coach-kicker"></p>
    <p class="el-coach-title"></p>
    <p class="el-coach-body"></p>
    <div class="el-coach-actions">
      <button type="button" class="el-btn-primary el-coach-next">Next</button>
    </div>
  </aside>
</div>`;
  }

  function injectStyles(shadowRoot) {
    const style = document.createElement("style");
    style.textContent = `
:host, .el-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.el-root { pointer-events: none; --bg-panel: #fff; --bg-input: #f5f5f7; --border: #e5e5ea; --text: #1a1a1a; --muted: #8e8e93;
  --accent: #2563eb; --focus: rgba(37,99,235,.4); --coworker: #7c3aed; --coworker-soft: rgba(124,58,237,.12);
  --success: #15803d; --danger: #dc2626; --mono: ui-monospace, Consolas, monospace; }
@media (prefers-color-scheme: dark) {
  .el-root { --bg-panel: #2c2c2c; --bg-input: #383838; --border: #444; --text: #f5f5f7; --muted: #98989d;
    --accent: #3b82f6; --focus: rgba(59,130,246,.4); --coworker: #a78bfa; --coworker-soft: rgba(167,139,250,.16); --success: #4ade80; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
.el-root * { box-sizing: border-box; }
.el-pill { pointer-events: auto; position: fixed; right: 16px; bottom: 16px; z-index: 6; display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; border: 1px solid var(--border); border-radius: 999px; background: var(--bg-panel); color: var(--text);
  font-size: 12px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.el-pill kbd { font-family: var(--mono); font-size: 10px; padding: 2px 6px; border: 1px solid var(--border); border-radius: 4px; color: var(--muted); }
.el-pill:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.el-pill-badge { background: var(--coworker); color: #fff; font-size: 10px; min-width: 18px; height: 18px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; }
.el-panel { pointer-events: auto; position: fixed; top: 0; right: 0; z-index: 4; width: 300px; height: 100vh; background: var(--bg-panel);
  border-left: 1px solid var(--border); display: flex; flex-direction: column; color: var(--text); font-size: 12px; }
.el-panel[hidden] { display: none; }
.el-server-offline { padding: 8px 12px; background: var(--coworker-soft); color: var(--text); font-size: 11px; border-bottom: 1px solid var(--border); }
.el-panel-header { padding: 12px; border-bottom: 1px solid var(--border); }
.el-panel-header .el-comp { font-weight: 600; font-size: 13px; }
.el-panel-header .el-src { font-family: var(--mono); font-size: 11px; color: var(--muted); margin-top: 4px; word-break: break-all; }
.el-tabs { display: flex; border-bottom: 1px solid var(--border); }
.el-tab { flex: 1; padding: 10px 8px; border: 0; background: transparent; color: var(--muted); cursor: pointer; font-size: 11px; }
.el-tab.is-active { color: var(--accent); box-shadow: inset 0 -2px 0 var(--accent); }
.el-tab:focus-visible { outline: 2px solid var(--focus); }
.el-panel-body { flex: 1; overflow: auto; padding: 12px; }
.el-section { margin-top: 12px; }
.el-section-title { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin-bottom: 6px; }
.el-field { display: block; margin-bottom: 10px; }
.el-label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 4px; cursor: ew-resize; user-select: none; }
.el-input, .el-select, textarea.el-ask-text, textarea.el-brief-text {
  width: 100%; height: 28px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px;
  background: var(--bg-input); color: var(--text); font-size: 12px; font-family: var(--mono); }
textarea.el-ask-text, textarea.el-brief-text { height: auto; min-height: 80px; font-family: inherit; resize: vertical; }
.el-input:focus-visible, .el-select:focus-visible, textarea:focus-visible { outline: 2px solid var(--focus); }
.el-row-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.el-color-row { display: flex; gap: 6px; align-items: center; }
.el-color-row input[type=color] { width: 28px; height: 28px; padding: 0; border: 1px solid var(--border); border-radius: 4px; cursor: pointer; }
.el-note { font-size: 11px; color: var(--muted); padding: 8px; background: var(--bg-input); border-radius: 4px; }
.el-changes-list, .el-preview-tweaks { list-style: none; padding: 0; margin: 0; font-family: var(--mono); font-size: 11px; }
.el-changes-list li, .el-preview-tweaks li { padding: 4px 0; border-bottom: 1px solid var(--border); }
.el-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.el-btn-primary, .el-btn-ghost { height: 32px; border-radius: 4px; font-size: 12px; cursor: pointer; border: 1px solid var(--border); }
.el-btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.el-btn-ghost { background: transparent; color: var(--text); }
.el-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.el-btn-primary:focus-visible, .el-btn-ghost:focus-visible { outline: 2px solid var(--focus); }
.el-feel-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.el-chip { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-input); font-size: 11px; cursor: pointer; color: var(--text); }
.el-chip.is-on { border-color: var(--coworker); background: var(--coworker-soft); color: var(--coworker); }
.el-hint { font-size: 10px; color: var(--muted); margin-top: 6px; }
.el-inline-error { color: var(--danger); font-size: 11px; }
.el-toolbar-row { margin-bottom: 8px; }
.el-hover-layer, .el-select-layer, .el-pin-layer { pointer-events: none; position: fixed; inset: 0; overflow: visible; }
.el-outline { position: fixed; pointer-events: none; box-sizing: border-box; }
.el-outline.hover { border: 1px solid var(--accent); }
.el-outline.sel { border: 2px solid var(--accent); }
.el-outline.inst { border: 2px dashed var(--accent); opacity: .85; }
.el-tag { position: fixed; pointer-events: none; padding: 2px 6px; font-size: 10px; background: var(--accent); color: #fff; border-radius: 2px; white-space: nowrap; max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
.el-pin { pointer-events: auto; position: fixed; width: 22px; height: 22px; border-radius: 11px; font-size: 11px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; cursor: pointer; border: 2px solid var(--coworker); }
.el-pin.open { background: var(--coworker); color: #fff; }
.el-pin.done { background: var(--bg-panel); color: var(--success); border-color: var(--success); }
.el-popover { pointer-events: auto; position: fixed; width: 260px; max-height: 320px; overflow: auto; padding: 12px;
  background: var(--bg-panel); border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,.12); z-index: 2; font-size: 12px; }
.el-popover-actions { display: flex; gap: 6px; margin-top: 8px; }
.el-popover-actions button { flex: 1; }
.el-popover .el-reply { margin-top: 8px; padding-left: 8px; border-left: 3px solid var(--coworker); color: var(--text); }
.el-toasts { pointer-events: none; position: fixed; bottom: 64px; right: 16px; }
.el-root.is-panel-open .el-toasts { right: 316px; bottom: 16px; }
.el-toasts { display: flex; flex-direction: column; gap: 8px; z-index: 3; }
.el-toast { pointer-events: auto; padding: 10px 12px; background: #1a1a1a; color: #fff; border-radius: 6px; font-size: 12px; max-width: 280px; display: flex; flex-direction: column; gap: 6px; }
@media (prefers-color-scheme: dark) { .el-toast { background: #f5f5f7; color: #1a1a1a; } }
.el-toast button { align-self: flex-start; background: transparent; border: 1px solid currentColor; color: inherit; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; }
.el-coach { pointer-events: auto; position: fixed; left: 16px; bottom: 16px; z-index: 7; width: 280px; padding: 12px;
  background: var(--bg-panel); color: var(--text); border: 1px solid var(--border); border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,.12); }
.el-coach[hidden] { display: none; }
.el-coach-kicker { margin: 0; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.el-coach-title { margin: 4px 0 0; font-weight: 600; font-size: 13px; }
.el-coach-body { margin: 6px 0 0; font-size: 12px; line-height: 1.4; }
.el-coach-actions { display: flex; gap: 8px; margin-top: 12px; }
.el-coach-actions button { flex: 1; }
.el-btn-tips { margin-top: 8px; width: 100%; }
`;
    shadowRoot.prepend(style);
  }

  function buildFeelChips() {
    els.feelChips.innerHTML = "";
    for (const word of FEEL_WORDS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "el-chip";
      b.textContent = word;
      b.dataset.feel = word;
      b.addEventListener("click", () => {
        if (state.feel.has(word)) state.feel.delete(word);
        else state.feel.add(word);
        b.classList.toggle("is-on", state.feel.has(word));
      });
      els.feelChips.appendChild(b);
    }
  }

  function renderChoiceChips() {
    const fill = (container, options, key) => {
      container.innerHTML = "";
      for (const opt of options) {
        const b = document.createElement("button");
        b.type = "button";
        const on = state[key] === opt.value;
        b.className = `el-chip${on ? " is-on" : ""}`;
        b.setAttribute("aria-pressed", String(on));
        b.dataset[key] = opt.value;
        b.textContent = opt.label;
        b.addEventListener("click", () => {
          state[key] = opt.value;
          renderChoiceChips();
        });
        container.appendChild(b);
      }
    };
    fill(els.scopeChips, SCOPES, "scope");
    fill(els.frameChips, FRAMES, "frame");
    renderScopeLine();
  }

  function renderScopeLine() {
    const el = state.selected;
    const n = el ? findInstances(el).length : 0;
    const blast = {
      this: "just this element",
      instances: `every one like this (×${n})`,
      component: el ? `the ${componentName(el)} component` : "the component",
      token: "the design token",
      frame: "this frame",
    }[state.scope];
    const frame = FRAMES.find((f) => f.value === state.frame)?.label;
    els.scopeLine.textContent = `Changes ${blast} · ${frame}`;
  }

  function toast(msg, action) {
    const t = document.createElement("div");
    t.className = "el-toast";
    t.textContent = msg;
    if (action) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = action.label;
      btn.addEventListener("click", () => {
        action.onClick();
        t.remove();
      });
      t.appendChild(btn);
    }
    els.toastStack.replaceChildren();
    els.toastStack.appendChild(t);
    while (els.toastStack.children.length > 3) els.toastStack.firstElementChild.remove();
    setTimeout(() => t.remove(), 8000);
  }

  function setTab(name) {
    state.activeTab = name;
    els.tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
    els.tabDesign.hidden = name !== "design";
    els.tabAsk.hidden = name !== "ask";
    els.tabBrief.hidden = name !== "brief";
    if (name === "brief" && canApply) loadBrief();
  }

  function updatePanelHeader(el) {
    if (!el) {
      els.panelHeader.innerHTML = `<span class="el-comp">No selection</span>`;
      return;
    }
    const comp = componentName(el);
    const tag = el.tagName.toLowerCase();
    const inst = findInstances(el).length;
    const stamp = parseStamp(el);
    const src = stamp ? `${stamp.file}:${stamp.line}` : "(no source stamp)";
    els.panelHeader.innerHTML = `
      <div class="el-comp">${escapeHtml(comp)} · ${escapeHtml(tag)} · ×${inst} instance${inst === 1 ? "" : "s"}</div>
      <div class="el-src">${escapeHtml(src)}</div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // --- design fields ---

  const STYLE_PROPS = [
    "color", "backgroundColor", "fontSize", "fontWeight", "lineHeight", "letterSpacing",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "marginTop", "marginRight", "marginBottom", "marginLeft",
    "borderRadius", "gap", "opacity",
  ];

  function renderDesignFields(el) {
    if (!el) {
      els.designFields.innerHTML = "";
      return;
    }
    const cs = getComputedStyle(el);
    const textNode = singleTextChild(el);
    let html = "";
    if (textNode) {
      html += fieldText(textNode.textContent.trim());
    } else {
      html += el.childElementCount === 0 && (el.textContent || "").trim()
        ? `<p class="el-note">text is dynamic here; ask the agent</p>`
        : "";
    }
    html += fieldColor("Color", "color", cs.color);
    html += fieldColor("Background", "backgroundColor", cs.backgroundColor);
    html += fieldNumber("Font size", "fontSize", cs.fontSize);
    html += fieldWeight(cs.fontWeight);
    html += fieldNumber("Line height", "lineHeight", cs.lineHeight);
    html += fieldNumber("Letter spacing", "letterSpacing", cs.letterSpacing);
    html += fieldBox("Padding", "padding", cs);
    html += fieldBox("Margin", "margin", cs);
    html += fieldNumber("Radius", "borderRadius", cs.borderRadius);
    html += fieldNumber("Gap", "gap", cs.gap);
    html += fieldNumber("Opacity", "opacity", cs.opacity);
    html += fieldClasses(el);
    els.designFields.innerHTML = html;
    bindDesignInputs(el);
    updateApplyState(el);
  }

  function fieldText(val) {
    return `<label class="el-field"><span class="el-label">Text</span>
      <input class="el-input" type="text" data-prop="textContent" value="${escapeHtml(val)}" /></label>`;
  }

  function fieldColor(label, prop, val) {
    const hex = rgbToHex(val);
    const transparent = val === "transparent" || /^rgba\(.*,\s*0\)$/.test(val);
    return `<label class="el-field"><span class="el-label">${label}</span>
      <div class="el-color-row"><input type="color" data-prop="${prop}" data-kind="color" value="${hex}" />
      <input class="el-input" type="text" data-prop="${prop}" data-kind="hex" value="${transparent ? "transparent" : hex}" /></div></label>`;
  }

  function fieldNumber(label, prop, val) {
    return `<label class="el-field"><span class="el-label" data-scrub="${prop}">${label}</span>
      <input class="el-input" type="text" data-prop="${prop}" data-kind="num" value="${escapeHtml(val)}" /></label>`;
  }

  function fieldWeight(val) {
    const opts = [300, 400, 500, 600, 700, 800]
      .map((w) => `<option value="${w}" ${val === String(w) ? "selected" : ""}>${w}</option>`)
      .join("");
    return `<label class="el-field"><span class="el-label">Font weight</span>
      <select class="el-select" data-prop="fontWeight">${opts}</select></label>`;
  }

  function fieldBox(label, prefix, cs) {
    const sides = ["Top", "Right", "Bottom", "Left"];
    const keys = sides.map((s) => `${prefix}${s}`);
    return `<div class="el-field"><span class="el-label">${label}</span><div class="el-row-4">
      ${keys.map((k, i) => `<input class="el-input" type="text" data-prop="${k}" data-kind="num" title="${sides[i]}" value="${escapeHtml(cs[k])}" />`).join("")}
    </div></div>`;
  }

  function fieldClasses(el) {
    if (typeof el.className !== "string") return "";
    const classes = state.classBase;
    const chips = classes
      .map((c) => {
        const off = state.classRemove.has(c);
        return `<button type="button" class="el-chip ${off ? "" : "is-on"}" data-class="${escapeHtml(c)}">${escapeHtml(c)}</button>`;
      })
      .join("");
    const added = [...state.classAdd].map((c) => `<button type="button" class="el-chip is-on" data-class-new="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");
    return `<div class="el-field"><span class="el-label">Classes</span><div class="el-class-chips">${chips}${added}</div>
      <input class="el-input el-class-add" type="text" placeholder="Add class" /></div>`;
  }

  function bindDesignInputs(el) {
    const applyToInstances = (fn) => {
      for (const inst of state.instances) fn(inst);
    };
    $$(".el-design-fields [data-prop]", els.designFields).forEach((input) => {
      const prop = input.dataset.prop;
      if (prop === "textContent") {
        input.addEventListener("input", () => {
          const node = singleTextChild(el);
          if (!node) return;
          const from = node.textContent;
          applyToInstances((inst) => setTextPreview(inst, input.value));
          trackChange("textContent", from.trim(), input.value.trim());
        });
        return;
      }
      const handler = () => {
        let value = input.value;
        if (input.dataset.kind === "color") value = input.value;
        if (input.dataset.kind === "hex") value = input.value;
        const cs = getComputedStyle(el);
        const from = cs[prop] || el.style[camelToKebab(prop)] || "";
        applyToInstances((inst) => setPreview(inst, prop, value));
        trackChange(prop, from, value, el);
        syncColorPair(prop);
      };
      input.addEventListener("input", handler);
      input.addEventListener("change", handler);
      if (input.dataset.kind === "num" || input.type === "text") {
        input.addEventListener("keydown", (e) => {
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const cur = parsePxNum(input.value);
          const next = e.key === "ArrowUp" ? cur + step : cur - step;
          const rawUnit = String(input.value).replace(/[-\d.]/g, "");
          const unit = rawUnit || (prop === "opacity" ? "" : "px");
          input.value = `${next}${unit}`;
          input.dispatchEvent(new Event("input"));
        });
      }
    });
    $$(".el-label[data-scrub]", els.designFields).forEach((label) => {
      const prop = label.dataset.scrub;
      const input = els.designFields.querySelector(`[data-prop="${prop}"]`);
      if (!input) return;
      let startX = 0;
      let startVal = 0;
      label.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startX = e.clientX;
        startVal = parsePxNum(input.value);
        const rawUnit = String(input.value).replace(/[-\d.]/g, "");
        const unit = rawUnit || (prop === "opacity" ? "" : "px");
        const move = (ev) => {
          const delta = Math.round((ev.clientX - startX) / 2);
          input.value = `${startVal + delta}${unit}`;
          input.dispatchEvent(new Event("input"));
        };
        const up = () => {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      });
    });
    $$(".el-class-chips [data-class]", els.designFields).forEach((chip) => {
      chip.addEventListener("click", () => {
        const name = chip.dataset.class;
        if (state.classRemove.has(name)) state.classRemove.delete(name);
        else state.classRemove.add(name);
        chip.classList.toggle("is-on", !state.classRemove.has(name));
        previewClasses();
        renderChanges();
      });
    });
    $$(".el-class-chips [data-class-new]", els.designFields).forEach((chip) => {
      chip.addEventListener("click", () => {
        state.classAdd.delete(chip.dataset.classNew);
        chip.remove();
        previewClasses();
        renderChanges();
      });
    });
    const addInput = els.designFields.querySelector(".el-class-add");
    if (addInput) {
      addInput.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const name = addInput.value.trim();
        if (!/^[A-Za-z0-9_-]+$/.test(name)) return;
        addInput.value = "";
        if (state.classBase.includes(name)) {
          state.classRemove.delete(name);
        } else {
          state.classAdd.add(name);
        }
        previewClasses();
        renderDesignFields(el);
        renderChanges();
      });
    }
  }

  function syncColorPair(prop) {
    const color = els.designFields.querySelector(`input[data-prop="${prop}"][data-kind="color"]`);
    const hex = els.designFields.querySelector(`input[data-prop="${prop}"][data-kind="hex"]`);
    if (color && hex && document.activeElement !== hex) hex.value = color.value;
    if (color && hex && document.activeElement === hex) color.value = rgbToHex(hex.value);
  }

  function renderChanges() {
    const keys = Object.keys(state.changes);
    if (!keys.length && !state.classAdd.size && !state.classRemove.size) {
      els.changesList.innerHTML = `<li class="el-muted" style="color:var(--muted)">No preview changes</li>`;
      els.previewTweaks.innerHTML = els.changesList.innerHTML;
      return;
    }
    const classBits = [
      ...[...state.classAdd].map((c) => `+${c}`),
      ...[...state.classRemove].map((c) => `−${c}`),
    ];
    const rows = [
      ...keys.map((k) => `<li>${escapeHtml(k)}: ${escapeHtml(state.changes[k].from)} → ${escapeHtml(state.changes[k].to)} <span class="el-hint">${escapeHtml(destLabel(k))}</span></li>`),
      ...classBits.map((c) => `<li>class ${escapeHtml(c)}</li>`),
    ];
    els.changesList.innerHTML = rows.join("");
    els.previewTweaks.innerHTML = els.changesList.innerHTML;
    if (state.selected) updateApplyState(state.selected);
  }

  function updateApplyState(el) {
    const stamp = el && parseStamp(el);
    const classPending = state.classAdd.size + state.classRemove.size > 0;
    const stylePending = Object.keys(state.changes).length > 0;
    const cssOnly = stylePending && Object.keys(state.changes).every((k) => k !== "textContent" && state.changeMeta[k]);
    els.applyBtn.disabled = !(canApply && (stamp || cssOnly) && (stylePending || classPending));
  }

  // --- selection / hover ---

  function selectElement(el) {
    if (!(el instanceof Element)) return;
    restorePreviews(state.previews);
    state.previews = new Map();
    els.errorInline.hidden = true;
    state.selected = el;
    state.instances = findInstances(el);
    state.changes = {};
    state.changeMeta = {};
    state.classAdd = new Set();
    state.classRemove = new Set();
    state.classBase = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean) : [];
    state.scope = state.instances.length > 1 ? "instances" : "this";
    renderChoiceChips();
    updatePanelHeader(el);
    renderDesignFields(el);
    renderChanges();
    scheduleMeasure();
  }

  function selectParent() {
    if (!state.selected?.parentElement) return;
    selectElement(state.selected.parentElement);
  }

  function clearSelection() {
    restorePreviews(state.previews);
    state.previews = new Map();
    state.changes = {};
    state.changeMeta = {};
    state.classAdd = new Set();
    state.classRemove = new Set();
    renderChanges();
    state.selected = null;
    state.instances = [];
    updatePanelHeader(null);
    renderScopeLine();
    renderDesignFields(null);
    clearOutlines(els.selectLayer);
    scheduleMeasure();
  }

  function setEditMode(on) {
    if (on && coachBlocksEdit(coachStored())) return;
    state.editMode = on;
    els.panel.hidden = !on;
    els.pill.classList.toggle("is-on", on);
    $(".el-root").classList.toggle("is-panel-open", on);
    if (!on) {
      clearSelection();
      state.hoverEl = null;
      clearOutlines(els.hoverLayer);
      clearOutlines(els.selectLayer);
      clearPins();
    } else {
      scheduleMeasure();
      renderPins();
    }
  }

  function clearOutlines(layer) {
    layer.innerHTML = "";
  }

  function drawOutline(layer, rect, className, label) {
    const box = document.createElement("div");
    box.className = `el-outline ${className}`;
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    layer.appendChild(box);
    if (label) {
      const tag = document.createElement("div");
      tag.className = "el-tag";
      tag.textContent = label;
      tag.style.left = `${rect.left}px`;
      tag.style.top = `${Math.max(0, rect.top - 20)}px`;
      layer.appendChild(tag);
    }
    return box;
  }

  function measureOverlays() {
    clearOutlines(els.hoverLayer);
    clearOutlines(els.selectLayer);
    if (state.editMode && state.hoverEl && state.hoverEl !== state.selected) {
      const r = state.hoverEl.getBoundingClientRect();
      drawOutline(els.hoverLayer, r, "hover", `${componentName(state.hoverEl)} · ${state.hoverEl.tagName.toLowerCase()}`);
    }
    if (state.selected) {
      const main = state.selected.getBoundingClientRect();
      const instN = state.instances.length;
      const lbl = `${componentName(state.selected)} · ${state.selected.tagName.toLowerCase()} · ×${instN} instance${instN === 1 ? "" : "s"}`;
      drawOutline(els.selectLayer, main, "sel", lbl);
      for (const inst of state.instances) {
        if (inst === state.selected) continue;
        drawOutline(els.selectLayer, inst.getBoundingClientRect(), "inst");
      }
    }
    if (state.editMode) layoutPins();
    state.rafId = 0;
  }

  function scheduleMeasure() {
    const need =
      state.editMode &&
      (state.hoverEl || state.selected || state.requests.size);
    if (!need) {
      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.rafId = 0;
      return;
    }
    if (state.rafId) return;
    state.rafId = requestAnimationFrame(measureOverlays);
  }

  function onScrollResize() {
    scheduleMeasure();
  }

  window.addEventListener("scroll", onScrollResize, true);
  window.addEventListener("resize", onScrollResize);

  // --- pins ---

  function requestsOnPage() {
    const path = location.pathname;
    return [...state.requests.values()].filter((r) => {
      if (!r.target?.url) return false;
      try {
        return new URL(r.target.url).pathname === path;
      } catch {
        return false;
      }
    });
  }

  function locateRequestEl(req) {
    const t = req.target;
    if (!t) return null;
    if (t.source?.file) {
      const sel = `[data-editlayer-source="${CSS.escape(`${t.source.file}:${t.source.line}:${t.source.column}`)}"]`;
      const hit = document.querySelector(sel);
      if (hit) return hit;
    }
    if (t.selector) {
      try {
        return document.querySelector(t.selector);
      } catch {
        return null;
      }
    }
    return null;
  }

  function renderPins() {
    clearPins();
    if (!state.editMode) return;
    const list = requestsOnPage();
    list.forEach((req, i) => {
      const el = locateRequestEl(req);
      if (!el) return;
      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = `el-pin ${req.status === "done" && req.author !== "agent" ? "done" : "open"}`;
      pin.textContent = req.author === "agent" ? "AI" : req.status === "done" ? "✓" : String(i + 1);
      pin.dataset.id = req.id;
      pin.addEventListener("click", (e) => {
        e.stopPropagation();
        showPopover(req, pin);
      });
      els.pinLayer.appendChild(pin);
      pin._targetEl = el;
    });
    layoutPins();
  }

  function clearPins() {
    els.pinLayer.innerHTML = "";
  }

  function layoutPins() {
    $$(".el-pin", els.pinLayer).forEach((pin) => {
      const el = pin._targetEl;
      if (!el?.isConnected) return;
      const r = el.getBoundingClientRect();
      pin.style.left = `${r.right - 8}px`;
      pin.style.top = `${r.top - 8}px`;
    });
  }

  function showPopover(req, pin) {
    const feel = (req.intent?.feel || []).map((f) => `<span class="el-chip is-on">${escapeHtml(f)}</span>`).join(" ");
    els.popover.hidden = false;
    els.popover.innerHTML = `
      <div><strong>${escapeHtml(req.status)}</strong></div>
      <p>${escapeHtml(req.text || "")}</p>
      ${feel ? `<div class="el-feel-chips">${feel}</div>` : ""}
      ${req.reply ? `<div class="el-reply">${escapeHtml(req.reply)}</div>` : ""}
      ${req.resolution === "revert" ? `<div><strong>Revert</strong></div>` : ""}
      <div class="el-hint">${escapeHtml(req.updated_at || req.created_at || "")}</div>
      <div class="el-popover-actions">
        <button type="button" class="el-btn-ghost" data-resolution="accept">Accept</button>
        <button type="button" class="el-btn-ghost" data-resolution="revert">Revert</button>
      </div>`;
    $$("[data-resolution]", els.popover).forEach((b) =>
      b.addEventListener("click", () => resolveRequest(req.id, b.dataset.resolution))
    );
    const r = pin.getBoundingClientRect();
    els.popover.style.left = `${Math.min(window.innerWidth - 270, r.left)}px`;
    els.popover.style.top = `${r.bottom + 8}px`;
  }

  function updatePillBadge() {
    const open = requestsOnPage().filter((r) => r.status === "open").length;
    els.pillBadge.hidden = open === 0;
    els.pillBadge.textContent = String(open);
  }

  function upsertRequest(req) {
    const prev = state.requests.get(req.id);
    state.requests.set(req.id, req);
    updatePillBadge();
    if (state.editMode) renderPins();
    const onThisPage = requestsOnPage().some((r) => r.id === req.id);
    if (onThisPage && prev && prev.status !== "done" && req.status === "done" && req.reply) {
      const snippet = req.reply.slice(0, 80);
      toast(`Agent: ${snippet}${req.reply.length > 80 ? "…" : ""}`);
    }
  }

  async function resolveRequest(id, resolution) {
    try {
      const res = await fetch(`${api}/page/requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "Update failed");
        return;
      }
      els.popover.hidden = true;
      if (data.request) upsertRequest(data.request);
      toast(resolution === "accept" ? "Accepted" : "Marked for revert");
    } catch (err) {
      toast(String(err.message || err));
    }
  }

  function coachStored() {
    try {
      return localStorage.getItem(ONBOARDING_KEY);
    } catch {
      return "done";
    }
  }

  function writeCoach(value) {
    try {
      localStorage.setItem(ONBOARDING_KEY, String(value));
    } catch {
      /* private mode or a blocked storage */
    }
  }

  function renderCoach(index) {
    const step = COACH_STEPS[index];
    if (!step || !state.sessionOn) {
      els.coach.hidden = true;
      return;
    }
    els.coach.hidden = false;
    els.coachKicker.textContent = `${index + 1} of ${COACH_STEPS.length}`;
    els.coachTitle.textContent = step.title;
    els.coachBody.textContent = step.body;
    els.coachNext.textContent = index === COACH_STEPS.length - 1 ? "Done" : "Next";
  }

  function openCoach() {
    const index = readCoach(coachStored());
    if (index == null || !state.sessionOn) {
      els.coach.hidden = true;
      return;
    }
    renderCoach(index);
  }

  function nextCoach() {
    const index = readCoach(coachStored());
    if (index == null) {
      els.coach.hidden = true;
      return;
    }
    const next = advanceCoach(index);
    writeCoach(next);
    if (next === "done") els.coach.hidden = true;
    else renderCoach(next);
  }

  function setDesignSession(on) {
    state.sessionOn = on;
    host.style.display = on ? "" : "none";
    if (!on) {
      els.popover.hidden = true;
      els.coach.hidden = true;
      if (state.editMode) setEditMode(false);
      return;
    }
    openCoach();
  }

  async function loadDesignSession() {
    try {
      const res = await fetch(`${api}/page/design-session`);
      if (!res.ok) throw new Error("bad status");
      const data = await res.json();
      setDesignSession(data.on !== false);
    } catch {
      setDesignSession(true);
    }
  }

  async function loadRequests() {
    try {
      const res = await fetch(`${api}/page/requests`);
      if (!res.ok) throw new Error("bad status");
      const data = await res.json();
      state.serverOnline = true;
      els.serverBanner.hidden = true;
      for (const r of data.requests || []) upsertRequest(r);
    } catch {
      state.serverOnline = false;
      els.serverBanner.hidden = false;
    }
  }

  function subscribeEvents() {
    try {
      const es = new EventSource(`${api}/page/events`);
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "request" && msg.request) upsertRequest(msg.request);
          else if (msg.type === "design-session") setDesignSession(msg.on !== false);
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        state.serverOnline = false;
        els.serverBanner.hidden = false;
      };
    } catch {
      state.serverOnline = false;
      els.serverBanner.hidden = false;
    }
  }

  // --- API actions ---

  async function applyChanges() {
    els.errorInline.hidden = true;
    const el = state.selected;
    const stamp = parseStamp(el);
    if (!canApply) return;
    const style = {};
    const css = [];
    const tokens = [];
    for (const [k, v] of Object.entries(state.changes)) {
      if (k === "textContent") continue;
      const o = state.changeMeta[k];
      if (o?.replaces) {
        if (state.scope !== "token") {
          els.errorInline.hidden = false;
          els.errorInline.textContent = TOKEN_APPLY_ERROR;
          return;
        }
        tokens.push({ file: o.css.file, name: o.replaces, value: v.to });
      } else if (o?.css) css.push({ file: o.css.file, selector: o.css.selector, property: o.css.property, value: v.to });
      else style[k] = v.to;
    }
    const body = {};
    if (stamp) body.source = stamp.raw;
    if (Object.keys(style).length) body.style = style;
    if (state.changes.textContent) body.text = state.changes.textContent.to;
    if (css.length) body.css = css;
    if (tokens.length) body.tokens = tokens;
    if (state.classAdd.size || state.classRemove.size) {
      body.className = { add: [...state.classAdd], remove: [...state.classRemove] };
    }
    if ((body.style || body.text || body.className) && !stamp) {
      els.errorInline.hidden = false;
      els.errorInline.textContent = "No source stamp on this element — try Ask agent";
      return;
    }
    if (!body.style && body.text === undefined && !body.css && !body.tokens && !body.className) return;
    try {
      const res = await fetch(fileEndpoint("apply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        els.errorInline.hidden = false;
        const msg = data.error || res.statusText;
        els.errorInline.textContent = /agent/i.test(msg) ? msg : `${msg} — try Ask agent`;
        return;
      }
      state.applied.push(state.previews);
      resetChanges();
      toast(data.summary || "Applied", {
        label: "Undo",
        onClick: () => undoApply(),
      });
    } catch (err) {
      els.errorInline.hidden = false;
      els.errorInline.textContent = String(err.message || err);
    }
  }

  async function undoApply() {
    try {
      const res = await fetch(fileEndpoint("undo"), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "Undo failed");
        return;
      }
      const previews = state.applied.pop();
      if (previews) restorePreviews(previews);
      if (state.selected) renderDesignFields(state.selected);
      toast("Undone");
    } catch (err) {
      toast(String(err.message || err));
    }
  }

  async function sendToAgent() {
    if (!state.selected) return;
    let text = els.askTextarea.value.trim();
    const feel = [...state.feel];
    const changes = { ...state.changes };
    if (!text && feel.length === 0 && !Object.keys(changes).length) {
      toast("Add a note, feel chip, or preview tweak");
      return;
    }
    if (!text) {
      const bits = [...feel, ...Object.keys(changes).map((k) => `${k}→${changes[k].to}`)];
      text = `Adjust: ${bits.join(", ")}`;
    }
    const payload = {
      text,
      target: buildTarget(state.selected),
      intent: { changes, feel, scope: state.scope, frame: state.frame },
    };
    try {
      const res = await fetch(`${api}/page/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "Send failed");
        return;
      }
      if (data.request) upsertRequest(data.request);
      toast("Queued for agent — auto-picks up in Cursor");
      setTab("design");
    } catch (err) {
      toast(String(err.message || err));
    }
  }

  async function loadBrief() {
    if (!canApply) return;
    try {
      const res = await fetch(fileEndpoint("brief"));
      const data = await res.json();
      els.briefArea.value = data.text || "";
      state.briefText = data.text || "";
    } catch {
      /* ignore */
    }
  }

  async function saveBrief() {
    if (!canApply) return;
    try {
      await fetch(fileEndpoint("brief"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: els.briefArea.value }),
      });
      toast("Brief saved");
    } catch (err) {
      toast(String(err.message || err));
    }
  }

  // --- event wiring ---

  function blockHostEvents(e) {
    if (!state.editMode) return;
    if (e.composedPath().includes(host)) return;
    if (e.type === "mousedown" || e.type === "pointerdown") {
      const t = elementFromPoint(e.clientX, e.clientY);
      if (t instanceof Element) {
        if (e.altKey) {
          if (state.selected) selectElement(state.selected.parentElement || t);
          else selectElement(t);
        } else {
          selectElement(t);
        }
      }
    }
    e.preventDefault();
    e.stopPropagation();
  }

  for (const type of ["pointerdown", "mousedown", "click", "submit"]) {
    window.addEventListener(type, blockHostEvents, true);
  }

  window.addEventListener(
    "mousemove",
    (e) => {
      if (!state.editMode) return;
      if (e.composedPath().includes(host)) return;
      state.hoverEl = elementFromPoint(e.clientX, e.clientY);
      scheduleMeasure();
    },
    true
  );

  window.addEventListener("keydown", (e) => {
    if (!state.sessionOn) return;
    if (coachBlocksEdit(coachStored())) return;
    if (e.key === "e" || e.key === "E") {
      if (isFormFocus()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      setEditMode(!state.editMode);
      return;
    }
    if (!state.editMode) return;
    if (e.key === "Escape") {
      if (state.selected) {
        clearSelection();
      } else {
        setEditMode(false);
      }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "z") {
      if (isFormFocus()) return;
      e.preventDefault();
      undoApply();
    }
  });

  els.askTextarea.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      sendToAgent();
    }
  });

  els.pill.addEventListener("click", () => {
    if (coachBlocksEdit(coachStored())) return;
    setEditMode(!state.editMode);
  });
  els.tabs.forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));
  els.selectParentBtn.addEventListener("click", selectParent);
  els.applyBtn.addEventListener("click", applyChanges);
  els.resetBtn.addEventListener("click", restoreAllPreviews);
  els.askAgentBtn.addEventListener("click", () => setTab("ask"));
  els.sendAgent.addEventListener("click", sendToAgent);
  els.briefSave.addEventListener("click", saveBrief);
  els.tipsBtn.addEventListener("click", () => {
    writeCoach(0);
    setEditMode(false);
    renderCoach(0);
  });
  els.coachNext.addEventListener("click", nextCoach);

  shadow.addEventListener("click", (e) => {
    if (!els.popover.hidden && !els.popover.contains(e.target)) {
      els.popover.hidden = true;
    }
  });

  renderChanges();
  loadDesignSession();
  loadRequests();
  subscribeEvents();
}
