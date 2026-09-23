const SHARED_DEFAULTS = {
  color: "#1a1a1a",
  fontSize: 16,
  backgroundColor: "transparent",
  opacity: 100,
  padding: 0,
  marginBottom: 20,
  borderRadius: 0,
  borderWidth: 0,
  borderColor: "#000000",
  textAlign: "left",
  offsetX: 0,
  offsetY: 0,
  width: null,
  height: null,
};

const TYPE_DEFAULTS = {
  heading: { text: "", level: 1 },
  paragraph: { text: "" },
  image: {
    src: "",
    alt: "",
    objectFit: "cover",
    width: 240,
    height: 160,
  },
  button: {
    label: "Button",
    href: "",
    target: "_self",
    fontSize: 14,
    color: "#ffffff",
    backgroundColor: "#2563eb",
    padding: 10,
    borderRadius: 6,
  },
  link: {
    text: "Link",
    href: "",
    target: "_self",
    color: "#2563eb",
    fontSize: 16,
  },
  divider: {
    dividerThickness: 1,
    dividerColor: "#cccccc",
    width: 320,
    height: null,
    marginBottom: 24,
  },
  list: {
    items: ["Item one", "Item two"],
    ordered: false,
  },
  container: {
    children: [],
    width: 320,
    height: 200,
    backgroundColor: "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: "#cccccc",
    padding: 8,
  },
};

export const ELEMENT_DEFAULTS = {
  text: "",
  ...SHARED_DEFAULTS,
  src: "",
  alt: "",
  objectFit: "cover",
  label: "",
  href: "",
  target: "_self",
  dividerThickness: 1,
  dividerColor: "#cccccc",
  items: [],
  ordered: false,
  children: [],
  name: "",
  hidden: false,
  locked: false,
  zIndex: 0,
};

export const PAGE_BACKGROUND_DEFAULT = "#ffffff";

function ensureZIndices(elements) {
  if (!Array.isArray(elements)) return [];
  return elements.map((el, i) => {
    const next = { ...el, zIndex: el.zIndex ?? i };
    if (el.type === "container" && Array.isArray(el.children) && el.children.length) {
      next.children = ensureZIndices(el.children);
    }
    return next;
  });
}

export function mergeConfig(config) {
  if (!config || typeof config !== "object") {
    return { pageBackground: PAGE_BACKGROUND_DEFAULT, elements: [] };
  }
  return {
    pageBackground: config.pageBackground ?? PAGE_BACKGROUND_DEFAULT,
    elements: ensureZIndices(Array.isArray(config.elements) ? config.elements : []),
  };
}

/** Clamp heading level to 1–6 (default 1). */
export function headingTagLevel(element) {
  const n = element?.level ?? 1;
  if (typeof n !== "number" || !Number.isFinite(n)) return 1;
  return Math.min(6, Math.max(1, Math.round(n)));
}

export function mergeElement(element) {
  const typeDefaults = TYPE_DEFAULTS[element.type] ?? {};
  const merged = { ...ELEMENT_DEFAULTS, ...typeDefaults, ...element };
  if (merged.type === "container" && Array.isArray(merged.children)) {
    merged.children = merged.children.map(mergeElement);
  }
  return merged;
}
