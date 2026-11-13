import parser from "@babel/parser";

const CLASS_TOKEN_RE = /^[A-Za-z0-9_-]+$/;

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

function validateClassTokens(tokens) {
  for (const token of tokens) {
    if (!CLASS_TOKEN_RE.test(token)) {
      throw makeError(400, `invalid class token: ${token}`);
    }
  }
}

function preferredClassAttrName(file) {
  if (!file) return "className";
  const lower = file.toLowerCase();
  if (lower.endsWith(".js") || lower.endsWith(".html")) return "class";
  return "className";
}

function findClassAttribute(opening) {
  const classNameAttr = opening.attributes.find(
    (a) => a.type === "JSXAttribute" && a.name?.name === "className",
  );
  if (classNameAttr) return classNameAttr;
  return opening.attributes.find(
    (a) => a.type === "JSXAttribute" && a.name?.name === "class",
  );
}

function insertAfterName(code, opening, insertion) {
  let insertAt = opening.name.end;
  if (opening.typeParameters) insertAt = opening.typeParameters.end;
  else if (opening.typeArguments) insertAt = opening.typeArguments.end;
  return code.slice(0, insertAt) + insertion + code.slice(insertAt);
}

function tokenizeClasses(text) {
  return text.split(/\s+/).filter(Boolean);
}

function buildSummary(attrName, add, remove) {
  const parts = [];
  for (const t of add) parts.push(`+${t}`);
  for (const t of remove) parts.push(`-${t}`);
  return `${attrName} ${parts.join(" ")}`.trim();
}

export function applyClassList(
  code,
  { line, column },
  { add = [], remove = [] } = {},
  { file } = {},
) {
  validateClassTokens(add);
  validateClassTokens(remove);

  let ast;
  try {
    ast = parseAst(code, file ?? "");
  } catch {
    throw makeError(400, "parse error");
  }

  const opening = findOpeningAt(ast, line, column);
  if (!opening) throw makeError(409, "element moved; reload");

  const attrName = preferredClassAttrName(file);
  const attr = findClassAttribute(opening);
  const removeSet = new Set(remove);

  if (!attr) {
    if (add.length === 0) {
      return { code, summary: `${attrName}` };
    }
    const insertion = ` ${attrName}="${add.join(" ")}"`;
    const newCode = insertAfterName(code, opening, insertion);
    return { code: newCode, summary: buildSummary(attrName, add, remove) };
  }

  const valueNode = attr.value;
  if (!valueNode || valueNode.type !== "StringLiteral") {
    throw makeError(422, "className is dynamic here; ask the agent");
  }

  const existing = tokenizeClasses(valueNode.value);
  const kept = existing.filter((t) => !removeSet.has(t));
  for (const t of add) {
    if (!kept.includes(t)) kept.push(t);
  }

  const summary = buildSummary(attrName, add, remove);

  if (kept.length === 0) {
    let start = attr.start;
    let end = attr.end;
    if (start > 0 && code[start - 1] === " ") start -= 1;
    else if (end < code.length && code[end] === " ") end += 1;
    const newCode = code.slice(0, start) + code.slice(end);
    return { code: newCode, summary };
  }

  const newLiteral = kept.join(" ");
  const newCode =
    code.slice(0, valueNode.start) +
    JSON.stringify(newLiteral) +
    code.slice(valueNode.end);
  return { code: newCode, summary };
}
