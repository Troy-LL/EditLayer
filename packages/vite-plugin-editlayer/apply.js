import fs from "node:fs";
import path from "node:path";
import parser from "@babel/parser";

const ALLOWED_EXT = new Set([".jsx", ".tsx", ".js", ".ts"]);
const STYLE_KEY_RE = /^[a-zA-Z]+$/;

function parseAst(code, file) {
  const isTs = /\.tsx?$/i.test(file);
  return parser.parse(code, {
    sourceType: "module",
    plugins: isTs ? ["jsx", "typescript"] : ["jsx"],
    errorRecovery: false,
  });
}

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * @param {string} root
 * @param {string} sourceString
 * @returns {{ file: string, line: number, column: number, absPath: string }}
 */
export function resolveSource(root, sourceString) {
  if (typeof sourceString !== "string" || !sourceString) {
    throw makeError(400, "invalid source");
  }
  const parts = sourceString.split(":");
  if (parts.length < 3) throw makeError(400, "invalid source");
  const column = Number(parts.pop());
  const line = Number(parts.pop());
  const filePart = parts.join(":");
  if (!Number.isInteger(line) || line < 1 || !Number.isInteger(column) || column < 1) {
    throw makeError(400, "invalid source");
  }
  if (path.isAbsolute(filePart)) throw makeError(403, "path outside project");
  const normalized = filePart.replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.split("/").includes("..")) {
    throw makeError(403, "path outside project");
  }
  if (normalized.includes("node_modules")) throw makeError(403, "path outside project");
  const ext = path.extname(normalized).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) throw makeError(400, "unsupported file type");
  const absPath = path.resolve(root, normalized);
  const relRoot = path.resolve(root);
  if (!absPath.startsWith(relRoot + path.sep) && absPath !== relRoot) {
    throw makeError(403, "path outside project");
  }
  return { file: normalized, line, column, absPath };
}

function walk(node, visit) {
  if (!node || typeof node !== "object" || !node.type) return;
  visit(node);
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c.type === "string") walk(c, visit);
      }
    } else if (child && typeof child.type === "string") {
      walk(child, visit);
    }
  }
}

function findOpeningAt(ast, line, column) {
  let found = null;
  walk(ast, (node) => {
    if (node.type === "JSXOpeningElement") {
      if (node.loc.start.line === line && node.loc.start.column + 1 === column) {
        found = node;
      }
    }
  });
  return found;
}

function jsonStringLiteral(value) {
  return JSON.stringify(String(value));
}

function validateStyle(style) {
  if (!style || typeof style !== "object") return;
  for (const key of Object.keys(style)) {
    if (!STYLE_KEY_RE.test(key)) throw makeError(400, `invalid style key: ${key}`);
    if (typeof style[key] !== "string") throw makeError(400, "style values must be strings");
  }
}

function findStyleAttribute(opening) {
  return opening.attributes.find(
    (a) => a.type === "JSXAttribute" && a.name?.name === "style",
  );
}

function insertAfterName(code, opening, insertion) {
  let insertAt = opening.name.end;
  if (opening.typeParameters) insertAt = opening.typeParameters.end;
  else if (opening.typeArguments) insertAt = opening.typeArguments.end;
  return code.slice(0, insertAt) + insertion + code.slice(insertAt);
}

function buildStylePairs(style) {
  return Object.entries(style).map(([k, v]) => `${k}: ${jsonStringLiteral(v)}`);
}

function updateObjectLiteral(code, objNode, style) {
  const keysToSet = { ...style };
  // Offsets all refer to `code`; splice from the end so earlier ones stay valid.
  const edits = [];

  for (const prop of objNode.properties) {
    if (prop.type !== "ObjectProperty") continue;
    let keyName = null;
    if (prop.key.type === "Identifier") keyName = prop.key.name;
    else if (prop.key.type === "StringLiteral") keyName = prop.key.value;
    if (keyName && Object.prototype.hasOwnProperty.call(keysToSet, keyName)) {
      edits.push({ start: prop.value.start, end: prop.value.end, text: jsonStringLiteral(keysToSet[keyName]) });
      delete keysToSet[keyName];
    }
  }

  const remaining = Object.entries(keysToSet);
  if (remaining.length > 0) {
    const insertPos = code.slice(0, objNode.end - 1).trimEnd().length;
    const inner = code.slice(objNode.start + 1, insertPos).trim();
    const prefix = inner.length === 0 ? " " : inner.endsWith(",") ? " " : ", ";
    const suffix = inner.length === 0 ? " " : "";
    edits.push({ start: insertPos, end: insertPos, text: `${prefix}${buildStylePairs(Object.fromEntries(remaining)).join(", ")}${suffix}` });
  }

  return edits
    .sort((a, b) => b.start - a.start)
    .reduce((out, { start, end, text }) => out.slice(0, start) + text + out.slice(end), code);
}

