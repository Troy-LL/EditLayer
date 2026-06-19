import { useRef } from "react";
import { IconEdit, IconRedo, IconSnap, IconUndo, IconX } from "../icons/index.jsx";
import { PAGE_PRESETS } from "../pagePresets.js";
import InsertMenu from "./InsertMenu.jsx";

function saveStatusLabel(status) {
  if (status === "saving") return "Saving…";
  if (status === "error") return "Save failed";
  if (status === "html-error") return "HTML sync failed";
  if (status === "saved") return "Saved";
  return "";
}

export default function Toolbar({
  editMode,
  saveStatus,
  canUndo,
  canRedo,
  canRevert,
  pagePreset,
  onSwitchPreset,
  onEdit,
  onUndo,
  onRedo,
  onRevert,
  onDone,
  onInsert,
  snapEnabled = true,
  onToggleSnap,
  snapshotsOpen,
  onToggleSnapshots,
  assetsOpen,
  onToggleAssets,
  onExport,
  onImport,
}) {
  const importRef = useRef(null);

  const handleImportChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onImport?.(file);
    e.target.value = "";
  };

  return (
    <header className="toolbar">
      <div className="toolbar-inner">
        <span className="toolbar-brand">Editor</span>
        {!editMode && (
          <nav className="toolbar-pages" aria-label="Page presets">
            {PAGE_PRESETS.map(({ id, label, hash }) => (
              <button
                key={id}
                type="button"
                className={`toolbar-page-btn${pagePreset === id ? " toolbar-page-btn-active" : ""}`}
                onClick={() => onSwitchPreset(id, hash)}
                aria-current={pagePreset === id ? "page" : undefined}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
        <div className="toolbar-actions">
          <button
            type="button"
            className={`toolbar-btn${assetsOpen ? " toolbar-btn-active" : ""}`}
            onClick={onToggleAssets}
            title="Manage uploaded assets"
          >
            Assets
          </button>
          <button type="button" className="toolbar-btn" onClick={onExport} title="Export config as JSON">
            Export
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => importRef.current?.click()}
            title="Import config from JSON"
          >
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="toolbar-import-input"
            onChange={handleImportChange}
            tabIndex={-1}
            aria-hidden="true"
          />
          {editMode ? (
            <>
              <InsertMenu onInsert={onInsert} />
              <button
                type="button"
                className={`toolbar-btn${snapshotsOpen ? " toolbar-btn-active" : ""}`}
                onClick={onToggleSnapshots}
                title="Save and restore versions"
              >
                Versions
              </button>
              <button
                type="button"
                className={`toolbar-btn toolbar-btn-icon${snapEnabled ? " toolbar-btn-active" : ""}`}
                onClick={onToggleSnap}
                title={snapEnabled ? "Snap on (click to disable)" : "Snap off (click to enable)"}
                aria-label="Toggle snap"
                aria-pressed={snapEnabled}
              >
                <IconSnap />
              </button>
              <button
                type="button"
                className="toolbar-btn toolbar-btn-icon"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <IconUndo />
              </button>
              <button
                type="button"
                className="toolbar-btn toolbar-btn-icon"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
              >
                <IconRedo />
              </button>
              <span
                className={`toolbar-status${
                  saveStatus === "error" || saveStatus === "html-error" ? " toolbar-status-error" : ""
                }`}
              >
                {saveStatusLabel(saveStatus)}
              </span>
              <button
                type="button"
                className="toolbar-btn"
                onClick={onRevert}
                disabled={!canRevert}
                title="Revert to session start"
              >
                Revert
              </button>
              <button type="button" className="toolbar-btn" onClick={onDone} title="Done">
                <IconX />
                <span>Done</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="toolbar-btn toolbar-btn-primary"
              onClick={onEdit}
              title="Edit"
            >
              <IconEdit />
              <span>Edit</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
