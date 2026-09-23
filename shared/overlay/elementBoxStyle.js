import { applyPlacementToStyle } from "./placement.js";

export function buildBoxStyle(el, type) {
  const border =
    el.borderWidth > 0 ? `${el.borderWidth}px solid ${el.borderColor}` : "none";

  const style = {
    color: el.color,
    fontSize: `${el.fontSize}px`,
    backgroundColor: el.backgroundColor,
    opacity: el.opacity / 100,
    padding: `${el.padding}px`,
    margin: `0 0 ${el.marginBottom}px`,
    borderRadius: `${el.borderRadius}px`,
    border,
    textAlign: el.textAlign,
  };

  if (type === "link") {
    style.textDecoration = "underline";
    style.cursor = "pointer";
  }

  if (type === "button") {
    style.cursor = "pointer";
    style.textDecoration = "none";
    style.display = "inline-block";
    style.border = border === "none" ? "none" : border;
    style.fontWeight = 500;
  }

  if (type === "divider") {
    style.backgroundColor = "transparent";
    style.padding = 0;
    style.border = "none";
    style.display = "block";
  }

  if (type === "image") {
    style.display = "inline-block";
    style.lineHeight = 0;
  }

  if (el.width != null) {
    style.width = `${el.width}px`;
    if (type === "heading" || type === "paragraph" || type === "list") {
      style.whiteSpace = "normal";
      style.overflowWrap = "break-word";
      style.wordBreak = "break-word";
    }
  }
  if (el.height != null) {
    style.height = `${el.height}px`;
    if (type !== "image") {
      style.overflow = "hidden";
    }
  }

  applyPlacementToStyle(style, el);
  return style;
}
