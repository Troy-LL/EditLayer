import { createContext, useContext } from "react";

import { mergeElement, ELEMENT_DEFAULTS } from "./elementDefaults.js";
import { makeElementId } from "./elementClipboard.js";

export const BreakpointContext = createContext("base");

export function useActiveBreakpoint() {
  return useContext(BreakpointContext);
}

export function getStackIndex(element) {
  return mergeElement(element).zIndex ?? 0;
}

/** Back → front (low zIndex first). */
function sortSiblingsBackToFront(list) {
  return [...list].sort((a, b) => getStackIndex(a) - getStackIndex(b));
}

/** Front at top for the layers panel. */
export function sortSiblingsForLayersPanel(list) {
  return sortSiblingsBackToFront(list).reverse();
}

function assignStackIndices(list, backToFrontIds) {
  const zById = new Map(backToFrontIds.map((id, i) => [id, i]));
  return list.map((el) => ({ ...el, zIndex: zById.get(el.id) ?? getStackIndex(el) }));
}

function stackOrderWithDragAtTarget(list, dragId, targetId) {
  const uiOrder = sortSiblingsBackToFront(list)
    .map((el) => el.id)
    .reverse();
  const dragUiIdx = uiOrder.indexOf(dragId);
  const targetUiIdx = uiOrder.indexOf(targetId);
  if (dragUiIdx < 0 || targetUiIdx < 0) return list;
  uiOrder.splice(dragUiIdx, 1);
  uiOrder.splice(targetUiIdx, 0, dragId);
  return assignStackIndices(list, [...uiOrder].reverse());
}

function shiftStackAmongSiblings(list, id, delta) {
  const backToFront = sortSiblingsBackToFront(list);
  const idx = backToFront.findIndex((el) => el.id === id);
  const nextIdx = idx + delta;
  if (idx < 0 || nextIdx < 0 || nextIdx >= backToFront.length) return list;
  const next = [...backToFront];
  [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
  return assignStackIndices(list, next.map((el) => el.id));
}

function setStackExtremeAmongSiblings(list, id, position) {
  const backToFront = sortSiblingsBackToFront(list);
  const idx = backToFront.findIndex((el) => el.id === id);
  if (idx < 0) return list;
  const next = [...backToFront];
  const [item] = next.splice(idx, 1);
  if (position === "front") next.push(item);
  else next.unshift(item);
  return assignStackIndices(list, next.map((el) => el.id));
}

function nextStackIndex(list) {
  if (!list.length) return 0;
  return list.reduce((max, el) => Math.max(max, getStackIndex(el)), -1) + 1;
}

function withNewElementStackIndex(list, element) {
  return { ...element, zIndex: element.zIndex ?? nextStackIndex(list) };
}

export function walkElements(elements, visit) {
  if (!Array.isArray(elements)) return;
  for (const el of elements) {
    visit(el);
    if (el.type === "container" && Array.isArray(el.children) && el.children.length) {
      walkElements(el.children, visit);
    }
  }
}

export function flattenElements(elements) {
  const out = [];
  walkElements(elements, (el) => out.push(el));
  return out;
}

export function findElementById(elements, id) {
  let found = null;
  walkElements(elements, (el) => {
    if (el.id === id) found = el;
  });
  return found;
}

function estimateSize(el) {
  const m = mergeElement(el);
  return {
    w: m.width ?? (el.type === "heading" ? 200 : el.type === "divider" ? m.width ?? 320 : 120),
    h: m.height ?? (el.type === "image" ? 160 : el.type === "divider" ? m.dividerThickness ?? 1 : 40),
  };
}

export function mapElements(elements, mapper) {
  if (!Array.isArray(elements)) return [];
  return elements.map((el) => {
    const next = mapper(el);
    if (next.type === "container" && Array.isArray(next.children)) {
      return { ...next, children: mapElements(next.children, mapper) };
    }
    return next;
  });
}

export function updateElementInTree(elements, id, changes) {
  return mapElements(elements, (el) => (el.id === id ? { ...el, ...changes } : el));
}

export function updateElementsInTree(elements, updates) {
  const byId = Object.fromEntries(updates.map((u) => [u.id, u]));
  return mapElements(elements, (el) => {
    const patch = byId[el.id];
    if (!patch) return el;
    const { id: _id, ...changes } = patch;
    return { ...el, ...changes };
  });
}

export function removeElementsFromTree(elements, ids) {
  const remove = new Set(ids);
  function filter(list) {
    return list
      .filter((el) => !remove.has(el.id))
      .map((el) => {
        if (el.type === "container" && Array.isArray(el.children)) {
          return { ...el, children: filter(el.children) };
        }
        return el;
      });
  }
  return filter(elements ?? []);
}

function buildContainerFromSiblings(siblings) {
  const cloned = siblings.map((el) => structuredClone(el));
  const merged = cloned.map((el) => mergeElement(el));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of merged) {
    const { w, h } = estimateSize(el);
    minX = Math.min(minX, el.offsetX);
    minY = Math.min(minY, el.offsetY);
    maxX = Math.max(maxX, el.offsetX + w);
    maxY = Math.max(maxY, el.offsetY + h);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 200;
    maxY = 120;
  }
  const children = cloned.map((el) => {
    const m = mergeElement(el);
    return {
      ...el,
      offsetX: m.offsetX - minX,
      offsetY: m.offsetY - minY,
    };
  });
  return mergeElement({
    id: makeElementId("container"),
    type: "container",
    ...ELEMENT_DEFAULTS,
    offsetX: minX,
    offsetY: minY,
    width: Math.max(maxX - minX, 40),
    height: Math.max(maxY - minY, 40),
    children,
    borderWidth: 1,
    borderColor: "#cccccc",
    backgroundColor: "rgba(0,0,0,0.02)",
  });
}

