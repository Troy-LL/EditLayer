import { cloneElement, useRef } from "react";
import Toolbar from "./Toolbar.jsx";
import InspectorPanel from "./InspectorPanel.jsx";
import { SCROLL_ZONE, useActiveScrollZone } from "../hooks/useActiveScrollZone.js";

export default function EditorShell({
  editMode,
  saveStatus,
  canUndo,
  canRedo,
  canRevert,
  pagePreset,
  onSwitchPreset,
  selected,
  selectionCount = 0,
  onEdit,
  onUndo,
  onRedo,
  onRevert,
  onDone,
  onInsert,
  onElementChange,
  onBeginContinuousEdit,
  onEndContinuousEdit,
  onAlignChildren,
  children,
  toast,
}) {
  const canvasRef = useRef(null);
  const [activeScrollZone, setActiveScrollZone] = useActiveScrollZone(editMode);

  const pageScrollActive = !editMode || activeScrollZone === SCROLL_ZONE.PAGE;
  const inspectorScrollActive = editMode && activeScrollZone === SCROLL_ZONE.INSPECTOR;

  return (
    <div className={`editor-app${editMode ? " editor-app--editing" : ""}`}>
      <Toolbar
        editMode={editMode}
        saveStatus={saveStatus}
        canUndo={canUndo}
        canRedo={canRedo}
        canRevert={canRevert}
        pagePreset={pagePreset}
        onSwitchPreset={onSwitchPreset}
        onEdit={onEdit}
        onUndo={onUndo}
        onRedo={onRedo}
        onRevert={onRevert}
        onDone={onDone}
        onInsert={onInsert}
      />
      <div className="editor-body">
        <main
          ref={canvasRef}
          className={`editor-canvas scroll-zone scroll-zone--page${pageScrollActive ? " scroll-zone--active" : ""}`}
          onPointerDown={() => setActiveScrollZone(SCROLL_ZONE.PAGE)}
        >
          <span className="scroll-zone-indicator" aria-hidden="true">
            Page
          </span>
          {children && cloneElement(children, { canvasRef })}
        </main>
        {editMode && selectionCount > 1 && (
          <aside
            className={`inspector inspector-multi scroll-zone scroll-zone--tool${inspectorScrollActive ? " scroll-zone--active" : ""}`}
            aria-label="Inspector"
            onPointerDown={() => setActiveScrollZone(SCROLL_ZONE.INSPECTOR)}
          >
            <span className="scroll-zone-indicator" aria-hidden="true">
              Inspector
            </span>
            <div className="inspector-header">
              <span className="inspector-title">{selectionCount} selected</span>
            </div>
            <div className="inspector-body scroll-zone-viewport">
              <p className="inspector-hint">
                Drag on empty canvas to box-select. Shift+click or Shift+drag to add. Drag selection to move all.
              </p>
            </div>
          </aside>
        )}
        {editMode && selected && selectionCount === 1 && (
          <InspectorPanel
            element={selected}
            onChange={onElementChange}
            onBeginContinuousEdit={onBeginContinuousEdit}
            onEndContinuousEdit={onEndContinuousEdit}
            onAlignChildren={onAlignChildren}
            scrollZoneActive={inspectorScrollActive}
            onScrollZoneActivate={() => setActiveScrollZone(SCROLL_ZONE.INSPECTOR)}
          />
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
