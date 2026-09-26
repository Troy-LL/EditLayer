import { DEFAULT_VIEWPORT, normalizeViewport, viewportFrameWidth } from "../viewport.js";

const PAGE_BACKGROUND_DEFAULT = "#ffffff";

const MARKETPLACE_GRADIENT = "linear-gradient(180deg, #f9fafb 0%, #ffffff 240px)";

export function pageChromeStyle(
  preset,
  pageBackground = PAGE_BACKGROUND_DEFAULT,
  viewport = DEFAULT_VIEWPORT
) {
  const marketplace = preset === "marketplace";
  const vp = normalizeViewport(viewport);
  const frameWidth = viewportFrameWidth(vp, preset);
  const padding = vp === "phone" ? "32px 16px" : "48px 24px";

  return {
    position: "relative",
    boxSizing: "border-box",
    margin: "0 auto",
    padding,
    maxWidth: `${frameWidth}px`,
    width: "100%",
    minHeight: marketplace ? "640px" : "100vh",
    overflowX: "clip",
    backgroundColor: pageBackground,
    ...(marketplace ? { backgroundImage: MARKETPLACE_GRADIENT } : {}),
  };
}

export { PAGE_BACKGROUND_DEFAULT };
