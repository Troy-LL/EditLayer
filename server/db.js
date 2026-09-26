import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PRESETS } from "../seeds/index.js";
import { demoPageConfig } from "../seeds/demo.js";
import { PRESET_SOURCE_PATHS } from "./pathUtils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(join(__dirname, "data.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS page (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    config     TEXT NOT NULL,
    preset     TEXT NOT NULL DEFAULT 'demo',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.exec(`ALTER TABLE page ADD COLUMN preset TEXT NOT NULL DEFAULT 'demo'`);
} catch {
  // Column already exists.
}

try {
  db.exec(`ALTER TABLE page ADD COLUMN source_path TEXT`);
} catch {
  // Column already exists.
}

try {
  db.exec(`ALTER TABLE page ADD COLUMN version INTEGER NOT NULL DEFAULT 0`);
} catch {
  // Column already exists.
}

try {
  db.exec(`ALTER TABLE requests ADD COLUMN target TEXT`);
} catch {
  // Column already exists.
}

try {
  db.exec(`ALTER TABLE requests ADD COLUMN intent TEXT`);
} catch {
  // Column already exists.
}

db.exec(`
  CREATE TABLE IF NOT EXISTS requests (
    id         TEXT PRIMARY KEY,
    text       TEXT NOT NULL,
    element_id TEXT,
    status     TEXT NOT NULL DEFAULT 'open',
    reply      TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

try {
  db.exec(`ALTER TABLE requests ADD COLUMN author TEXT NOT NULL DEFAULT 'human'`);
} catch {}

try {
  db.exec(`ALTER TABLE requests ADD COLUMN resolution TEXT`);
} catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS design_session (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    on_session INTEGER NOT NULL DEFAULT 0
  );
`);

db.prepare(
  "INSERT OR IGNORE INTO design_session (id, on_session) VALUES (1, 0)"
).run();

db.exec(`
  CREATE TABLE IF NOT EXISTS snapshots (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    preset     TEXT NOT NULL,
    config     TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const existing = db.prepare("SELECT id, preset, source_path FROM page WHERE id = 1").get();
if (!existing) {
  db.prepare("INSERT INTO page (id, config, preset, source_path) VALUES (1, ?, ?, ?)").run(
    JSON.stringify(demoPageConfig),
    "demo",
    PRESET_SOURCE_PATHS.demo
  );
} else if (!existing.source_path) {
  const sourcePath = PRESET_SOURCE_PATHS[existing.preset ?? "demo"] ?? null;
  if (sourcePath) {
    db.prepare("UPDATE page SET source_path = ? WHERE id = 1").run(sourcePath);
  }
}

export function getPage() {
  const row = db
    .prepare("SELECT config, preset, source_path, updated_at, version FROM page WHERE id = 1")
    .get();
  return {
    config: JSON.parse(row.config),
    preset: row.preset ?? "demo",
    source_path: row.source_path ?? null,
    updated_at: row.updated_at,
    version: row.version ?? 0,
  };
}

function currentVersion() {
  return db.prepare("SELECT version FROM page WHERE id = 1").get().version;
}

export function getSourcePath() {
  const row = db.prepare("SELECT source_path FROM page WHERE id = 1").get();
  return row?.source_path ?? null;
}

export function savePage(config) {
  const updated_at = new Date().toISOString();
  db.prepare(
    "UPDATE page SET config = ?, updated_at = ?, version = version + 1 WHERE id = 1"
  ).run(JSON.stringify(config), updated_at);
  return { updated_at, version: currentVersion() };
}

export function loadPreset(presetName) {
  const preset = PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`);
  }

  const sourcePath = PRESET_SOURCE_PATHS[presetName] ?? null;
  const updated_at = new Date().toISOString();
  db.prepare(
    "UPDATE page SET config = ?, preset = ?, source_path = ?, updated_at = ?, version = version + 1 WHERE id = 1"
  ).run(JSON.stringify(preset.config), presetName, sourcePath, updated_at);

  return {
    config: preset.config,
    preset: presetName,
    source_path: sourcePath,
    updated_at,
    version: currentVersion(),
  };
}

