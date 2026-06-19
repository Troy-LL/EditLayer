import { mergeElement } from "./elementDefaults.js";

export const PLACEMENT_ORIGIN_OFFSET = 24;
/** Offset each paste away from the copy origin when the pointer is not over the source. */
export const PASTE_STEP_OFFSET = 24;
/** Nudge context-menu paste off the click point so it is not under the cursor. */
export const PASTE_CURSOR_NUDGE = 12;
/** In-frame duplicate/paste stack step (px) — each layer shifts down-right. */
export const STACK_NUDGE = 12;

export function groupOriginClientPoint(elementRefs, ids) {
  const points = ids
    .map((id) => elementRefs[id])
    .filter(Boolean)
    .map(elementVisualClientPoint);
  if (!points.length) return null;
  return {
    x: Math.min(...points.map((p) => p.x)),
    y: Math.min(...points.map((p) => p.y)),
  };
}

export function readTranslateOffset(elementEl) {
  const transform = window.getComputedStyle(elementEl).transform;
  if (!transform || transform === "none") return { x: 0, y: 0 };
  const matrix = new DOMMatrixReadOnly(transform);
  return { x: matrix.m41, y: matrix.m42 };
}

/** Document-flow origin in client coordinates (translate stripped). */
export function flowOriginClientPoint(elementEl) {
  const style = window.getComputedStyle(elementEl);
  if (style.position === "absolute") {
    const parent = elementEl.offsetParent;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      return { x: parentRect.left, y: parentRect.top };
    }
  }

  const rect = elementEl.getBoundingClientRect();
  const { x, y } = readTranslateOffset(elementEl);
  return { x: rect.left - x, y: rect.top - y };
}

/** Visual top-left in page-local coordinates. */
export function elementVisualPagePoint(elementEl, pageEl) {
  const pageRect = pageEl.getBoundingClientRect();
  const rect = elementEl.getBoundingClientRect();
  return {
    x: rect.left - pageRect.left,
    y: rect.top - pageRect.top,
  };
}

/** Visual top-left in client coordinates. */
export function elementVisualClientPoint(elementEl) {
  const rect = elementEl.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
}

/** Offsets from group visual origin, keyed by element id. */
export function captureVisualRelatives(pageEl, elementRefs, ids) {
  const relatives = {};
  const visuals = {};

  for (const id of ids) {
    const el = elementRefs[id];
    if (!el || !pageEl) continue;
    visuals[id] = elementVisualPagePoint(el, pageEl);
  }

  const values = Object.values(visuals);
  if (!values.length) return relatives;

  const originX = Math.min(...values.map((v) => v.x));
  const originY = Math.min(...values.map((v) => v.y));

  for (const id of ids) {
    const visual = visuals[id];
    if (!visual) continue;
    relatives[id] = { x: visual.x - originX, y: visual.y - originY };
  }

  return relatives;
}

export function isClientPointInElementsFrame(point, elementRefs, ids) {
  if (!point) return false;
  return ids.some((id) => {
    const el = elementRefs[id];
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom;
  });
}

/** Shift clones down-right from their sources for a visible stack (generation 1 = one step). */
export function applyStackNudgeToCopies(sources, copies, generation) {
  const delta = STACK_NUDGE * generation;
  sources.forEach((source, i) => {
    const m = mergeElement(source);
    copies[i].offsetX = (m.offsetX ?? 0) + delta;
    copies[i].offsetY = (m.offsetY ?? 0) + delta;
  });
}

/**
 * Given elements already in the DOM, compute offsetX/Y so each lands at
 * anchorClient + its visualRelatives entry (page-local deltas from group origin).
 */
export function computePlacementOffsets(
  pageEl,
  elementRefs,
  ids,
  anchorClient,
  visualRelatives,
  originOffset = PLACEMENT_ORIGIN_OFFSET,
) {
  if (!pageEl) return [];

  const pageRect = pageEl.getBoundingClientRect();
  const anchorPageX = anchorClient.x - pageRect.left - originOffset;
  const anchorPageY = anchorClient.y - pageRect.top - originOffset;
  const updates = [];

  for (const id of ids) {
    const el = elementRefs[id];
    if (!el) continue;

    const rel = visualRelatives[id] ?? { x: 0, y: 0 };
    const targetClientX = pageRect.left + anchorPageX + rel.x;
    const targetClientY = pageRect.top + anchorPageY + rel.y;
    const flow = flowOriginClientPoint(el);

    updates.push({
      id,
      offsetX: Math.round(targetClientX - flow.x),
      offsetY: Math.round(targetClientY - flow.y),
    });
  }

  return updates;
}
