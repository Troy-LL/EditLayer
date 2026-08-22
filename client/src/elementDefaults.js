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
  heading: { text: "" },
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
    layout: null,
    direction: "column",
    gap: 12,
    alignItems: "stretch",
    justifyContent: "flex-start",
    overflowX: "visible",
    overflowY: "visible",
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
  grow: 0,
  shrink: 1,
  minWidth: null,
  maxWidth: null,
  minHeight: null,
  maxHeight: null,
};

export const PAGE_BACKGROUND_DEFAULT = "#ffffff";

export const BREAKPOINTS = [
  { id: "base", label: "Base", maxWidth: null },
  { id: "md", label: "Tablet", maxWidth: 1024 },
  { id: "sm", label: "Mobile", maxWidth: 640 },
];

export const RESPONSIVE_FIELDS = new Set([
  "offsetX",
  "offsetY",
  "width",
  "height",
  "fontSize",
  "color",
  "backgroundColor",
  "opacity",
  "padding",
  "marginBottom",
  "borderRadius",
  "borderWidth",
  "textAlign",
  "hidden",
]);

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

export function mergeElement(element, bp = "base") {
  const typeDefaults = TYPE_DEFAULTS[element.type] ?? {};
  const merged = { ...ELEMENT_DEFAULTS, ...typeDefaults, ...element };
  if (bp !== "base" && merged.responsive && typeof merged.responsive === "object") {
    const overrides = merged.responsive[bp];
    if (overrides && typeof overrides === "object") {
      for (const [key, value] of Object.entries(overrides)) {
        if (RESPONSIVE_FIELDS.has(key)) merged[key] = value;
      }
    }
  }
  if (merged.type === "container" && Array.isArray(merged.children)) {
    merged.children = merged.children.map((child) => mergeElement(child, bp));
  }
  return merged;
}

export function resolveElement(element, bp = "base") {
  const overrides = new Set();
  if (bp !== "base" && element.responsive && typeof element.responsive === "object") {
    const bpOverrides = element.responsive[bp];
    if (bpOverrides && typeof bpOverrides === "object") {
      for (const key of Object.keys(bpOverrides)) {
        if (RESPONSIVE_FIELDS.has(key)) overrides.add(key);
      }
    }
  }
  return { merged: mergeElement(element, bp), overrides };
}