export function listSnapshots() {
  const rows = db
    .prepare(
      "SELECT id, name, preset, created_at FROM snapshots ORDER BY created_at DESC"
    )
    .all();
  return rows;
}

export function createSnapshot(name, config, preset) {
  const id = randomUUID();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Snapshot name is required");
  }
  db.prepare(
    "INSERT INTO snapshots (id, name, preset, config) VALUES (?, ?, ?, ?)"
  ).run(id, trimmed, preset, JSON.stringify(config));
  return {
    id,
    name: trimmed,
    preset,
    created_at: new Date().toISOString(),
  };
}

export function deleteSnapshot(id) {
  const result = db.prepare("DELETE FROM snapshots WHERE id = ?").run(id);
  if (result.changes === 0) {
    throw new Error("Snapshot not found");
  }
}

export function getSnapshot(id) {
  const row = db
    .prepare("SELECT id, name, preset, config, created_at FROM snapshots WHERE id = ?")
    .get(id);
  if (!row) {
    throw new Error("Snapshot not found");
  }
  return {
    ...row,
    config: JSON.parse(row.config),
  };
}

export function restoreSnapshot(id) {
  const snapshot = getSnapshot(id);
  const updated_at = new Date().toISOString();
  const sourcePath = PRESET_SOURCE_PATHS[snapshot.preset] ?? null;
  db.prepare(
    "UPDATE page SET config = ?, preset = ?, source_path = ?, updated_at = ?, version = version + 1 WHERE id = 1"
  ).run(
    JSON.stringify(snapshot.config),
    snapshot.preset,
    sourcePath,
    updated_at
  );
  return {
    config: snapshot.config,
    preset: snapshot.preset,
    source_path: sourcePath,
    updated_at,
    version: currentVersion(),
  };
}

function parseJsonColumn(raw) {
  if (raw == null || raw === "") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function rowToRequest(row) {
  return {
    id: row.id,
    text: row.text,
    elementId: row.element_id ?? null,
    target: parseJsonColumn(row.target),
    intent: parseJsonColumn(row.intent),
    author: row.author === "agent" ? "agent" : "human",
    resolution:
      row.resolution === "accept" || row.resolution === "revert"
        ? row.resolution
        : null,
    status: row.status,
    reply: row.reply ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function listRequests({ status } = {}) {
  const rows = status
    ? db.prepare("SELECT * FROM requests WHERE status = ? ORDER BY created_at DESC").all(status)
    : db.prepare("SELECT * FROM requests ORDER BY created_at DESC").all();
  return rows.map(rowToRequest);
}

export function createRequest({ text, elementId, target, intent, author = "human" }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO requests (id, text, element_id, target, intent, author, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)"
  ).run(
    id,
    text,
    elementId ?? null,
    target != null ? JSON.stringify(target) : null,
    intent != null ? JSON.stringify(intent) : null,
    author === "agent" ? "agent" : "human",
    now,
    now
  );
  return rowToRequest(db.prepare("SELECT * FROM requests WHERE id = ?").get(id));
}

export function updateRequest(id, { reply, status, resolution }) {
  const row = db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
  if (!row) throw new Error("Request not found");
  if (resolution === "accept" || resolution === "revert") {
    db.prepare(
      "UPDATE requests SET reply = ?, status = ?, resolution = ?, updated_at = ? WHERE id = ?"
    ).run(
      reply ?? row.reply,
      resolution === "accept" ? "done" : "open",
      resolution,
      new Date().toISOString(),
      id
    );
    return rowToRequest(db.prepare("SELECT * FROM requests WHERE id = ?").get(id));
  }
  db.prepare("UPDATE requests SET reply = ?, status = ?, updated_at = ? WHERE id = ?").run(
    reply ?? row.reply,
    status ?? row.status,
    new Date().toISOString(),
    id
  );
  return rowToRequest(db.prepare("SELECT * FROM requests WHERE id = ?").get(id));
}

export function getDesignSession() {
  const row = db.prepare("SELECT on_session FROM design_session WHERE id = 1").get();
  return { on: row.on_session === 1 };
}

export function setDesignSession(on) {
  db.prepare("UPDATE design_session SET on_session = ? WHERE id = 1").run(on ? 1 : 0);
  return getDesignSession();
}
