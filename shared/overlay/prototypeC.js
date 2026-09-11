import { isAlreadyOutOfFlow } from "./placement.js";

const FLOW_TEXT = new Set(["heading", "paragraph"]);

/**
 * Prototype C — Positioned-trees-only.
 * Handles (and inspector X/Y) only on nodes already out of flow.
 * Flow text is selectable for style, not free-drag. Honest narrower product.
 */
export const overlayC = {
  id: "C",
  patchOffset(el, next) {
    if (!isAlreadyOutOfFlow(el)) return null;
    return { ...next };
  },
  measureSelectPin() {
    return null;
  },
  commitSelectPin() {
    return {};
  },
  canClaimHandles(el) {
    if (!el) return false;
    if (FLOW_TEXT.has(el.type) && !isAlreadyOutOfFlow(el)) return false;
    return isAlreadyOutOfFlow(el);
  },
  canEditOffset(el) {
    return isAlreadyOutOfFlow(el);
  },
  moveableRoot(node) {
    return node?.parentElement ?? null;
  },
};
