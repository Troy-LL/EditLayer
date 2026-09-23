import fs from "node:fs";
import path from "node:path";

function badPathError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function assertRelativePosixFile(file) {
  if (typeof file !== "string" || file === "") {
    throw badPathError("file must be a non-empty relative posix path");
  }
  if (file.startsWith("/") || /^[A-Za-z]:/.test(file)) {
    throw badPathError("file must not be absolute");
  }
  if (file.includes("\\")) {
    throw badPathError("file must use posix separators");
  }
  const segments = file.split("/");
  if (segments.some((s) => s === "..")) {
    throw badPathError("file must not contain .. segments");
  }
}

function isValidEntry(item) {
  return (
    item &&
    typeof item === "object" &&
    typeof item.file === "string" &&
    typeof item.before === "string" &&
    typeof item.after === "string"
  );
}

function loadStack(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return [];
    }
    if (!data.every(isValidEntry)) {
      return [];
    }
    return data;
  } catch {
    return [];
  }
}

function persistStack(dir, filePath, stack) {
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, "undo.json.tmp");
  fs.writeFileSync(tmpPath, JSON.stringify(stack), "utf8");
  fs.renameSync(tmpPath, filePath);
}

export function createUndoStore(root, { limit = 50 } = {}) {
  const dir = path.join(root, ".editlayer");
  const filePath = path.join(dir, "undo.json");
  let stack = loadStack(filePath);

  function trim() {
    if (stack.length > limit) {
      stack = stack.slice(stack.length - limit);
    }
  }

  function save() {
    persistStack(dir, filePath, stack);
  }

  // Reload so a restart, or the Vite plugin and the EditLayer server sharing one
  // project, see the same stack.
  function read() {
    stack = loadStack(filePath);
  }

  return {
    get depth() {
      read();
      return stack.length;
    },

    get filePath() {
      return filePath;
    },

    push({ file, before, after }) {
      read();
      assertRelativePosixFile(file);
      if (typeof before !== "string" || typeof after !== "string") {
        throw badPathError("before and after must be strings");
      }
      stack.push({ file, before, after });
      trim();
      save();
    },

    pop() {
      read();
      if (stack.length === 0) {
        return null;
      }
      const entry = stack[stack.length - 1];
      stack = stack.slice(0, -1);
      save();
      return entry;
    },

    peek() {
      read();
      if (stack.length === 0) {
        return null;
      }
      return stack[stack.length - 1];
    },
  };
}
