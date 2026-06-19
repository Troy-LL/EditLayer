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
    .prepare("SELECT config, preset, source_path, updated_at FROM page WHERE id = 1")
    .get();
  return {
    config: JSON.parse(row.config),
    preset: row.preset ?? "demo",
    source_path: row.source_path ?? null,
    updated_at: row.updated_at,
  };
}

export function getSourcePath() {
  const row = db.prepare("SELECT source_path FROM page WHERE id = 1").get();
  return row?.source_path ?? null;
}

export function savePage(config) {
  const updated_at = new Date().toISOString();
  db.prepare(
    "UPDATE page SET config = ?, updated_at = ? WHERE id = 1"
  ).run(JSON.stringify(config), updated_at);
  return { updated_at };
}

export function loadPreset(presetName) {
  const preset = PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`);
  }

  const sourcePath = PRESET_SOURCE_PATHS[presetName] ?? null;
  const updated_at = new Date().toISOString();
  db.prepare(
    "UPDATE page SET config = ?, preset = ?, source_path = ?, updated_at = ? WHERE id = 1"
  ).run(JSON.stringify(preset.config), presetName, sourcePath, updated_at);

  return {
    config: preset.config,
    preset: presetName,
    source_path: sourcePath,
    updated_at,
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
    "UPDATE page SET config = ?, preset = ?, source_path = ?, updated_at = ? WHERE id = 1"
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
  };
}
