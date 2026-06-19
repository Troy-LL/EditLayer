import { mergeElement, ELEMENT_DEFAULTS } from "./elementDefaults.js";
import { makeElementId } from "./elementClipboard.js";

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
  list.splice(insertAt, 0, element);
  return list;
}

export function insertIntoRootMany(elements, newElements, afterId) {
  const list = [...(elements ?? [])];
  const idx = afterId ? list.findIndex((el) => el.id === afterId) : -1;
  const insertAt = idx >= 0 ? idx + 1 : list.length;
  list.splice(insertAt, 0, ...newElements);
  return list;
}

export function collectElementsByIds(elements, ids) {
  const idSet = new Set(ids);
  return flattenElements(elements).filter((el) => idSet.has(el.id));
}
