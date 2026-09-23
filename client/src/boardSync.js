import { applyOps } from "../../shared/coworker/ops.js";
import { mergeConfig } from "./elementDefaults.js";
import { configsEqual } from "./hooks/useConfigHistory.js";

/**
 * Fold a remote board change into this tab's state. When the tab has unsaved edits and
 * the change carries resolved ops, replay those ops on top of local work so neither side
 * is lost; the next auto-save then writes the merged result.
 */
export function resolveRemoteChange({ local, saved, event }) {
  if (!event?.config) return null;
  const server = mergeConfig(event.config);
  const dirty = local && saved && !configsEqual(local, saved);
  if (dirty && Array.isArray(event.ops)) {
    const replay = applyOps(local, event.ops);
    if (replay.ok) return { config: mergeConfig(replay.config), saved: server, replayed: true };
  }
  return { config: server, saved: server, replayed: false };
}