function groupSiblingsInList(list, ids) {
  const idSet = new Set(ids);
  const hits = list.filter((el) => idSet.has(el.id));
  if (hits.length < 2 || hits.length !== ids.length) return null;
  const container = buildContainerFromSiblings(hits);
  const next = [];
  let grouped = false;
  for (const el of list) {
    if (idSet.has(el.id)) {
      if (!grouped) {
        next.push(container);
        grouped = true;
      }
    } else {
      next.push(el);
    }
  }
  return next;
}

export function groupElements(elements, ids) {
  if (!ids.length || ids.length < 2) return elements;
  const idSet = new Set(ids);

  function walk(list) {
    const grouped = groupSiblingsInList(list, ids);
    if (grouped) return grouped;
    return list.map((el) => {
      if (el.type === "container" && Array.isArray(el.children)) {
        const children = walk(el.children);
        if (children !== el.children) return { ...el, children };
      }
      return el;
    });
  }

  const allFound = ids.every((id) => findElementById(elements, id));
  if (!allFound) return elements;
  return walk(elements ?? []);
}

export function ungroupContainer(elements, containerId) {
  function walk(list) {
    const next = [];
    for (const el of list) {
      if (el.id === containerId && el.type === "container") {
        const m = mergeElement(el);
        const lifted = (m.children ?? []).map((child) => {
          const c = mergeElement(child);
          return {
            ...child,
            offsetX: c.offsetX + m.offsetX,
            offsetY: c.offsetY + m.offsetY,
          };
        });
        next.push(...lifted);
        continue;
      }
      if (el.type === "container" && Array.isArray(el.children)) {
        next.push({ ...el, children: walk(el.children) });
      } else {
        next.push(el);
      }
    }
    return next;
  }
  const target = findElementById(elements, containerId);
  if (!target || target.type !== "container") return elements;
  return walk(elements ?? []);
}

export function alignChildrenInContainer(container, horizontal, vertical) {
  const m = mergeElement(container);
  if (m.type !== "container") return container;
  const cw = m.width ?? 200;
  const ch = m.height ?? 200;
  const children = (m.children ?? []).map((child) => {
    const c = mergeElement(child);
    const { w: ew, h: eh } = estimateSize(c);
    let offsetX = c.offsetX;
    let offsetY = c.offsetY;
    if (horizontal === "left") offsetX = 0;
    if (horizontal === "center") offsetX = Math.round((cw - ew) / 2);
    if (horizontal === "right") offsetX = Math.max(0, cw - ew);
    if (vertical === "top") offsetY = 0;
    if (vertical === "middle") offsetY = Math.round((ch - eh) / 2);
    if (vertical === "bottom") offsetY = Math.max(0, ch - eh);
    return { ...child, offsetX, offsetY };
  });
  return { ...container, children };
}

