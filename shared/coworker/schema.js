export const ELEMENT_TYPES = [
  "heading",
  "paragraph",
  "image",
  "button",
  "link",
  "divider",
  "list",
  "container",
];

const COLOR_RE = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8}|transparent|rgba?\([\d\s.,%]+\))$/i;

const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
const isNullableNumber = (v) => v === null || (isNumber(v) && v >= 0);
const isString = (v) => typeof v === "string";
const isBool = (v) => typeof v === "boolean";
const isColor = (v) => isString(v) && COLOR_RE.test(v.trim());
const oneOf = (...values) => (v) => values.includes(v);
const range = (min, max) => (v) => isNumber(v) && v >= min && v <= max;
const isStringArray = (v) => Array.isArray(v) && v.every(isString);

/** Field → [check, human description]. The single contract for humans, AI, and tests. */
export const FIELD_SPECS = {
  name: [isString, "string"],
  text: [isString, "string"],
  label: [isString, "string"],
  src: [isString, "string (URL)"],
  alt: [isString, "string"],
  href: [isString, "string (URL)"],
  target: [oneOf("_self", "_blank"), '"_self" | "_blank"'],
  objectFit: [oneOf("cover", "contain", "fill", "none"), '"cover" | "contain" | "fill" | "none"'],
  items: [isStringArray, "string[]"],
  ordered: [isBool, "boolean"],
  color: [isColor, "color (#hex, rgb(), transparent)"],
  backgroundColor: [isColor, "color (#hex, rgb(), transparent)"],
  borderColor: [isColor, "color (#hex, rgb(), transparent)"],
  dividerColor: [isColor, "color (#hex, rgb(), transparent)"],
  fontSize: [range(1, 400), "number 1–400 (px)"],
  opacity: [range(0, 100), "number 0–100"],
  padding: [range(0, 400), "number 0–400 (px)"],
  marginBottom: [range(-400, 400), "number (px)"],
  borderRadius: [range(0, 999), "number 0–999 (px)"],
  borderWidth: [range(0, 100), "number 0–100 (px)"],
  dividerThickness: [range(0, 100), "number 0–100 (px)"],
  textAlign: [oneOf("left", "center", "right"), '"left" | "center" | "right"'],
  offsetX: [isNumber, "number (px)"],
  offsetY: [isNumber, "number (px)"],
  width: [isNullableNumber, "number ≥ 0 or null (auto)"],
  height: [isNullableNumber, "number ≥ 0 or null (auto)"],
  hidden: [isBool, "boolean"],
  locked: [isBool, "boolean"],
  zIndex: [isNumber, "number"],
  positioning: [oneOf("flow", "pinned", "absolute"), '"flow" | "pinned" | "absolute"'],
  pin: [(v) => v && typeof v === "object", "{ width, height, marginBottom }"],
  level: [(v) => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 6, "integer 1–6 (heading level)"],
};

const STRUCTURAL = new Set(["id", "type", "children"]);

function fieldErrors(key, value, type) {
  if (key === "level" && type !== "heading") {
    return [`level is only valid on heading elements`];
  }
  const spec = FIELD_SPECS[key];
  if (!spec) return [`unknown field "${key}"`];
  const [check, desc] = spec;
  return check(value) ? [] : [`${key} must be ${desc} (got ${JSON.stringify(value)})`];
}

/** Errors for a partial element update. Unknown keys are rejected so agents can't invent fields. */
export function validateElementPatch(patch, type) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return ["patch must be an object"];
  return Object.entries(patch).flatMap(([key, value]) =>
    STRUCTURAL.has(key) ? [] : fieldErrors(key, value, type)
  );
}

export function validatePagePatch(patch) {
  if (!patch || typeof patch !== "object") return ["set must be an object"];
  return Object.entries(patch).flatMap(([key, value]) => {
    if (key !== "pageBackground") return [`unknown page field "${key}"`];
    return isColor(value) ? [] : [`pageBackground must be a color (got ${JSON.stringify(value)})`];
  });
}

/**
 * Whole-config validation. `errors` block a save; `warnings` (unknown keys) are
 * reported but tolerated so older saved configs keep loading.
 */
export function validateConfig(config) {
  const errors = [];
  const warnings = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { errors: ["config must be an object"], warnings };
  }
  if (!Array.isArray(config.elements)) {
    return { errors: ["config.elements must be an array"], warnings };
  }
  if (config.pageBackground != null && !isColor(config.pageBackground)) {
    errors.push(`pageBackground must be a color (got ${JSON.stringify(config.pageBackground)})`);
  }

  const seen = new Set();
  function walk(list, path) {
    list.forEach((el, i) => {
      const at = `${path}[${i}]`;
      if (!el || typeof el !== "object") {
        errors.push(`${at} must be an object`);
        return;
      }
      const label = el.id ? `${at} "${el.id}"` : at;
      if (typeof el.id !== "string" || !el.id) errors.push(`${at}.id is required`);
      else if (seen.has(el.id)) errors.push(`${label}: duplicate id`);
      else seen.add(el.id);
      if (!ELEMENT_TYPES.includes(el.type)) {
        errors.push(`${label}.type must be one of ${ELEMENT_TYPES.join(", ")}`);
      }
      for (const [key, value] of Object.entries(el)) {
        if (STRUCTURAL.has(key)) continue;
        if (!FIELD_SPECS[key]) {
          warnings.push(`${label}: unknown field "${key}"`);
          continue;
        }
        fieldErrors(key, value, el.type).forEach((msg) => errors.push(`${label}: ${msg}`));
      }
      if (el.children != null) {
        if (!Array.isArray(el.children)) errors.push(`${label}.children must be an array`);
        else if (el.type !== "container" && el.children.length) {
          errors.push(`${label}: only containers can have children`);
        } else walk(el.children, `${at}.children`);
      }
    });
  }
  walk(config.elements, "elements");
  return { errors, warnings };
}
