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