export function insertIntoRoot(elements, element, afterId) {
  const list = [...(elements ?? [])];
  const idx = afterId ? list.findIndex((el) => el.id === afterId) : -1;
  const insertAt = idx >= 0 ? idx + 1 : list.length;
  list.splice(insertAt, 0, withNewElementStackIndex(list, element));
  return list;
}

export function insertIntoRootMany(elements, newElements, afterId) {
  const list = [...(elements ?? [])];
  const idx = afterId ? list.findIndex((el) => el.id === afterId) : -1;
  const insertAt = idx >= 0 ? idx + 1 : list.length;
  let working = [...list];
  const stamped = newElements.map((el) => {
    const next = withNewElementStackIndex(working, el);
    working = [...working, next];
    return next;
  });
  list.splice(insertAt, 0, ...stamped);
  return list;
}

function reorderInList(list, fromIndex, toIndex) {
  if (fromIndex === toIndex) return list;
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function updateListContainingId(elements, id, updater) {
  const idx = elements.findIndex((el) => el.id === id);
  if (idx >= 0) {
    return updater(elements, idx);
  }
  return elements.map((el) => {
    if (el.type === "container" && Array.isArray(el.children) && el.children.length) {
      const children = updateListContainingId(el.children, id, updater);
      if (children !== el.children) return { ...el, children };
    }
    return el;
  });
}

export function shiftZOrder(elements, id, delta) {
  return updateListContainingId(elements ?? [], id, (list) => shiftStackAmongSiblings(list, id, delta));
}

/** Jump to first (back) or last (front) index among siblings. */
export function setZOrderExtreme(elements, id, position) {
  return updateListContainingId(elements ?? [], id, (list) =>
    setStackExtremeAmongSiblings(list, id, position)
  );
}

export function reorderElementInTree(elements, id, toIndex) {
  return updateListContainingId(elements ?? [], id, (list, idx) => {
    const clamped = Math.max(0, Math.min(toIndex, list.length - 1));
    return reorderInList(list, idx, clamped);
  });
}

export function insertIntoTree(elements, element, { parentId = null, afterId = null } = {}) {
  if (!parentId) {
    return insertIntoRoot(elements, element, afterId);
  }

  function update(list) {
    return list.map((el) => {
      if (el.id === parentId && el.type === "container") {
        const children = [...(el.children ?? [])];
        const idx = afterId ? children.findIndex((c) => c.id === afterId) : -1;
        children.splice(idx >= 0 ? idx + 1 : children.length, 0, withNewElementStackIndex(children, element));
        return { ...el, children };
      }
      if (el.type === "container" && Array.isArray(el.children) && el.children.length) {
        const children = update(el.children);
        if (children !== el.children) return { ...el, children };
      }
      return el;
    });
  }

  return update(elements ?? []);
}

export function elementBaseName(element) {
  const m = mergeElement(element);
  if (m.name?.trim()) return m.name.trim();
  if (m.type === "heading" && m.text?.trim()) return m.text.trim().slice(0, 40);
  if (m.type === "paragraph" && m.text?.trim()) return m.text.trim().slice(0, 40);
  if (m.type === "button") return m.label?.trim() || "Button";
  if (m.type === "link") return m.text?.trim() || "Link";
  const labels = {
    image: "Image",
    divider: "Divider",
    list: "List",
    container: "Frame",
    heading: "Heading",
    paragraph: "Paragraph",
  };
  return labels[m.type] ?? m.type;
}

export function elementDisplayName(element) {
  return elementBaseName(element);
}

/** Per sibling list: disambiguate duplicate labels as "Frame (1)", "Frame (2)", … */
export function buildLayerLabelMap(elements) {
  const map = new Map();

  function labelSiblings(list) {
    if (!Array.isArray(list) || !list.length) return;
    const bases = list.map((el) => elementBaseName(el));
    const totals = new Map();
    for (const base of bases) {
      totals.set(base, (totals.get(base) ?? 0) + 1);
    }
    const seen = new Map();
    for (const el of list) {
      const base = elementBaseName(el);
      if ((totals.get(base) ?? 0) > 1) {
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        map.set(el.id, `${base} (${n})`);
      } else {
        map.set(el.id, base);
      }
    }
  }

  function walk(list) {
    labelSiblings(list);
    for (const el of list) {
      if (el.type === "container" && Array.isArray(el.children) && el.children.length) {
        walk(el.children);
      }
    }
  }

  walk(elements ?? []);
  return map;
}

/** True if this container is selected or contains a selected element. */
export function isContainerOnSelectionPath(element, selectedIds) {
  if (element.type !== "container" || !selectedIds.length) return false;
  if (selectedIds.includes(element.id)) return true;
  for (const id of selectedIds) {
    let found = false;
    walkElements(element.children ?? [], (el) => {
      if (el.id === id) found = true;
    });
    if (found) return true;
  }
  return false;
}

export function isElementLocked(elements, id) {
  const el = findElementById(elements, id);
  return el ? mergeElement(el).locked : false;
}

export function moveElementBefore(elements, dragId, targetId) {
  if (dragId === targetId) return elements;

  function tryList(list) {
    const hasDrag = list.some((el) => el.id === dragId);
    const hasTarget = list.some((el) => el.id === targetId);
    if (!hasDrag || !hasTarget) return null;
    return stackOrderWithDragAtTarget(list, dragId, targetId);
  }

  function walk(list) {
    const reordered = tryList(list);
    if (reordered) return reordered;
    return list.map((el) => {
      if (el.type === "container" && Array.isArray(el.children) && el.children.length) {
        const children = walk(el.children);
        if (children !== el.children) return { ...el, children };
      }
      return el;
    });
  }

  return walk(elements ?? []);
}

export function collectElementsByIds(elements, ids) {
  const idSet = new Set(ids);
  return flattenElements(elements).filter((el) => idSet.has(el.id));
}

function getElementRect(el) {
  const m = mergeElement(el);
  const { w, h } = estimateSize(el);
  return {
    left: m.offsetX,
    top: m.offsetY,
    right: m.offsetX + w,
    bottom: m.offsetY + h,
    width: w,
    height: h,
    centerX: m.offsetX + w / 2,
    centerY: m.offsetY + h / 2,
  };
}

function selectionBounds(rects) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    minX = Math.min(minX, rect.left);
    minY = Math.min(minY, rect.top);
    maxX = Math.max(maxX, rect.right);
    maxY = Math.max(maxY, rect.bottom);
  }
  if (!Number.isFinite(minX)) {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
  }
  return {
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

export function findParentOfElement(elements, childId, parent = null) {
  if (!Array.isArray(elements)) return null;
  for (const el of elements) {
    if (el.id === childId) return parent;
    if (el.type === "container" && Array.isArray(el.children) && el.children.length) {
      const found = findParentOfElement(el.children, childId, el);
      if (found) return found;
    }
  }
  return null;
}

function findSiblingListContaining(elements, ids) {
  const idSet = new Set(ids);

  function tryList(list) {
    const hits = list.filter((el) => idSet.has(el.id));
    return hits.length === ids.length ? list : null;
  }

  function walk(list) {
    const found = tryList(list);
    if (found) return found;
    for (const el of list) {
      if (el.type === "container" && Array.isArray(el.children) && el.children.length) {
        const childFound = walk(el.children);
        if (childFound) return childFound;
      }
    }
    return null;
  }

  return walk(elements ?? []);
}

function getAbsoluteOffset(elements, id) {
  function walk(list, parentX, parentY) {
    for (const el of list) {
      const m = mergeElement(el);
      const ax = parentX + m.offsetX;
      const ay = parentY + m.offsetY;
      if (el.id === id) return { x: ax, y: ay, element: el };
      if (el.type === "container" && Array.isArray(el.children) && el.children.length) {
        const found = walk(el.children, ax, ay);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(elements ?? [], 0, 0);
}

/**
 * Align selected elements within selection bounds (multi) or parent frame (single).
 * @param {object[]} elements
 * @param {string[]} ids
 * @param {{ horizontal?: 'left'|'center'|'right', vertical?: 'top'|'middle'|'bottom' }} alignment
 */
export function alignSelectedElements(elements, ids, { horizontal, vertical } = {}) {
  if (!ids.length || (!horizontal && !vertical)) return elements;

  const selected = collectElementsByIds(elements, ids);
  if (!selected.length) return elements;

  let reference = null;

  if (selected.length === 1) {
    const parent = findParentOfElement(elements, ids[0]);
    if (parent?.type === "container") {
      const pm = mergeElement(parent);
      const pw = pm.width ?? 200;
      const ph = pm.height ?? 200;
      reference = { left: 0, top: 0, right: pw, bottom: ph, width: pw, height: ph, centerX: pw / 2, centerY: ph / 2 };
    } else {
      reference = getElementRect(selected[0]);
    }
  } else {
    reference = selectionBounds(selected.map((el) => getElementRect(el)));
  }

  const updates = selected.map((el) => {
    const rect = getElementRect(el);
    const patch = { id: el.id };
    if (horizontal === "left") patch.offsetX = Math.round(reference.left);
    if (horizontal === "center") patch.offsetX = Math.round(reference.centerX - rect.width / 2);
    if (horizontal === "right") patch.offsetX = Math.round(reference.right - rect.width);
    if (vertical === "top") patch.offsetY = Math.round(reference.top);
    if (vertical === "middle") patch.offsetY = Math.round(reference.centerY - rect.height / 2);
    if (vertical === "bottom") patch.offsetY = Math.round(reference.bottom - rect.height);
    return patch;
  });

  return updateElementsInTree(elements, updates);
}

/**
 * Distribute 3+ selected elements with equal spacing on an axis.
 * @param {object[]} elements
 * @param {string[]} ids
 * @param {'horizontal'|'vertical'} axis
 */
export function distributeSelectedElements(elements, ids, axis) {
  if (ids.length < 3) return elements;

  const selected = collectElementsByIds(elements, ids);
  if (selected.length < 3) return elements;

  const items = selected.map((el) => ({ id: el.id, rect: getElementRect(el) }));

  if (axis === "horizontal") {
    items.sort((a, b) => a.rect.left - b.rect.left);
    const first = items[0].rect;
    const last = items[items.length - 1].rect;
    const totalSpan = last.right - first.left;
    const totalWidth = items.reduce((sum, item) => sum + item.rect.width, 0);
    const gap = (totalSpan - totalWidth) / (items.length - 1);
    let cursor = first.left;
    const updates = items.map((item) => {
      const offsetX = Math.round(cursor);
      cursor += item.rect.width + gap;
      return { id: item.id, offsetX };
    });
    return updateElementsInTree(elements, updates);
  }

  items.sort((a, b) => a.rect.top - b.rect.top);
  const first = items[0].rect;
  const last = items[items.length - 1].rect;
  const totalSpan = last.bottom - first.top;
  const totalHeight = items.reduce((sum, item) => sum + item.rect.height, 0);
  const gap = (totalSpan - totalHeight) / (items.length - 1);
  let cursor = first.top;
  const updates = items.map((item) => {
    const offsetY = Math.round(cursor);
    cursor += item.rect.height + gap;
    return { id: item.id, offsetY };
  });
  return updateElementsInTree(elements, updates);
}

const SNAP_THRESHOLD = 5;
const GRID_SIZE = 8;

function snapToGrid(value) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function snap1D(offset, size, targetValues, threshold) {
  const edges = [offset, offset + size / 2, offset + size];
  let bestOffset = offset;
  let bestDist = threshold + 1;

  for (const target of targetValues) {
    for (const edge of edges) {
      const dist = Math.abs(edge - target);
      if (dist <= threshold && dist < bestDist) {
        bestDist = dist;
        bestOffset = offset + (target - edge);
      }
    }
  }

  return Math.round(bestOffset);
}

function getSnapTargetsForElement(elements, elementId, excludeIds) {
  const exclude = new Set(excludeIds);
  const parent = findParentOfElement(elements, elementId);
  const siblings = parent ? mergeElement(parent).children ?? [] : elements ?? [];
  const xTargets = [];
  const yTargets = [];

  for (const sib of siblings) {
    if (exclude.has(sib.id)) continue;
    const rect = getElementRect(sib);
    xTargets.push(rect.left, rect.right, rect.centerX);
    yTargets.push(rect.top, rect.bottom, rect.centerY);
  }

  if (parent?.type === "container") {
    const pm = mergeElement(parent);
    const pw = pm.width ?? 200;
    const ph = pm.height ?? 200;
    xTargets.push(0, pw, pw / 2);
    yTargets.push(0, ph, ph / 2);
  }

  return { xTargets, yTargets };
}

function snapElementOffset(elements, elementId, offsetX, offsetY, excludeIds, { elementSnap, gridSnap }) {
  const el = findElementById(elements, elementId);
  if (!el) return { offsetX, offsetY };

  const rect = getElementRect(el);
  let nextX = offsetX;
  let nextY = offsetY;

  if (elementSnap) {
    const { xTargets, yTargets } = getSnapTargetsForElement(elements, elementId, excludeIds);
    nextX = snap1D(nextX, rect.width, xTargets, SNAP_THRESHOLD);
    nextY = snap1D(nextY, rect.height, yTargets, SNAP_THRESHOLD);
  }

  if (gridSnap) {
    nextX = snapToGrid(nextX);
    nextY = snapToGrid(nextY);
  }

  return { offsetX: nextX, offsetY: nextY };
}

/**
 * Nudge elements by dx/dy with optional snap (matches drag snap toggles).
 */
export function nudgeElements(elements, ids, dx, dy, { snapEnabled = false, gridSnapEnabled = false } = {}) {
  if (!ids.length) return elements;

  const exclude = new Set(ids);
  const useSnap = snapEnabled || gridSnapEnabled;

  return updateElementsInTree(
    elements,
    ids.map((id) => {
      const el = findElementById(elements, id);
      if (!el) return { id, offsetX: 0, offsetY: 0 };
      const merged = mergeElement(el);
      let offsetX = merged.offsetX + dx;
      let offsetY = merged.offsetY + dy;

      if (useSnap) {
        const snapped = snapElementOffset(elements, id, offsetX, offsetY, exclude, {
          elementSnap: snapEnabled,
          gridSnap: gridSnapEnabled,
        });
        offsetX = snapped.offsetX;
        offsetY = snapped.offsetY;
      }

      return { id, offsetX, offsetY };
    })
  );
}

/**
 * Group selection; lifts cross-parent elements to root first.
 * @returns {{ elements: object[], containerId: string|null }}
 */
export function reparentAndGroup(elements, ids) {
  if (ids.length < 2) return { elements, containerId: null };

  if (findSiblingListContaining(elements, ids)) {
    const prevIds = new Set(flattenElements(elements).map((el) => el.id));
    const next = groupElements(elements, ids);
    const container = flattenElements(next).find((el) => el.type === "container" && !prevIds.has(el.id));
    return { elements: next, containerId: container?.id ?? null };
  }

  const lifted = [];
  for (const id of ids) {
    const abs = getAbsoluteOffset(elements, id);
    if (!abs) continue;
    lifted.push({
      ...structuredClone(abs.element),
      offsetX: abs.x,
      offsetY: abs.y,
    });
  }

  if (lifted.length < 2) return { elements, containerId: null };

  let tree = removeElementsFromTree(elements, ids);
  const container = buildContainerFromSiblings(lifted);
  tree = insertIntoRoot(tree, container);
  return { elements: tree, containerId: container.id };
}

/** Stable signature of stack order across the element tree (changes on z-order, not document flow). */
export function elementsLayoutKey(elements) {
  const parts = [];
  function walk(list) {
    if (!Array.isArray(list)) return;
    parts.push(list.map((el) => `${el.id}:${getStackIndex(el)}`).join(","));
    for (const el of list) {
      if (el.type === "container" && Array.isArray(el.children) && el.children.length) {
        walk(el.children);
      }
    }
  }
  walk(elements ?? []);
  return parts.join("|");
}
