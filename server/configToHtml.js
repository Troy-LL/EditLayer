const SHARED_DEFAULTS = {
  color: "#1a1a1a",
  fontSize: 16,
  backgroundColor: "transparent",
  opacity: 100,
  padding: 0,
  marginBottom: 20,
  borderRadius: 0,
  borderWidth: 0,
  borderColor: "#000000",
  textAlign: "left",
  offsetX: 0,
  offsetY: 0,
  width: null,
  height: null,
};

const TYPE_DEFAULTS = {
  heading: { text: "" },
  paragraph: { text: "" },
  image: {
    src: "",
    alt: "",
    objectFit: "cover",
    width: 240,
    height: 160,
  },
  button: {
    label: "Button",
    href: "",
    target: "_self",
    fontSize: 14,
    color: "#ffffff",
    backgroundColor: "#2563eb",
    padding: 10,
    borderRadius: 6,
  },
  link: {
    text: "Link",
    href: "",
    target: "_self",
    color: "#2563eb",
    fontSize: 16,
  },
  divider: {
    dividerThickness: 1,
    dividerColor: "#cccccc",
    width: 320,
    height: null,
    marginBottom: 24,
  },
  list: {
    items: ["Item one", "Item two"],
    ordered: false,
  },
  container: {
    children: [],
    width: 320,
    height: 200,
    backgroundColor: "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: "#cccccc",
    padding: 8,
  },
};

const ELEMENT_DEFAULTS = {
  text: "",
  ...SHARED_DEFAULTS,
  src: "",
  alt: "",
  objectFit: "cover",
  label: "",
  href: "",
  target: "_self",
  dividerThickness: 1,
  dividerColor: "#cccccc",
  items: [],
  ordered: false,
  children: [],
  hidden: false,
  zIndex: 0,
};

const PAGE_BACKGROUND_DEFAULT = "#ffffff";

function mergeElement(element) {
  const typeDefaults = TYPE_DEFAULTS[element.type] ?? {};
  const merged = { ...ELEMENT_DEFAULTS, ...typeDefaults, ...element };
  if (merged.type === "container" && Array.isArray(merged.children)) {
    merged.children = merged.children.map(mergeElement);
  }
  return merged;
}

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

  if (el.offsetX !== 0 || el.offsetY !== 0) {
    style.position = "absolute";
    style.left = 0;
    style.top = 0;
    style.transform = `translate(${el.offsetX}px, ${el.offsetY}px)`;
    style.marginBottom = 0;
  }

  style.zIndex = el.zIndex ?? 0;
  if (style.position !== "absolute") {
    style.position = "relative";
  }

  return style;
}

function renderElement(element) {
  const el = mergeElement(element);
  if (el.hidden) return "";

  const style = styleObjectToString(buildStyle(el, element.type));
  const styleAttr = style ? ` style="${escapeHtml(style)}"` : "";

  if (element.type === "heading") {
    return `<h1${styleAttr}>${escapeHtml(el.text)}</h1>`;
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

export function configToHtml(config) {
  const pageBackground = config?.pageBackground ?? PAGE_BACKGROUND_DEFAULT;
  const elements = Array.isArray(config?.elements) ? config.elements : [];
  const pageStyle = styleObjectToString({
    position: "relative",
    minHeight: "100vh",
    padding: "24px",
    boxSizing: "border-box",
    backgroundColor: pageBackground,
  });
  const body = elements.map(renderElement).join("\n    ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
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
