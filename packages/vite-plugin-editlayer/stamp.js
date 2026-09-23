import parser from "@babel/parser";

const HOST_ATTR = "data-editlayer-source";

function parseCode(code, file, extraPlugins = []) {
  const isTs = /\.tsx?$/i.test(file);
  const plugins = isTs ? ["jsx", "typescript", ...extraPlugins] : ["jsx", ...extraPlugins];
  try {
    return parser.parse(code, {
      sourceType: "module",
      plugins,
      errorRecovery: false,
    });
  } catch {
    return null;
  }
}

function isHostOpening(node) {
  if (node.type !== "JSXOpeningElement") return false;
  const name = node.name;
  if (name.type !== "JSXIdentifier") return false;
  if (!/^[a-z]/.test(name.name)) return false;
  return !node.attributes.some(
    (a) => a.type === "JSXAttribute" && a.name?.name === HOST_ATTR,
  );
}

function componentNameFromAncestors(ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const node = ancestors[i];
    if (node.type === "FunctionDeclaration" && node.id?.name && /^[A-Z]/.test(node.id.name)) {
      return node.id.name;
    }
    if (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
      const prev = ancestors[i - 1];
      if (prev?.type === "VariableDeclarator" && prev.id?.type === "Identifier") {
        const name = prev.id.name;
        if (/^[A-Z]/.test(name)) return name;
      }
    }
  }
  return null;
}

function walk(node, ancestors, visitors) {
  if (!node || typeof node !== "object" || !node.type) return;
  ancestors.push(node);
  if (visitors[node.type]) visitors[node.type](node, ancestors);
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c.type === "string") walk(c, ancestors, visitors);
      }
    } else if (child && typeof child.type === "string") {
      walk(child, ancestors, visitors);
    }
  }
  ancestors.pop();
}

/**
 * @param {string} code
 * @param {{ file: string, plugins?: string[] }} opts
 * @returns {string | null}
 */
export function stampSource(code, { file, plugins = [] }) {
  const ast = parseCode(code, file, plugins);
  if (!ast) return null;

  const insertions = [];

  walk(ast, [], {
    JSXOpeningElement(node, ancestors) {
      if (!isHostOpening(node)) return;
      const line = node.loc.start.line;
      const column = node.loc.start.column + 1;
      const comp = componentNameFromAncestors(ancestors);
      let attrs = ` data-editlayer-source="${file}:${line}:${column}"`;
      if (comp) attrs += ` data-editlayer-component="${comp}"`;

      let insertAt = node.name.end;
      if (node.typeParameters) insertAt = node.typeParameters.end;
      else if (node.typeArguments) insertAt = node.typeArguments.end;

      insertions.push({ offset: insertAt, text: attrs });
    },
  });

  if (insertions.length === 0) return null;

  insertions.sort((a, b) => b.offset - a.offset);
  let out = code;
  for (const { offset, text } of insertions) {
    out = out.slice(0, offset) + text + out.slice(offset);
  }
  return out;
}