function applyStyleToOpening(code, opening, style) {
  if (!style || Object.keys(style).length === 0) return code;
  validateStyle(style);
  const attr = findStyleAttribute(opening);
  const pairs = buildStylePairs(style);

  if (!attr) {
    const insertion = ` style={{ ${pairs.join(", ")} }}`;
    return insertAfterName(code, opening, insertion);
  }

  const expr = attr.value;
  if (expr.type === "JSXExpressionContainer") {
    const inner = expr.expression;
    if (inner.type === "ObjectExpression") {
      return updateObjectLiteral(code, inner, style);
    }
    const exprCode = code.slice(inner.start, inner.end);
    const newAttr = `style={{ ...${exprCode}, ${pairs.join(", ")} }}`;
    return code.slice(0, attr.start) + newAttr + code.slice(attr.end);
  }
  throw makeError(422, "unsupported style attribute");
}

function needsJsxExpressionWrap(text) {
  return /[{}<>]/.test(text);
}

function applyTextToElement(code, opening, parentElement, text) {
  if (typeof text !== "string") throw makeError(400, "text must be a string");
  const children = parentElement.children;
  const meaningful = children.filter(
    (c) => c.type !== "JSXText" || c.value.trim().length > 0,
  );
  if (
    meaningful.length !== 1 ||
    meaningful[0].type !== "JSXText" ||
    children.some((c) => c.type === "JSXExpressionContainer")
  ) {
    throw makeError(422, "text is dynamic here; ask the agent");
  }
  const textNode = meaningful[0];
  const raw = textNode.value;
  const lead = raw.match(/^\s*/)?.[0] ?? "";
  const trail = raw.match(/\s*$/)?.[0] ?? "";

  let newInner;
  if (needsJsxExpressionWrap(text)) {
    newInner = `{${jsonStringLiteral(text)}}`;
  } else {
    newInner = text;
  }
  const newRaw = `${lead}${newInner}${trail}`;
  return code.slice(0, textNode.start) + newRaw + code.slice(textNode.end);
}

function findParentElement(ast, opening) {
  let parent = null;
  walk(ast, (node) => {
    if (node.type === "JSXElement" && node.openingElement === opening) {
      parent = node;
    }
  });
  return parent;
}

/**
 * @param {string} code
 * @param {{ line: number, column: number }} pos
 * @param {{ style?: Record<string, string>, text?: string }} edits
 * @param {{ file?: string }} meta
 */
export function applyEdit(code, { line, column }, { style, text }, { file = "" } = {}) {
  let ast;
  try {
    ast = parseAst(code, file);
  } catch {
    throw makeError(400, "parse error");
  }

  const opening = findOpeningAt(ast, line, column);
  if (!opening) throw makeError(409, "element moved; reload");

  let result = code;
  const summaryParts = [];

  if (style && Object.keys(style).length > 0) {
    result = applyStyleToOpening(result, opening, style);
    for (const [k, v] of Object.entries(style)) {
      summaryParts.push(`style ${k} ${v}`);
    }
    // Re-parse if we also need text (opening positions may shift)
    if (text !== undefined) {
      ast = parseAst(result, file);
      const opening2 = findOpeningAt(ast, line, column);
      if (!opening2) throw makeError(409, "element moved; reload");
      const parent = findParentElement(ast, opening2);
      if (!parent) throw makeError(409, "element moved; reload");
      result = applyTextToElement(result, opening2, parent, text);
      summaryParts.push(`text ${text}`);
    }
  } else if (text !== undefined) {
    const parent = findParentElement(ast, opening);
    if (!parent) throw makeError(409, "element moved; reload");
    result = applyTextToElement(result, opening, parent, text);
    summaryParts.push(`text ${text}`);
  }

  const fileLabel = file || "file";
  const summary = `${fileLabel}: ${summaryParts.join(", ")}`;
  return { code: result, summary };
}

export function readFileUtf8(absPath) {
  return fs.readFileSync(absPath, "utf8");
}

export function writeFileUtf8(absPath, content) {
  fs.writeFileSync(absPath, content, "utf8");
}
