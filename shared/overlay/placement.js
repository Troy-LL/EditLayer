/** Placement is a persist-time fact on the element, not the live overlay prototype. */

export function resolvePlacement(el) {
  const ox = el?.offsetX ?? 0;
  const oy = el?.offsetY ?? 0;
  if (el?.positioning === "flow") return "flow";
  if (el?.positioning === "pinned" || el?.pin) return "pinned";
  if (el?.positioning === "absolute") return "absolute";
  if (ox !== 0 || oy !== 0) return "absolute";
  return "flow";
}

export function isAlreadyOutOfFlow(el) {
  const placement = resolvePlacement(el);
  return placement === "absolute" || placement === "pinned";
}

export function applyPlacementToStyle(style, el) {
  const ox = el.offsetX ?? 0;
  const oy = el.offsetY ?? 0;
  const placement = resolvePlacement(el);
  style.zIndex = el.zIndex ?? 0;

  if (placement === "absolute" || placement === "pinned") {
    style.position = "absolute";
    style.left = 0;
    style.top = 0;
    style.transform = `translate(${ox}px, ${oy}px)`;
    style.marginBottom = 0;
    return style;
  }

  style.position = "relative";
  if (ox !== 0 || oy !== 0) {
    style.transform = `translate(${ox}px, ${oy}px)`;
  }
  return style;
}

export function pinFrameStyle(pin) {
  return {
    position: "relative",
    width: `${pin.width}px`,
    height: `${pin.height}px`,
    margin: `0 0 ${pin.marginBottom ?? 0}px`,
    boxSizing: "border-box",
  };
}

export function measurePinFromNode(node, el) {
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
    marginBottom: el?.marginBottom ?? 0,
  };
}
