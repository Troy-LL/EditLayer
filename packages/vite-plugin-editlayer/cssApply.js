const PROPERTY_RE = /^[a-z]+(-[a-z0-9]+)*$/;
const TOKEN_NAME_RE = /^--[a-z0-9-]+$/;

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function validateValue(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw makeError(400, "invalid value");
  }
  if (/[\n\r{};]/.test(value)) {
    throw makeError(400, "invalid value");
  }
}

function validateProperty(property) {
  if (!PROPERTY_RE.test(property)) {
    throw makeError(400, "invalid property");
  }
}

function validateTokenName(name) {
  if (!TOKEN_NAME_RE.test(name)) {
    throw makeError(400, "invalid token");
  }
}

function selectorListContains(selectorListText, target) {
  return selectorListText
    .split(",")
    .map((s) => s.trim())
    .some((s) => s === target);
}

function isIdentChar(ch) {
  return /[a-zA-Z0-9_-]/.test(ch);
}

function skipWhitespace(code, i) {
  while (i < code.length && /\s/.test(code[i])) i++;
  return i;
}

function skipComment(code, i) {
  if (code[i] === "/" && code[i + 1] === "*") {
    i += 2;
    while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) i++;
    return i + 2;
  }
  if (code[i] === "/" && code[i + 1] === "/") {
    i += 2;
    while (i < code.length && code[i] !== "\n") i++;
    return i;
  }
  return i;
}

function skipWhitespaceAndComments(code, i) {
  while (i < code.length) {
    const next = skipWhitespace(code, i);
    if (next !== i) {
      i = next;
      continue;
    }
    const afterComment = skipComment(code, i);
    if (afterComment !== i) {
      i = afterComment;
      continue;
    }
    break;
  }
  return i;
}

function skipString(code, i) {
  const quote = code[i];
  if (quote !== '"' && quote !== "'") return i;
  i++;
  while (i < code.length) {
    if (code[i] === "\\") {
      i += 2;
      continue;
    }
    if (code[i] === quote) return i + 1;
    i++;
  }
  return i;
}

function readAtRuleName(code, i) {
  if (code[i] !== "@") return null;
  let j = i + 1;
  while (j < code.length && /[a-zA-Z0-9_-]/.test(code[j])) j++;
  return { name: code.slice(i + 1, j).toLowerCase(), end: j };
}

function findMatchingBrace(code, openIndex) {
  let depth = 0;
  let i = openIndex;
  while (i < code.length) {
    i = skipWhitespaceAndComments(code, i);
    if (i >= code.length) break;
    if (code[i] === '"' || code[i] === "'") {
      i = skipString(code, i);
      continue;
    }
    if (code[i] === "{") {
      depth++;
      i++;
      continue;
    }
    if (code[i] === "}") {
      depth--;
      if (depth === 0) return i;
      i++;
      continue;
    }
    i++;
  }
  return -1;
}

/**
 * @typedef {{ selectorText: string, bodyStart: number, bodyEnd: number, braceClose: number }} StyleRule
 */

/**
 * @param {string} code
 * @param {number} start
 * @param {number} end
 * @param {StyleRule[]} out
 * @param {boolean} oneLevelNested
 */
function collectStyleRulesInRange(code, start, end, out, oneLevelNested) {
  let i = start;
  while (i < end) {
    i = skipWhitespaceAndComments(code, i);
    if (i >= end) break;

    if (code[i] === "@") {
      const at = readAtRuleName(code, i);
      if (!at) break;
      let j = at.end;
      j = skipWhitespaceAndComments(code, j);
      while (j < end && code[j] !== "{") {
        if (code[j] === '"' || code[j] === "'") j = skipString(code, j);
        else if (code[j] === "(") {
          let depth = 1;
          j++;
          while (j < end && depth > 0) {
            if (code[j] === "(") depth++;
            else if (code[j] === ")") depth--;
            j++;
          }
        } else j++;
      }
      if (j >= end || code[j] !== "{") break;
      const blockStart = j + 1;
      const close = findMatchingBrace(code, j);
      if (close < 0) break;
      if (at.name === "keyframes") {
        i = close + 1;
        continue;
      }
      if (at.name === "media" || at.name === "supports" || at.name === "layer" || at.name === "container") {
        collectStyleRulesInRange(code, blockStart, close, out, true);
      }
      i = close + 1;
      continue;
    }

    const selectorStart = i;
    while (i < end) {
      if (code[i] === '"' || code[i] === "'") {
        i = skipString(code, i);
        continue;
      }
      i = skipWhitespaceAndComments(code, i);
      if (i < end && code[i] === "{") break;
      if (i < end) i++;
    }
    if (i >= end || code[i] !== "{") break;
    const selectorText = code.slice(selectorStart, i).trim();
    const bodyStart = i + 1;
    const close = findMatchingBrace(code, i);
    if (close < 0) break;
    out.push({
      selectorText,
      bodyStart,
      bodyEnd: close,
      braceClose: close,
    });
    i = close + 1;
  }
}

/** @param {string} code */
function collectStyleRules(code) {
  /** @type {StyleRule[]} */
  const rules = [];
  collectStyleRulesInRange(code, 0, code.length, rules, true);
  return rules;
}

