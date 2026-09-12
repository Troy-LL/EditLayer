export const OVERLAY_MODES = ["A", "B", "C"];

export const OVERLAY_META = {
  A: {
    id: "A",
    label: "A",
    title: "A (default) — transform-only bugfix; flex/grid nest fails",
  },
  B: {
    id: "B",
    label: "B",
    title: "B (compare only) — select-time pin; not the lead",
  },
  C: {
    id: "C",
    label: "C",
    title: "C — positioned-trees-only (ships only if the product shrinks)",
  },
};

export function parseOverlayMode(value) {
  const key = String(value ?? "").trim().toUpperCase();
  return OVERLAY_MODES.includes(key) ? key : "A";
}

export function overlayFromSearch(search = "") {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return parseOverlayMode(new URLSearchParams(raw).get("overlay"));
}

export function writeOverlaySearch(mode, location = window.location) {
  const url = new URL(location.href);
  url.searchParams.set("overlay", parseOverlayMode(mode));
  return `${url.pathname}${url.search}${url.hash}`;
}
