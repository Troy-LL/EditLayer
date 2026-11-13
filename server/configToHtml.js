import { buildBoxStyle } from "../shared/overlay/elementBoxStyle.js";
import { pageChromeStyle } from "../shared/overlay/pageChrome.js";
import { pinFrameStyle, resolvePlacement } from "../shared/overlay/placement.js";
import { headingTagLevel, mergeElement, PAGE_BACKGROUND_DEFAULT } from "../shared/elementDefaults.js";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function styleObjectToString(style) {
  return Object.entries(style)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => {
      const prop = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      return `${prop}:${v}`;
    })
    .join(";");
}

function buildStyle(el, type) {
  return buildBoxStyle(el, type);
}

function wrapPinned(html, el) {
  if (resolvePlacement(el) !== "pinned") return html;
  const pin = el.pin ?? { width: el.width ?? 1, height: el.height ?? 1, marginBottom: el.marginBottom ?? 0 };
  const wrap = styleObjectToString(pinFrameStyle(pin));
  return `<div class="overlay-pin" data-overlay-pin="" style="${escapeHtml(wrap)}">${html}</div>`;
}

function renderElement(element) {
  const el = mergeElement(element);
  if (el.hidden) return "";

  const style = styleObjectToString(buildStyle(el, element.type));
  const styleAttr = style ? ` style="${escapeHtml(style)}"` : "";
  const out = renderElementInner(element, el, styleAttr);
  return wrapPinned(out, el);
}

function renderElementInner(element, el, styleAttr) {
  if (element.type === "heading") {
    const tag = `h${headingTagLevel(el)}`;
    return `<${tag}${styleAttr}>${escapeHtml(el.text)}</${tag}>`;
  }

  if (element.type === "paragraph") {
    return `<p${styleAttr}>${escapeHtml(el.text)}</p>`;
  }

  if (element.type === "image") {
    const imgStyle = styleObjectToString({
      width: "100%",
      height: el.height != null ? "100%" : "auto",
      objectFit: el.objectFit,
      display: "block",
      borderRadius: `${el.borderRadius}px`,
    });
    const inner = el.src
      ? `<img src="${escapeHtml(el.src)}" alt="${escapeHtml(el.alt)}" style="${escapeHtml(imgStyle)}" />`
      : `<div style="height:${el.height ?? 160}px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#888;font-size:13px;">No image</div>`;
    return `<div${styleAttr}>${inner}</div>`;
  }

  if (element.type === "button") {
    const label = escapeHtml(el.label);
    if (el.href) {
      const rel = el.target === "_blank" ? ' rel="noopener noreferrer"' : "";
      return `<a href="${escapeHtml(el.href)}" target="${escapeHtml(el.target)}"${rel}${styleAttr}>${label}</a>`;
    }
    return `<button type="button"${styleAttr}>${label}</button>`;
  }

  if (element.type === "link") {
    const text = escapeHtml(el.text);
    if (el.href) {
      const rel = el.target === "_blank" ? ' rel="noopener noreferrer"' : "";
      return `<a href="${escapeHtml(el.href)}" target="${escapeHtml(el.target)}"${rel}${styleAttr}>${text}</a>`;
    }
    return `<span${styleAttr}>${text}</span>`;
  }

  if (element.type === "divider") {
    const lineStyle = styleObjectToString({
      height: `${el.dividerThickness}px`,
      backgroundColor: el.dividerColor,
      width: "100%",
      borderRadius: "1px",
    });
    return `<div${styleAttr} aria-hidden="true"><div style="${escapeHtml(lineStyle)}"></div></div>`;
  }

  if (element.type === "list") {
    const tag = el.ordered ? "ol" : "ul";
    const items = (el.items ?? [])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
    return `<${tag}${styleAttr}>${items}</${tag}>`;
  }

  if (element.type === "container") {
    const containerStyle = { ...buildStyle(el, "container"), boxSizing: "border-box" };
    if (containerStyle.position !== "absolute") {
      containerStyle.position = "relative";
    }
    if (el.height == null) {
      containerStyle.minHeight = "40px";
    }
    const containerStyleStr = styleObjectToString(containerStyle);
    const children = (el.children ?? []).map(renderElement).join("\n    ");
    return `<div class="element-container" style="${escapeHtml(containerStyleStr)}">\n    ${children}\n  </div>`;
  }

  return `<p${styleAttr}>${escapeHtml(el.text ?? "")}</p>`;
}

export function configToHtml(config, { preset = "demo" } = {}) {
  const pageBackground = config?.pageBackground ?? PAGE_BACKGROUND_DEFAULT;
  const elements = Array.isArray(config?.elements) ? config.elements : [];
  const pageStyle = styleObjectToString(pageChromeStyle(preset, pageBackground));
  const body = elements.map(renderElement).join("\n    ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    .page :is(h1, h2, h3, h4, h5, h6) { margin: 0; font-weight: inherit; font-size: inherit; }
  </style>
</head>
<body>
  <div class="page" style="${escapeHtml(pageStyle)}">
    ${body}
  </div>
</body>
</html>
`;
}
