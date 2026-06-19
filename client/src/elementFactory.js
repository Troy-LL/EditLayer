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

export const PAGE_INSERT_ORIGIN_OFFSET = 24;

/** Client coordinates (e.g. mouse) → page-local offsetX/offsetY. */
export function clientPointToPageOffset(pageEl, point, originOffset = PAGE_INSERT_ORIGIN_OFFSET) {
  if (!pageEl || !point) return { offsetX: 0, offsetY: 0 };
  const rect = pageEl.getBoundingClientRect();
  return {
    offsetX: Math.round(point.x - rect.left - originOffset),
    offsetY: Math.round(point.y - rect.top - originOffset),
  };
}

/** Center of the visible scroll viewport in client coordinates. */
export function viewportCenterClientPoint(scrollEl) {
  if (!scrollEl) {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }
  const rect = scrollEl.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function insertOffsetFromPointer(pageEl, pointer) {
  if (!pageEl) return { offsetX: 0, offsetY: 0 };
  const pt = pointer ?? {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };
  return clientPointToPageOffset(pageEl, pt);
}

export function insertOffsetFromViewportCenter(pageEl, scrollEl) {
  return insertOffsetFromPointer(pageEl, viewportCenterClientPoint(scrollEl));
}
