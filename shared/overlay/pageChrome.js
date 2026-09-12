const PAGE_BACKGROUND_DEFAULT = "#ffffff";

const MARKETPLACE_GRADIENT = "linear-gradient(180deg, #f9fafb 0%, #ffffff 240px)";

export function pageChromeStyle(preset, pageBackground = PAGE_BACKGROUND_DEFAULT) {
  const marketplace = preset === "marketplace";
  return {
    position: "relative",
    boxSizing: "border-box",
    margin: "0 auto",
    padding: "48px 24px",
    maxWidth: marketplace ? "1040px" : "720px",
    minHeight: marketplace ? "640px" : "100vh",
    backgroundColor: pageBackground,
    ...(marketplace ? { backgroundImage: MARKETPLACE_GRADIENT } : {}),
  };
}
