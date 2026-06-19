import { useEffect, useRef, useState } from "react";
import { deleteAsset, fetchAssets } from "../api.js";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetManagerPanel({ open, onClose, onError }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const rootRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAssets();
      setAssets(data.assets ?? []);
    } catch (err) {
      onError?.(err.message ?? "Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    load();
    setConfirmDelete(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (confirmDelete) setConfirmDelete(null);
        else onClose();
      }
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
  }, [open, onClose, confirmDelete]);

  const handleDelete = async (filename) => {
    try {
      await deleteAsset(filename);
      setAssets((prev) => prev.filter((a) => a.filename !== filename));
      setConfirmDelete(null);
    } catch (err) {
      onError?.(err.message ?? "Failed to delete asset");
    }
  };

  if (!open) return null;

  return (
    <div className="toolbar-panel-root toolbar-panel-root-wide" ref={rootRef}>
      <div className="toolbar-panel" role="dialog" aria-label="Assets">
        <div className="toolbar-panel-header">
          <span className="toolbar-panel-title">Assets</span>
          <button type="button" className="toolbar-panel-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="asset-grid">
          {loading && <p className="toolbar-panel-empty">Loading…</p>}
          {!loading && assets.length === 0 && (
            <p className="toolbar-panel-empty">No uploaded images yet.</p>
          )}
          {!loading &&
            assets.map((asset) => (
              <div key={asset.filename} className="asset-card">
                <div className="asset-thumb-wrap">
                  <img
                    src={asset.url}
                    alt={asset.filename}
                    className="asset-thumb"
                    loading="lazy"
                  />
                </div>
                <div className="asset-meta">
                  <span className="asset-filename" title={asset.filename}>
                    {asset.filename}
                  </span>
                  <span className="asset-size">{formatSize(asset.size)}</span>
                </div>
                {confirmDelete === asset.filename ? (
                  <div className="asset-confirm">
                    <span>Delete?</span>
                    <button
                      type="button"
                      className="toolbar-panel-action toolbar-panel-action-danger"
                      onClick={() => handleDelete(asset.filename)}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className="toolbar-panel-action"
                      onClick={() => setConfirmDelete(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="toolbar-panel-action toolbar-panel-action-danger asset-delete"
                    onClick={() => setConfirmDelete(asset.filename)}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
