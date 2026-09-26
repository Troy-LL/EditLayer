import { useRef } from "react";
import { IconEdit, IconRedo, IconSnap, IconUndo, IconX } from "../icons/index.jsx";
import { PAGE_PRESETS } from "../pagePresets.js";
import { OVERLAY_MODES, OVERLAY_META } from "../../../shared/overlay/modes.js";
import { DEFAULT_VIEWPORT, VIEWPORT_IDS, VIEWPORTS } from "../../../shared/viewport.js";
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
  overlayMode = "A",
  onOverlayMode,
  viewport = DEFAULT_VIEWPORT,
  onViewportChange,
  boardZoom = 1,
  boardFitMode = true,
  onZoomIn,
  onZoomOut,
  onZoomTo100,
  onZoomToFit,
  coworkerOpen,
  onToggleCoworker,
  coworkerOpenCount = 0,
  aiActive = false,
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
        <nav className="toolbar-overlay" aria-label="Overlay prototype">
          {OVERLAY_MODES.map((id) => (
            <button
              key={id}
              type="button"
              className={`toolbar-overlay-btn${overlayMode === id ? " toolbar-overlay-btn-active" : ""}`}
              onClick={() => onOverlayMode?.(id)}
              title={OVERLAY_META[id].title}
              aria-pressed={overlayMode === id}
            >
              {id}
            </button>
          ))}
        </nav>
        <nav className="toolbar-viewport" aria-label="Canvas viewport">
          {VIEWPORT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={`toolbar-viewport-btn${viewport === id ? " toolbar-viewport-btn-active" : ""}`}
              onClick={() => onViewportChange?.(id)}
              title={`${VIEWPORTS[id].label}${VIEWPORTS[id].width ? ` · ${VIEWPORTS[id].width}px` : " · 1280px"}`}
              aria-label={VIEWPORTS[id].label}
              aria-pressed={viewport === id}
            >
              {VIEWPORTS[id].short}
            </button>
          ))}
        </nav>
        <nav className="toolbar-zoom" aria-label="Board zoom">
          <button
            type="button"
            className="toolbar-btn toolbar-btn-icon"
            onClick={onZoomOut}
            title="Zoom out (⌘−)"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="toolbar-zoom-label"
            onClick={onZoomTo100}
            title="Reset to 100%"
            aria-label={boardFitMode ? "Fit width, click for 100%" : `${Math.round(boardZoom * 100)} percent, click for 100%`}
          >
            {boardFitMode ? "Fit" : `${Math.round(boardZoom * 100)}%`}
          </button>
          <button
            type="button"
            className="toolbar-btn toolbar-btn-icon"
            onClick={onZoomIn}
            title="Zoom in (⌘+)"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className={`toolbar-btn${boardFitMode ? " toolbar-btn-active" : ""}`}
            onClick={onZoomToFit}
            title="Fit artboard to board width"
            aria-pressed={boardFitMode}
          >
            Fit
          </button>
        </nav>
        <div className="toolbar-actions">
          {!editMode && (
            <button type="button" className="toolbar-btn toolbar-btn-primary" onClick={onEdit}>
              <IconEdit />
              Edit
            </button>
          )}
          <button
            type="button"
            className={`toolbar-btn coworker-toggle${coworkerOpen ? " toolbar-btn-active" : ""}`}
            onClick={() => onToggleCoworker?.()}
            title={aiActive ? "Your AI co-worker is editing" : "Requests, review, and activity with your AI co-worker"}
            aria-pressed={coworkerOpen}
          >
            <span className={`coworker-presence${aiActive ? " coworker-presence-active" : ""}`} aria-hidden="true" />
            <span>Co-worker</span>
            {coworkerOpenCount > 0 && (
              <span className="coworker-count" aria-label={`${coworkerOpenCount} open requests`}>
                {coworkerOpenCount}
              </span>
            )}
          </button>
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
          ) : null}
        </div>
      </div>
    </header>
  );
}
