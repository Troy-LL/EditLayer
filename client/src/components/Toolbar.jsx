import { IconEdit, IconRedo, IconUndo, IconX } from "../icons/index.jsx";
import { PAGE_PRESETS } from "../pagePresets.js";
import InsertMenu from "./InsertMenu.jsx";

function saveStatusLabel(status) {
  if (status === "saving") return "Saving…";
  if (status === "error") return "Save failed";
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
}) {
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
          {editMode ? (
            <>
              <InsertMenu onInsert={onInsert} />
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
                className={`toolbar-status${saveStatus === "error" ? " toolbar-status-error" : ""}`}
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
