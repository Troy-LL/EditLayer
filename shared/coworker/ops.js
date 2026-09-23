import { mergeElement } from "../elementDefaults.js";
import { createElement } from "../../client/src/elementFactory.js";
import {
  findElementById,
  findParentId,
  groupElements,
  insertIntoTree,
  removeElementsFromTree,
  ungroupContainer,
  updateElementInTree,
} from "../../client/src/elementTree.js";
import { ELEMENT_TYPES, validateElementPatch, validatePagePatch } from "./schema.js";

export const OP_TYPES = ["insert", "update", "delete", "move", "group", "ungroup", "setPage"];

const PROTECTED_KEYS = new Set(["id", "type", "children"]);

class OpError extends Error {}

function fail(message) {
  throw new OpError(message);
}

function requireElement(elements, id) {
  if (typeof id !== "string" || !id) fail("id is required");
  const el = findElementById(elements, id);
  if (!el) fail(`element "${id}" not found`);
  return el;
}

function requireContainer(elements, parentId) {
  if (parentId == null) return;
  const parent = requireElement(elements, parentId);
  if (parent.type !== "container") fail(`parent "${parentId}" is not a container`);
}

function requireSiblingOf(elements, afterId, parentId) {
  if (afterId == null) return;
  requireElement(elements, afterId);
  if ((findParentId(elements, afterId) ?? null) !== (parentId ?? null)) {
    fail(`afterId "${afterId}" is not a child of ${parentId ? `"${parentId}"` : "the page root"}`);
  }
}

function collectIds(element, out = new Set()) {
  out.add(element.id);
  for (const child of element.children ?? []) collectIds(child, out);
  return out;
}

function assertPatch(patch, type) {
  const errors = validateElementPatch(patch, type);
  if (errors.length) fail(errors.join("; "));
}

function stripDefaults(element) {
  const defaults = mergeElement({ type: element.type });
  const out = {};
  for (const [key, value] of Object.entries(element)) {
    if (key === "children") continue;
    if (key === "id" || key === "type") {
      out[key] = value;
    } else if (JSON.stringify(value) !== JSON.stringify(defaults[key])) {
      out[key] = value;
    }
  }
  return out;
}

function buildInsertedElement(spec, existingIds) {
  if (!spec || typeof spec !== "object") fail("element is required");
  if (!ELEMENT_TYPES.includes(spec.type)) {
    fail(`element.type must be one of ${ELEMENT_TYPES.join(", ")}`);
  }
  const { children, id, type, ...fields } = spec;
  assertPatch(fields, type);
  if (id != null && (typeof id !== "string" || !id)) fail("element.id must be a non-empty string");
  if (id && existingIds.has(id)) fail(`element id "${id}" already exists`);
  if (children != null && type !== "container") fail("only container elements can have children");

  const element = stripDefaults(createElement(type, { ...fields, ...(id ? { id } : {}) }));
  existingIds.add(element.id);
  if (type === "container") {
    element.children = (children ?? []).map((child) => buildInsertedElement(child, existingIds));
  }
  return element;
}

function allIds(elements) {
  const ids = new Set();
  for (const el of elements) collectIds(el, ids);
  return ids;
}

