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
};

export function mergeElement(element) {
  const typeDefaults = TYPE_DEFAULTS[element.type] ?? {};
  const merged = { ...ELEMENT_DEFAULTS, ...typeDefaults, ...element };
  if (merged.type === "container" && Array.isArray(merged.children)) {
    merged.children = merged.children.map(mergeElement);
  }
  return merged;
}
