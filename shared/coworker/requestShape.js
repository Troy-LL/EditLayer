export const FEEL_WORDS = new Set([
  "tighter",
  "airier",
  "subtler",
  "bolder",
  "sharper",
  "softer",
  "calmer",
  "livelier",
  "premium",
  "playful",
]);

export const SCOPE_IDS = ["this", "instances", "component", "token", "frame"];
export const FRAME_IDS = ["desktop", "tablet", "phone"];
export const AUTHOR_IDS = ["human", "agent"];

const TARGET_KEYS = new Set([
  "url",
  "selector",
  "source",
  "component",
  "tag",
  "text",
  "instances",
  "rect",
  "styles",
]);

const CAMEL_CSS_RE = /^[a-z][a-zA-Z0-9]*$/;
const MAX_TEXT = 2000;
const MAX_CHANGES = 30;
const MAX_FEEL = 8;
const MAX_FEEL_FREE = 24;

function isPositiveInt(v) {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function safeRelativePath(file) {
  if (typeof file !== "string") return null;
  const trimmed = file.trim();
  if (!trimmed || trimmed.includes("..") || trimmed.startsWith("/") || /^[a-zA-Z]:/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function sanitizeSource(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { ok: false, error: "target.source must be an object with file, line, and column" };
  }
  const file = safeRelativePath(source.file);
  if (!file) return { ok: false, error: "target.source.file must be a relative path without .." };
  if (!isPositiveInt(source.line)) return { ok: false, error: "target.source.line must be a positive integer" };
  if (!isPositiveInt(source.column)) return { ok: false, error: "target.source.column must be a positive integer" };
  return { ok: true, value: { file, line: source.line, column: source.column } };
}

function sanitizeRect(rect) {
  if (!rect || typeof rect !== "object" || Array.isArray(rect)) return null;
  const { x, y, width, height } = rect;
  if (![x, y, width, height].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return { x, y, width, height };
}

function sanitizeStyles(styles) {
  if (!styles || typeof styles !== "object" || Array.isArray(styles)) return null;
  const out = {};
  for (const [k, v] of Object.entries(styles)) {
    if (typeof v === "string") out[k] = v.slice(0, 200);
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeTarget(raw) {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "target must be an object" };
  }
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!url) return { ok: false, error: "target.url is required" };

  const out = { url: url.slice(0, 2000) };
  if (raw.source != null) {
    const src = sanitizeSource(raw.source);
    if (!src.ok) return src;
    out.source = src.value;
  }
  if (typeof raw.selector === "string" && raw.selector.trim()) {
    out.selector = raw.selector.trim().slice(0, 500);
  }
  if (typeof raw.component === "string" && raw.component.trim()) {
    out.component = raw.component.trim().slice(0, 120);
  }
  if (typeof raw.tag === "string" && raw.tag.trim()) {
    out.tag = raw.tag.trim().slice(0, 40);
  }
  if (typeof raw.text === "string" && raw.text.trim()) {
    out.text = raw.text.trim().slice(0, 500);
  }
  if (typeof raw.instances === "number" && Number.isInteger(raw.instances) && raw.instances > 0) {
    out.instances = raw.instances;
  }
  const rect = sanitizeRect(raw.rect);
  if (rect) out.rect = rect;
  const styles = sanitizeStyles(raw.styles);
  if (styles) out.styles = styles;

  for (const key of Object.keys(raw)) {
    if (!TARGET_KEYS.has(key)) {
      // dropped unknown keys
    }
  }
  return { ok: true, value: out };
}

function sanitizeIntent(raw) {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "intent must be an object" };
  }

  const out = {};
  if (raw.changes != null) {
    if (typeof raw.changes !== "object" || Array.isArray(raw.changes)) {
      return { ok: false, error: "intent.changes must be an object" };
    }
    const entries = Object.entries(raw.changes);
    if (entries.length > MAX_CHANGES) {
      return { ok: false, error: `intent.changes has at most ${MAX_CHANGES} keys` };
    }
    const changes = {};
    for (const [key, val] of entries) {
      if (!CAMEL_CSS_RE.test(key)) {
        return { ok: false, error: `intent.changes key "${key}" must be camelCase` };
      }
      if (!val || typeof val !== "object" || Array.isArray(val)) {
        return { ok: false, error: `intent.changes.${key} must be { from, to }` };
      }
      if (typeof val.from !== "string" || typeof val.to !== "string") {
        return { ok: false, error: `intent.changes.${key} from and to must be strings` };
      }
      changes[key] = { from: val.from.slice(0, 200), to: val.to.slice(0, 200) };
    }
    if (Object.keys(changes).length) out.changes = changes;
  }

  if (raw.feel != null) {
    if (!Array.isArray(raw.feel)) return { ok: false, error: "intent.feel must be an array" };
    if (raw.feel.length > MAX_FEEL) {
      return { ok: false, error: `intent.feel has at most ${MAX_FEEL} items` };
    }
    const feel = [];
    for (const item of raw.feel) {
      if (typeof item !== "string") return { ok: false, error: "intent.feel items must be strings" };
      const word = item.trim().toLowerCase();
      if (!word) continue;
      if (!FEEL_WORDS.has(word) && word.length > MAX_FEEL_FREE) {
        return { ok: false, error: `intent.feel item "${item}" must be a FEEL_WORD or at most ${MAX_FEEL_FREE} characters` };
      }
      feel.push(word.slice(0, MAX_FEEL_FREE));
    }
    if (feel.length) out.feel = feel;
  }

  if (raw.scope != null) {
    if (!SCOPE_IDS.includes(raw.scope)) {
      return { ok: false, error: "intent.scope must be this, instances, component, token, or frame" };
    }
    out.scope = raw.scope;
  }

  if (raw.frame != null) {
    if (!FRAME_IDS.includes(raw.frame)) {
      return { ok: false, error: "intent.frame must be desktop, tablet, or phone" };
    }
    out.frame = raw.frame;
  }

  return { ok: true, value: Object.keys(out).length ? out : null };
}

/**
 * Validate POST /page/requests body. Drops unknown keys on target/intent.
 * @returns {{ ok: true, value: { text, elementId, target, intent, author } } | { ok: false, error: string }}
 */
export function validateRequestInput({ text, elementId, target, intent, author } = {}) {
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, error: "text is required" };
  }
  const trimmedText = text.trim().slice(0, MAX_TEXT);

  let normalizedElementId = null;
  if (elementId != null) {
    if (typeof elementId !== "string" || !elementId.trim()) {
      return { ok: false, error: "elementId must be a non-empty string" };
    }
    normalizedElementId = elementId.trim().slice(0, 120);
  }

  const hasTarget = target != null && typeof target === "object";
  if (normalizedElementId && hasTarget) {
    return { ok: false, error: "elementId and target are mutually exclusive" };
  }

  const targetResult = sanitizeTarget(hasTarget ? target : null);
  if (!targetResult.ok) return targetResult;

  const intentResult = sanitizeIntent(intent);
  if (!intentResult.ok) return intentResult;

  let normalizedAuthor = "human";
  if (author != null) {
    if (!AUTHOR_IDS.includes(author)) {
      return { ok: false, error: 'author must be "human" or "agent"' };
    }
    normalizedAuthor = author;
  }

  return {
    ok: true,
    value: {
      text: trimmedText,
      elementId: normalizedElementId,
      target: targetResult.value,
      intent: intentResult.value,
      author: normalizedAuthor,
    },
  };
}
