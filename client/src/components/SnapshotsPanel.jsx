import { useEffect, useRef, useState } from "react";
import {
  createSnapshot,
  deleteSnapshot,
  fetchSnapshots,
  restoreSnapshot,
} from "../api.js";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function SnapshotsPanel({ open, onClose, onRestore, onError }) {
  const [snapshots, setSnapshots] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSnapshots();
      setSnapshots(data.snapshots ?? []);
    } catch (err) {
      onError?.(err.message ?? "Failed to load snapshots");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onClose]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const data = await createSnapshot(trimmed);
      setSnapshots((prev) => [data.snapshot, ...prev]);
      setName("");
    } catch (err) {
      onError?.(err.message ?? "Failed to save snapshot");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      const data = await restoreSnapshot(id);
      onRestore(data);
      onClose();
    } catch (err) {
      onError?.(err.message ?? "Failed to restore snapshot");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSnapshot(id);
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      onError?.(err.message ?? "Failed to delete snapshot");
    }
  };

  if (!open) return null;

  return (
    <div className="toolbar-panel-root" ref={rootRef}>
      <div className="toolbar-panel" role="dialog" aria-label="Versions">
        <div className="toolbar-panel-header">
          <span className="toolbar-panel-title">Versions</span>
          <button type="button" className="toolbar-panel-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="toolbar-panel-save-row">
          <input
            ref={inputRef}
            type="text"
            className="toolbar-panel-input"
            placeholder="Snapshot name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <button
            type="button"
            className="toolbar-btn"
            onClick={handleSave}
            disabled={!name.trim() || saving}
          >
            Save
          </button>
        </div>
        <div className="toolbar-panel-list">
          {loading && <p className="toolbar-panel-empty">Loading…</p>}
          {!loading && snapshots.length === 0 && (
            <p className="toolbar-panel-empty">No snapshots yet.</p>
          )}
          {!loading &&
            snapshots.map((snapshot) => (
              <div key={snapshot.id} className="toolbar-panel-row">
                <div className="toolbar-panel-row-main">
                  <span className="toolbar-panel-row-name">{snapshot.name}</span>
                  <span className="toolbar-panel-row-meta">
                    {formatDate(snapshot.created_at)}
                    {snapshot.preset ? (
                      <span className="toolbar-panel-badge">{snapshot.preset}</span>
                    ) : null}
                  </span>
                </div>
                <div className="toolbar-panel-row-actions">
                  <button
                    type="button"
                    className="toolbar-panel-action"
                    onClick={() => handleRestore(snapshot.id)}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="toolbar-panel-action toolbar-panel-action-danger"
                    onClick={() => handleDelete(snapshot.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