function readPropertyName(code, i, end) {
  i = skipWhitespaceAndComments(code, i);
  if (i >= end) return null;
  if (code[i] === "-") {
    let j = i;
    while (j < end && (isIdentChar(code[j]) || code[j] === "-")) j++;
    return { name: code.slice(i, j), start: i, end: j };
  }
  let j = i;
  while (j < end && /[a-zA-Z]/.test(code[j])) j++;
  while (j < end && (code[j] === "-" || /[a-z0-9]/.test(code[j]))) j++;
  if (j === i) return null;
  return { name: code.slice(i, j), start: i, end: j };
}

function detectDeclarationIndent(code, bodyStart, bodyEnd) {
  const slice = code.slice(bodyStart, bodyEnd);
  const match = slice.match(/\n(\s+)\S/);
  return match ? match[1] : "  ";
}

/**
 * @returns {{ valueStart: number, valueEnd: number, importantSuffix: string } | null}
 */
function findPropertyDeclaration(code, bodyStart, bodyEnd, property) {
  let i = bodyStart;
  while (i < bodyEnd) {
    i = skipWhitespaceAndComments(code, i);
    if (i >= bodyEnd) break;
    if (code[i] === "}") break;

    const prop = readPropertyName(code, i, bodyEnd);
    if (!prop) {
      i++;
      continue;
    }
    let j = skipWhitespaceAndComments(code, prop.end);
    if (j >= bodyEnd || code[j] !== ":") {
      i = prop.end;
      continue;
    }
    j++;
    j = skipWhitespaceAndComments(code, j);
    const valueStart = j;
    let valueEnd = j;
    let importantSuffix = "";
    while (valueEnd < bodyEnd) {
      if (code[valueEnd] === '"' || code[valueEnd] === "'") {
        valueEnd = skipString(code, valueEnd);
        continue;
      }
      if (code[valueEnd] === ";") break;
      if (code[valueEnd] === "}") break;
      valueEnd++;
    }
    let replaceEnd = valueEnd;
    const chunk = code.slice(valueStart, valueEnd);
    const impMatch = chunk.match(/^(.*?)(\s+!important)\s*$/i);
    if (impMatch) {
      importantSuffix = " !important";
      replaceEnd = valueStart + impMatch[1].length + impMatch[2].length;
    }
    if (prop.name === property) {
      return { valueStart, valueEnd: replaceEnd, importantSuffix };
    }
    i = valueEnd;
    if (i < bodyEnd && code[i] === ";") i++;
  }
  return null;
}

function applyDeclarationToRule(code, rule, property, value) {
  const { bodyStart, bodyEnd, braceClose } = rule;
  const found = findPropertyDeclaration(code, bodyStart, bodyEnd, property);
  if (found) {
    const { valueStart, valueEnd, importantSuffix } = found;
    const newCode =
      code.slice(0, valueStart) + value + importantSuffix + code.slice(valueEnd);
    return newCode;
  }
  const indent = detectDeclarationIndent(code, bodyStart, bodyEnd);
  const beforeClose = code.slice(bodyStart, braceClose);
  const trimmedEnd = beforeClose.trimEnd();
  const insertPos = bodyStart + trimmedEnd.length;
  const prefix = trimmedEnd.length === 0 ? "" : "\n";
  const insertion = `${prefix}${indent}${property}: ${value};`;
  return code.slice(0, insertPos) + insertion + code.slice(insertPos);
}

export function applyCssDeclaration(code, { selector, property, value }) {
  validateProperty(property);
  validateValue(value);
  if (typeof selector !== "string" || !selector) {
    throw makeError(400, "invalid selector");
  }

  const rules = collectStyleRules(code);
  let match = null;
  for (const rule of rules) {
    if (selectorListContains(rule.selectorText, selector)) {
      match = rule;
    }
  }
  if (!match) {
    throw makeError(422, `selector not found: ${selector}`);
  }

  const newCode = applyDeclarationToRule(code, match, property, value);
  return {
    code: newCode,
    summary: `${selector}: ${property} ${value}`,
  };
}

function replaceCustomPropertyValues(code, name, value) {
  let count = 0;
  let result = code;
  let searchFrom = 0;
  while (searchFrom < result.length) {
    let i = skipWhitespaceAndComments(result, searchFrom);
    if (i >= result.length) break;

    const prop = readPropertyName(result, i, result.length);
    if (!prop || prop.name !== name) {
      searchFrom = prop ? prop.end : i + 1;
      continue;
    }
    let j = skipWhitespaceAndComments(result, prop.end);
    if (j >= result.length || result[j] !== ":") {
      searchFrom = prop.end;
      continue;
    }
    j++;
    j = skipWhitespaceAndComments(result, j);
    const valueStart = j;
    let valueEnd = j;
    while (valueEnd < result.length) {
      if (result[valueEnd] === '"' || result[valueEnd] === "'") {
        valueEnd = skipString(result, valueEnd);
        continue;
      }
      if (result[valueEnd] === ";") break;
      if (result[valueEnd] === "}") break;
      valueEnd++;
    }
    result = result.slice(0, valueStart) + value + result.slice(valueEnd);
    count++;
    searchFrom = valueStart + value.length;
  }
  return { code: result, count };
}

export function applyToken(code, { name, value }) {
  validateTokenName(name);
  validateValue(value);
  const { code: newCode, count } = replaceCustomPropertyValues(code, name, value);
  if (count === 0) {
    throw makeError(422, `token not found: ${name}`);
  }
  return {
    code: newCode,
    summary: `${name} ${value}`,
  };
}
