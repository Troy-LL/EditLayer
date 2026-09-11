import { resolvePlacement } from "./placement.js";

/**
 * Prototype A — Transform-only gesture.
 * Drag/resize writes translate (and width/height) only.
 * In-flow nodes commit as positioning:"flow" so siblings stay in document flow.
 * Already-absolute / pinned trees keep their model (marketplace cards).
 */
export const overlayA = {
  id: "A",
  patchOffset(el, next) {
    const placement = resolvePlacement(el);
    if (placement === "absolute" || placement === "pinned") {
      return { ...next };
    }
    return { ...next, positioning: "flow" };
  },
  measureSelectPin() {
    return null;
  },
  commitSelectPin() {
    return {};
  },
  canClaimHandles() {
    return true;
  },
  canEditOffset() {
    return true;
  },
  moveableRoot(node) {
    return node?.parentElement ?? null;
  },
};
