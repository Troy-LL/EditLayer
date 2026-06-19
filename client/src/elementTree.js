import { mergeElement, ELEMENT_DEFAULTS } from "./elementDefaults.js";
import { makeElementId } from "./elementClipboard.js";

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
