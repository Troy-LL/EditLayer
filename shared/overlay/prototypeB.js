import { isAlreadyOutOfFlow, measurePinFromNode } from "./placement.js";

/**
 * Prototype B — Select-time positioned.
 * On select, measure a spacer (containing block) BEFORE any gesture.
 * Inner node is then absolute inside that pin; first-pixel drag does not
 * pull siblings out of flow. Commit writes pin + positioning:"pinned".
 */
export const overlayB = {
  id: "B",
  patchOffset(el, next) {
    const pin = el.pin;
    if (pin || el.positioning === "pinned") {
      return { ...next, positioning: "pinned", ...(pin ? { pin } : {}) };
    }
    if (isAlreadyOutOfFlow(el)) {
      return { ...next };
    }
    // No spacer yet — do not write pinned-without-pin (that is page-level absolute).
    return { ...next, positioning: "flow" };
  },
  measureSelectPin(el, node) {
    if (!node || el.pin || isAlreadyOutOfFlow(el)) return null;
    return measurePinFromNode(node, el);
  },
  commitSelectPin(el, livePin) {
    if (el.pin || !livePin) return {};
    return { pin: livePin, positioning: "pinned" };
  },
  canClaimHandles() {
    return true;
  },
  canEditOffset() {
    return true;
  },
  moveableRoot(node) {
    return node?.closest?.("[data-overlay-pin]") ?? node?.parentElement ?? null;
  },
};
