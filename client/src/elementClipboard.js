export function makeElementId(type) {
  return `${type}-${crypto.randomUUID().slice(0, 8)}`;
}

export function cloneForPaste(element, pastePoint, copyAnchor) {
  const copy = structuredClone(element);
  copy.id = makeElementId(element.type);
  if (copy.type === "container" && Array.isArray(copy.children)) {
    copy.children = copy.children.map((child) => {
      const cloned = structuredClone(child);
      cloned.id = makeElementId(child.type);
      return cloned;
    });
  }

  if (pastePoint && copyAnchor) {
    copy.offsetX = (element.offsetX ?? 0) + (pastePoint.x - copyAnchor.x);
    copy.offsetY = (element.offsetY ?? 0) + (pastePoint.y - copyAnchor.y);
  } else {
    copy.offsetX = (element.offsetX ?? 0) + 24;
    copy.offsetY = (element.offsetY ?? 0) + 24;
  }

  return copy;
}
