import { mergeElement, PAGE_BACKGROUND_DEFAULT } from "../elementDefaults.js";
import { validateConfig } from "./schema.js";

const TEXT_TYPES = new Set(["heading", "paragraph", "link", "button", "list"]);
const MIN_FONT_SIZE = 12;
const MIN_TAP_HEIGHT = 24;
const LINE_HEIGHT = 1.2;
const WEIGHTS = { error: 15, warn: 5, info: 1 };

export function parseColor(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const [r, g, b, a = "1"] = m[1].split(",").map((s) => s.trim());
    return { r: +r, g: +g, b: +b, a: +a };
  }
  return null;
}

function over(top, bottom) {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

function luminance({ r, g, b }) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toHex({ r, g, b }) {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Shift `fg` toward black or white (whichever the background needs) until it passes. */
function nearestPassingInk(fg, bg, target) {
  const toward = luminance(bg) > 0.18 ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const mixed = over({ ...toward, a: t }, fg);
    const hex = toHex(mixed);
    if (contrastRatio(parseColor(hex), bg) >= target) return hex;
  }
  return toHex(toward);
}

function estimatedButtonHeight(el) {
  if (el.height != null) return el.height;
  return el.fontSize * LINE_HEIGHT + el.padding * 2 + el.borderWidth * 2;
}

function isLargeText(el, type) {
  return type === "heading" ? el.fontSize >= 18.66 : el.fontSize >= 24;
}

function finding(rule, severity, elementId, message, fix) {
  return {
    id: `${rule}:${elementId ?? "page"}`,
    rule,
    severity,
    elementId: elementId ?? null,
    message,
    ...(fix ? { fix } : {}),
  };
}

function reviewElement(raw, backdrop, out) {
  const el = mergeElement(raw);
  if (el.hidden) return;
  const id = raw.id;
  const type = raw.type;
  const label = el.name || id;
  const fill = parseColor(el.backgroundColor) ?? { r: 0, g: 0, b: 0, a: 0 };
  const surface = over(fill, backdrop);

  if (TEXT_TYPES.has(type)) {
    const ink = parseColor(el.color);
    if (ink) {
      const opacity = Math.max(0, Math.min(1, el.opacity / 100));
      const effectiveInk = over({ ...over(ink, surface), a: opacity }, backdrop);
      const effectiveBg = over({ ...surface, a: opacity }, backdrop);
      const ratio = contrastRatio(effectiveInk, effectiveBg);
      const target = isLargeText(el, type) ? 3 : 4.5;
      if (ratio < target) {
        const severity = ratio < 3 ? "error" : "warn";
        const fixColor = opacity === 1 ? nearestPassingInk(ink, surface, target + 0.05) : null;
        out.push(
          finding(
            "contrast",
            severity,
            id,
            `${label}: text contrast ${ratio.toFixed(2)}:1 is below ${target}:1 (WCAG AA)`,
            fixColor ? [{ op: "update", id, set: { color: fixColor } }] : undefined
          )
        );
      }
    }
    if (el.fontSize < MIN_FONT_SIZE) {
      out.push(
        finding("min-font-size", "warn", id, `${label}: ${el.fontSize}px text is hard to read`, [
          { op: "update", id, set: { fontSize: MIN_FONT_SIZE } },
        ])
      );
    }
  }

  const emptyText = (s) => typeof s !== "string" || !s.trim();
  if ((type === "heading" || type === "paragraph" || type === "link") && emptyText(el.text)) {
    out.push(finding("empty-content", "warn", id, `${label}: ${type} has no text`));
  }
  if (type === "button" && emptyText(el.label)) {
    out.push(finding("empty-content", "warn", id, `${label}: button has no label`));
  }
  if (type === "list" && !(el.items ?? []).some((item) => !emptyText(item))) {
    out.push(finding("empty-content", "warn", id, `${label}: list has no items`));
  }
  if (type === "container" && !(el.children ?? []).length) {
    out.push(finding("empty-content", "info", id, `${label}: frame is empty`));
  }

  if (type === "image") {
    if (emptyText(el.src)) {
      out.push(finding("image-alt", "warn", id, `${label}: image has no src (renders a placeholder)`));
    } else if (emptyText(el.alt)) {
      out.push(finding("image-alt", "warn", id, `${label}: image has no alt text`));
    }
  }

  if (type === "button") {
    const height = estimatedButtonHeight(el);
    if (height < MIN_TAP_HEIGHT) {
      const padding = Math.ceil((MIN_TAP_HEIGHT - el.fontSize * LINE_HEIGHT - el.borderWidth * 2) / 2);
      out.push(
        finding(
          "tap-target",
          "warn",
          id,
          `${label}: button is ~${Math.round(height)}px tall (min ${MIN_TAP_HEIGHT}px)`,
          el.height == null ? [{ op: "update", id, set: { padding: Math.max(padding, el.padding) } }] : [
            { op: "update", id, set: { height: MIN_TAP_HEIGHT } },
          ]
        )
      );
    }
  }

  if ((type === "button" || type === "link") && emptyText(el.href)) {
    out.push(finding("link-href", "info", id, `${label}: ${type} has no href`));
  }

  if (type === "container") {
    for (const child of raw.children ?? []) reviewElement(child, surface, out);
  }
}

export function scoreFindings(findings) {
  const penalty = findings.reduce((sum, f) => sum + (WEIGHTS[f.severity] ?? 0), 0);
  return Math.max(0, 100 - penalty);
}

/**
 * Review a page config. Pure and deterministic — the same call backs `npm test`,
 * the server's GET /page/review, and the AI co-worker's review tool.
 */
export function reviewConfig(config) {
  const findings = [];
  const { errors } = validateConfig(config);
  errors.forEach((message, i) => findings.push({ ...finding("schema", "error", null, message), id: `schema:${i}` }));
  if (!errors.length) {
    const page = parseColor(config.pageBackground ?? PAGE_BACKGROUND_DEFAULT) ?? parseColor("#ffffff");
    const backdrop = over(page, { r: 255, g: 255, b: 255, a: 1 });
    for (const el of config.elements) reviewElement(el, backdrop, findings);
  }
  const counts = { error: 0, warn: 0, info: 0 };
  findings.forEach((f) => {
    counts[f.severity] += 1;
  });
  return { score: scoreFindings(findings), counts, findings };
}

export function fixOpsFor(findings, { rules } = {}) {
  return findings
    .filter((f) => f.fix && (!rules || rules.includes(f.rule)))
    .flatMap((f) => f.fix);
}
