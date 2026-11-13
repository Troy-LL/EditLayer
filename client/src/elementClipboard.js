import { insertIntoTreeMany, setZOrderExtreme } from "./elementTree.js";

export function makeElementId(type) {
  return `${type}-${crypto.randomUUID().slice(0, 8)}`;
}

function assignNewIds(node) {
  node.id = makeElementId(node.type);
  if (Array.isArray(node.children)) {
    for (const child of node.children) assignNewIds(child);
  }
}

export function cloneForPaste(element) {
  const copy = structuredClone(element);
  assignNewIds(copy);
  copy.offsetX = 0;
  copy.offsetY = 0;
  delete copy.pin;
  delete copy.positioning;
  return copy;
}

/** One history entry, then one tree write. Undo once restores the pre-paste tree. */
export function commitPasteOrDuplicate(history, prev, copies, { parentId = null, afterId = null } = {}) {
  history.push(prev);
  let elements = insertIntoTreeMany(prev.elements, copies, { parentId, afterId });
  for (const copy of copies) {
    elements = setZOrderExtreme(elements, copy.id, "front");
  }
  return { ...prev, elements };
}
