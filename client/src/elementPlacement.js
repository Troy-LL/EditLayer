import { mergeElement } from "./elementDefaults.js";
import { isAlreadyOutOfFlow } from "../../shared/overlay/placement.js";

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
export function flowOriginClientPoint(elementEl, boardZoom = 1) {
  const style = window.getComputedStyle(elementEl);
  const z = boardZoom > 0 ? boardZoom : 1;
  if (style.position === "absolute") {
    const parent = elementEl.offsetParent;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      return { x: parentRect.left, y: parentRect.top };
    }
  }

  const rect = elementEl.getBoundingClientRect();
  const { x, y } = readTranslateOffset(elementEl);
  return { x: rect.left - x * z, y: rect.top - y * z };
}

/** Visual top-left in page-local coordinates (unzoomed artboard px). */
export function elementVisualPagePoint(elementEl, pageEl, boardZoom = 1) {
  const pageRect = pageEl.getBoundingClientRect();
  const rect = elementEl.getBoundingClientRect();
  const z = boardZoom > 0 ? boardZoom : 1;
  return {
    x: (rect.left - pageRect.left) / z,
    y: (rect.top - pageRect.top) / z,
  };
}

/** Visual top-left in client coordinates. */
export function elementVisualClientPoint(elementEl) {
  const rect = elementEl.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
}

/** Offsets from group visual origin, keyed by element id. */
export function captureVisualRelatives(pageEl, elementRefs, ids, boardZoom = 1) {
  const relatives = {};
  const visuals = {};

  for (const id of ids) {
    const el = elementRefs[id];
    if (!el || !pageEl) continue;
    visuals[id] = elementVisualPagePoint(el, pageEl, boardZoom);
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
/**
 * Final paste offsets in one write. `anchorPage` + relatives are page-local.
 * sourceVisual is the source's page-local top-left at copy/cut time.
 */
export function computeAtomicPasteOffsets({
  sources,
  copies,
  sourceVisuals,
  visualRelatives,
  anchorPage,
}) {
  return copies.map((copy, index) => {
    const source = sources[index];
    const rel = visualRelatives[source.id] ?? { x: 0, y: 0 };
    const srcVis = sourceVisuals[source.id] ?? { x: 0, y: 0 };
    const src = mergeElement(source);
    return {
      id: copy.id,
      offsetX: Math.round((src.offsetX ?? 0) + (anchorPage.x + rel.x - srcVis.x)),
      offsetY: Math.round((src.offsetY ?? 0) + (anchorPage.y + rel.y - srcVis.y)),
    };
  });
}

export function stampPasteOffset(overlay, copy, source, xy) {
  if (isAlreadyOutOfFlow(source)) {
    copy.offsetX = xy.offsetX;
    copy.offsetY = xy.offsetY;
    if (source.positioning) copy.positioning = source.positioning;
    return copy;
  }
  const patch = overlay.patchOffset(copy, xy);
  if (patch) Object.assign(copy, patch);
  return copy;
}

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
  boardZoom = 1,
) {
  if (!pageEl) return [];

  const z = boardZoom > 0 ? boardZoom : 1;
  const pageRect = pageEl.getBoundingClientRect();
  const anchorPageX = (anchorClient.x - pageRect.left) / z - originOffset;
  const anchorPageY = (anchorClient.y - pageRect.top) / z - originOffset;
  const updates = [];

  for (const id of ids) {
    const el = elementRefs[id];
    if (!el) continue;

    const rel = visualRelatives[id] ?? { x: 0, y: 0 };
    const targetClientX = pageRect.left + (anchorPageX + rel.x) * z;
    const targetClientY = pageRect.top + (anchorPageY + rel.y) * z;
    const flow = flowOriginClientPoint(el, z);

    updates.push({
      id,
      offsetX: Math.round((targetClientX - flow.x) / z),
      offsetY: Math.round((targetClientY - flow.y) / z),
    });
  }

  return updates;
}
