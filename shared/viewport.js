export const VIEWPORT_IDS = ["desktop", "tablet", "phone"];

export const VIEWPORTS = {
  desktop: { id: "desktop", label: "Desktop", short: "Desk", width: null, browserWidth: 1280 },
  tablet: { id: "tablet", label: "Tablet", short: "Tab", width: 768, browserWidth: 768 },
  phone: { id: "phone", label: "Phone", short: "Phone", width: 390, browserWidth: 390 },
};

export const DEFAULT_VIEWPORT = "desktop";

export function normalizeViewport(id) {
  return VIEWPORTS[id] ? id : DEFAULT_VIEWPORT;
}

export function viewportMeta(id) {
  return VIEWPORTS[normalizeViewport(id)];
}

/** CSS max-width override; null means use the preset’s desktop frame width. */
export function viewportMaxWidthPx(id) {
  return viewportMeta(id).width;
}

/** Absolute frame width for canvas + HTML chrome (always a number). */
export function viewportFrameWidth(id, preset = "demo") {
  const fixed = viewportMaxWidthPx(id);
  if (fixed != null) return fixed;
  return preset === "marketplace" ? 1040 : 1280;
}

/** Playwright / look() browser viewport width. */
export function viewportBrowserWidth(id) {
  return viewportMeta(id).browserWidth;
}
