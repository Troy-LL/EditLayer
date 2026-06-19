import { mergeElement, ELEMENT_DEFAULTS } from "./elementDefaults.js";
import { makeElementId } from "./elementClipboard.js";

const TYPE_SEEDS = {
  heading: { text: "Heading", fontSize: 32 },
  paragraph: { text: "Paragraph", fontSize: 16 },
  image: { src: "", alt: "Image", width: 240, height: 160 },
  button: { label: "Button" },
  link: { text: "Link" },
  divider: { width: 320 },
  list: { items: ["Item one", "Item two", "Item three"] },
  container: { width: 320, height: 200, children: [] },
};

export const INSERTABLE_TYPES = [
  { type: "heading", label: "Heading" },
  { type: "paragraph", label: "Paragraph" },
  { type: "image", label: "Image" },
  { type: "button", label: "Button" },
  { type: "link", label: "Link" },
  { type: "divider", label: "Divider" },
  { type: "list", label: "List" },
  { type: "container", label: "Frame" },
];

export function createElement(type, overrides = {}) {
  const seed = TYPE_SEEDS[type] ?? {};
  return mergeElement({
    id: makeElementId(type),
    type,
    ...ELEMENT_DEFAULTS,
    ...seed,
    ...overrides,
  });
}

export function insertOffsetFromPointer(pageEl, pointer) {
  if (!pageEl) return { offsetX: 0, offsetY: 0 };
  const pt = pointer ?? {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };
  const rect = pageEl.getBoundingClientRect();
  return {
    offsetX: Math.round(pt.x - rect.left - 24),
    offsetY: Math.round(pt.y - rect.top - 24),
  };
}
