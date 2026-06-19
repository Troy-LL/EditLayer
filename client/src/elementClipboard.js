export function makeElementId(type) {
  return `${type}-${crypto.randomUUID().slice(0, 8)}`;
}

export function cloneForPaste(element) {
  const copy = structuredClone(element);
  copy.id = makeElementId(element.type);
  copy.offsetX = 0;
  copy.offsetY = 0;
  if (copy.type === "container" && Array.isArray(copy.children)) {
    copy.children = copy.children.map((child) => {
      const cloned = structuredClone(child);
      cloned.id = makeElementId(child.type);
      return cloned;
    });
  }
  return copy;
}