function applyOne(config, op) {
  if (!op || typeof op !== "object") fail("op must be an object");
  const elements = config.elements;

  switch (op.op) {
    case "insert": {
      const parentId = op.parentId ?? null;
      requireContainer(elements, parentId);
      requireSiblingOf(elements, op.afterId, parentId);
      const element = buildInsertedElement(op.element, allIds(elements));
      const next = insertIntoTree(elements, element, { parentId, afterId: op.afterId ?? null });
      return {
        config: { ...config, elements: next },
        resolved: { ...op, element },
        touched: [...collectIds(element)],
        result: { id: element.id },
      };
    }
    case "update": {
      const target = requireElement(elements, op.id);
      if (!op.set || typeof op.set !== "object" || !Object.keys(op.set).length) {
        fail("set must be a non-empty object");
      }
      const blocked = Object.keys(op.set).filter((key) => PROTECTED_KEYS.has(key));
      if (blocked.length) fail(`cannot set ${blocked.join(", ")} (delete + insert instead)`);
      assertPatch(op.set, target.type);
      return {
        config: { ...config, elements: updateElementInTree(elements, op.id, op.set) },
        resolved: op,
        touched: [op.id],
        result: { id: op.id },
      };
    }
    case "delete": {
      const ids = op.ids ?? (op.id ? [op.id] : null);
      if (!Array.isArray(ids) || !ids.length) fail("ids must be a non-empty array");
      ids.forEach((id) => requireElement(elements, id));
      return {
        config: { ...config, elements: removeElementsFromTree(elements, ids) },
        resolved: { op: "delete", ids },
        touched: ids,
        result: { ids },
      };
    }
    case "move": {
      const target = requireElement(elements, op.id);
      const parentId = op.parentId ?? null;
      requireContainer(elements, parentId);
      if (parentId && collectIds(target).has(parentId)) fail("cannot move an element into itself");
      const without = removeElementsFromTree(elements, [op.id]);
      if (op.afterId === op.id) fail("afterId cannot be the moved element");
      requireSiblingOf(without, op.afterId, parentId);
      const next = insertIntoTree(without, target, { parentId, afterId: op.afterId ?? null });
      return {
        config: { ...config, elements: next },
        resolved: op,
        touched: [op.id],
        result: { id: op.id },
      };
    }
    case "group": {
      const ids = op.ids;
      if (!Array.isArray(ids) || ids.length < 2) fail("group needs at least 2 ids");
      ids.forEach((id) => requireElement(elements, id));
      const parents = new Set(ids.map((id) => findParentId(elements, id) ?? null));
      if (parents.size > 1) fail("group ids must share a parent");
      const before = allIds(elements);
      let next = groupElements(elements, ids);
      const created = [...allIds(next)].find((id) => !before.has(id));
      if (!created) fail("group failed");
      if (op.name) {
        if (typeof op.name !== "string") fail("name must be a string");
        next = updateElementInTree(next, created, { name: op.name });
      }
      return {
        config: { ...config, elements: next },
        resolved: op,
        touched: [created, ...ids],
        result: { id: created },
      };
    }
    case "ungroup": {
      const target = requireElement(elements, op.id);
      if (target.type !== "container") fail(`"${op.id}" is not a container`);
      const childIds = (target.children ?? []).map((c) => c.id);
      return {
        config: { ...config, elements: ungroupContainer(elements, op.id) },
        resolved: op,
        touched: childIds,
        result: { ids: childIds },
      };
    }
    case "setPage": {
      const errors = validatePagePatch(op.set);
      if (errors.length) fail(errors.join("; "));
      return {
        config: { ...config, ...op.set },
        resolved: op,
        touched: [],
        result: {},
      };
    }
    default:
      fail(`unknown op "${op.op}" (expected one of ${OP_TYPES.join(", ")})`);
  }
}

/**
 * Apply ops atomically. Returns { ok, config, resolvedOps, touchedIds, results }
 * or { ok:false, error, index } without partial changes.
 * Resolved ops carry generated ids so any replica can replay them deterministically.
 */
export function applyOps(config, ops) {
  if (!Array.isArray(ops) || !ops.length) {
    return { ok: false, error: "ops must be a non-empty array", index: -1 };
  }
  let working = {
    ...config,
    elements: Array.isArray(config?.elements) ? config.elements : [],
  };
  const resolvedOps = [];
  const touched = new Set();
  const results = [];
  for (let i = 0; i < ops.length; i += 1) {
    try {
      const step = applyOne(working, ops[i]);
      working = step.config;
      resolvedOps.push(step.resolved);
      step.touched.forEach((id) => touched.add(id));
      results.push(step.result);
    } catch (err) {
      if (!(err instanceof OpError)) throw err;
      return { ok: false, error: `op ${i} (${ops[i]?.op ?? "?"}): ${err.message}`, index: i };
    }
  }
  const touchedIds = [...touched].filter((id) => findElementById(working.elements, id));
  return { ok: true, config: working, resolvedOps, touchedIds, results };
}

export function summarizeOp(op) {
  switch (op.op) {
    case "insert":
      return `insert ${op.element?.type ?? "element"}${op.element?.id ? ` ${op.element.id}` : ""}`;
    case "update":
      return `update ${op.id} (${Object.keys(op.set ?? {}).join(", ")})`;
    case "delete":
      return `delete ${(op.ids ?? [op.id]).join(", ")}`;
    case "move":
      return `move ${op.id} → ${op.parentId ?? "page"}`;
    case "group":
      return `group ${op.ids?.join(", ")}`;
    case "ungroup":
      return `ungroup ${op.id}`;
    case "setPage":
      return `page (${Object.keys(op.set ?? {}).join(", ")})`;
    default:
      return String(op.op);
  }
}
