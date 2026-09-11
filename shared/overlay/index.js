import { overlayA } from "./prototypeA.js";
import { overlayB } from "./prototypeB.js";
import { overlayC } from "./prototypeC.js";
import { parseOverlayMode } from "./modes.js";

const BY_ID = { A: overlayA, B: overlayB, C: overlayC };

export function getOverlay(mode) {
  return BY_ID[parseOverlayMode(mode)];
}

export { overlayA, overlayB, overlayC };
export {
  OVERLAY_MODES,
  OVERLAY_META,
  parseOverlayMode,
  overlayFromSearch,
  writeOverlaySearch,
} from "./modes.js";
export {
  resolvePlacement,
  isAlreadyOutOfFlow,
  applyPlacementToStyle,
  pinFrameStyle,
  measurePinFromNode,
} from "./placement.js";
export { groupMoveableRoot } from "./moveableRoot.js";
