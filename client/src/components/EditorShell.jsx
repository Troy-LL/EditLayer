import { cloneElement } from "react";
import Toolbar from "./Toolbar.jsx";
import InspectorPanel from "./InspectorPanel.jsx";
import PageInspectorPanel from "./PageInspectorPanel.jsx";
import LayersPanel from "./LayersPanel.jsx";
import { SCROLL_ZONE, useActiveScrollZone } from "../hooks/useActiveScrollZone.js";

export default function EditorShell({
  editMode,
  saveStatus,
  canUndo,
  canRedo,
  canRevert,
  pagePreset,
  onSwitchPreset,
  config,
  selectedIds,
  pageSelected,
  onSelectPage,
  onSelectElement,
  onToggleHidden,
  onToggleLock,
  onRenameLayer,
  onMoveLayerBefore,
  onLayerOrder,
  onPageChange,
  selected,
  selectionCount = 0,
  onEdit,
  onUndo,
  onRedo,
  onRevert,
  onDone,
  onInsert,
  canvasRef,
  lastPointerRef,
  onElementChange,
  onBeginContinuousEdit,
  onEndContinuousEdit,
  onAlignChildren,
  children,
  toast,
}) {
  const [activeScrollZone, setActiveScrollZone] = useActiveScrollZone(editMode);

  const trackPointer = (e) => {
    if (lastPointerRef) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const pageScrollActive = !editMode || activeScrollZone === SCROLL_ZONE.PAGE;
  const layersScrollActive = editMode && activeScrollZone === SCROLL_ZONE.LAYERS;
  const inspectorOpen = editMode && (pageSelected || selectionCount > 0);
  const inspectorScrollActive = inspectorOpen && activeScrollZone === SCROLL_ZONE.INSPECTOR;

  return (
    <div
      className={`editor-app${editMode ? " editor-app--editing" : ""}${editMode ? " editor-app--layers-open" : ""}${inspectorOpen ? " editor-app--inspector-open" : ""}`}
    >
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
        {editMode && (
          <LayersPanel
            config={config}
            selectedIds={selectedIds}
            pageSelected={pageSelected}
            onSelectPage={onSelectPage}
            onSelectElement={onSelectElement}
            onToggleHidden={onToggleHidden}
            onToggleLock={onToggleLock}
            onRename={onRenameLayer}
            onMoveBefore={onMoveLayerBefore}
        onLayerOrder={onLayerOrder}
            scrollZoneActive={layersScrollActive}
            onScrollZoneActivate={setActiveScrollZone}
          />
        )}
        <main
          ref={canvasRef}
          className={`editor-canvas scroll-zone scroll-zone--page${pageScrollActive ? " scroll-zone--active" : ""}`}
          onPointerDown={() => setActiveScrollZone(SCROLL_ZONE.PAGE)}
          onPointerMove={editMode ? trackPointer : undefined}
        >
          <span className="scroll-zone-indicator" aria-hidden="true">
            Page
          </span>
          {children && cloneElement(children, { canvasRef })}
        </main>
        {editMode && pageSelected && (
          <PageInspectorPanel
            config={config}
            onPageChange={onPageChange}
            onBeginContinuousEdit={onBeginContinuousEdit}
            onEndContinuousEdit={onEndContinuousEdit}
            scrollZoneActive={inspectorScrollActive}
            onScrollZoneActivate={() => setActiveScrollZone(SCROLL_ZONE.INSPECTOR)}
          />
        )}
        {editMode && !pageSelected && selectionCount > 1 && (
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
        {editMode && !pageSelected && selected && selectionCount === 1 && (
          <InspectorPanel
            element={selected}
            onChange={onElementChange}
            onLayerOrder={onLayerOrder}
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
