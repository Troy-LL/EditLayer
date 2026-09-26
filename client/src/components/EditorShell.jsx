import { cloneElement, useMemo } from "react";
import Toolbar from "./Toolbar.jsx";
import InspectorPanel from "./InspectorPanel.jsx";
import PageInspectorPanel from "./PageInspectorPanel.jsx";
import LayersPanel from "./LayersPanel.jsx";
import AlignDistributeSection from "./AlignDistributeSection.jsx";
import SnapshotsPanel from "./SnapshotsPanel.jsx";
import AssetManagerPanel from "./AssetManagerPanel.jsx";
import CoworkerPanel from "./CoworkerPanel.jsx";
import CoworkerFlash from "./CoworkerFlash.jsx";
import { SCROLL_ZONE, useActiveScrollZone } from "../hooks/useActiveScrollZone.js";
import { useBoardCamera } from "../hooks/useBoardCamera.js";
import { DEFAULT_VIEWPORT, viewportFrameWidth } from "../../../shared/viewport.js";

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
  onAlign,
  onDistribute,
  snapEnabled,
  onToggleSnap,
  gridSnapEnabled,
  onGridSnapChange,
  snapshotsOpen,
  onToggleSnapshots,
  onSnapshotRestore,
  assetsOpen,
  onToggleAssets,
  onExport,
  onImport,
  onPanelError,
  children,
  toast,
  overlayMode = "A",
  onOverlayMode,
  onViewportChange,
  coworker,
  coworkerOpen,
  onToggleCoworker,
  onCoworkerFix,
  onFocusElement,
}) {
  const [activeScrollZone, setActiveScrollZone] = useActiveScrollZone(editMode);
  const viewportId = config?.viewport ?? DEFAULT_VIEWPORT;
  const frameWidth = useMemo(
    () => viewportFrameWidth(viewportId, pagePreset),
    [viewportId, pagePreset]
  );
  const board = useBoardCamera({ canvasRef, frameWidth });

  const trackPointer = (e) => {
    if (lastPointerRef) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const pageScrollActive = !editMode || activeScrollZone === SCROLL_ZONE.PAGE;
  const layersScrollActive = editMode && activeScrollZone === SCROLL_ZONE.LAYERS;
  const inspectorOpen = editMode && (pageSelected || selectionCount > 0);
  const inspectorScrollActive = inspectorOpen && activeScrollZone === SCROLL_ZONE.INSPECTOR;

  const canvasClass = [
    "editor-canvas",
    "scroll-zone",
    "scroll-zone--page",
    pageScrollActive ? "scroll-zone--active" : "",
    board.spaceDown ? "editor-canvas--space" : "",
    board.panning ? "editor-canvas--panning" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`editor-app${editMode ? " editor-app--editing" : ""}${editMode ? " editor-app--layers-open" : ""}${inspectorOpen ? " editor-app--inspector-open" : ""}`}
    >
      <div className="toolbar-wrap">
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
          snapEnabled={snapEnabled}
          onToggleSnap={onToggleSnap}
          snapshotsOpen={snapshotsOpen}
          onToggleSnapshots={onToggleSnapshots}
          assetsOpen={assetsOpen}
          onToggleAssets={onToggleAssets}
          onExport={onExport}
          onImport={onImport}
          overlayMode={overlayMode}
          onOverlayMode={onOverlayMode}
          viewport={viewportId}
          onViewportChange={onViewportChange}
          boardZoom={board.zoom}
          boardFitMode={board.fitMode}
          onZoomIn={board.zoomIn}
          onZoomOut={board.zoomOut}
          onZoomTo100={board.zoomTo100}
          onZoomToFit={board.zoomToFit}
          coworkerOpen={coworkerOpen}
          onToggleCoworker={onToggleCoworker}
          coworkerOpenCount={coworker?.openCount ?? 0}
          aiActive={coworker?.aiActive ?? false}
        />
        <SnapshotsPanel
          open={snapshotsOpen}
          onClose={() => onToggleSnapshots?.(false)}
          onRestore={onSnapshotRestore}
          onError={onPanelError}
        />
        <AssetManagerPanel
          open={assetsOpen}
          onClose={() => onToggleAssets?.(false)}
          onError={onPanelError}
        />
        {coworker && (
          <CoworkerPanel
            open={coworkerOpen}
            onClose={() => onToggleCoworker?.(false)}
            config={config}
            selectedId={selectionCount === 1 ? selectedIds[selectedIds.length - 1] : null}
            requests={coworker.requests}
            activity={coworker.activity}
            onAsk={coworker.ask}
            onResolve={coworker.resolve}
            onFix={onCoworkerFix}
            onFocusElement={onFocusElement}
          />
        )}
      </div>
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
          className={canvasClass}
          style={{ "--board-zoom": String(board.zoom) }}
          data-board-space={board.spaceDown || board.panning ? "true" : undefined}
          onPointerDown={(e) => {
            setActiveScrollZone(SCROLL_ZONE.PAGE);
            board.boardPointer.onPointerDown(e);
          }}
          onPointerMove={(e) => {
            if (editMode) trackPointer(e);
            board.boardPointer.onPointerMove(e);
          }}
          onPointerUp={board.boardPointer.onPointerUp}
          onPointerCancel={board.boardPointer.onPointerCancel}
        >
          <span className="scroll-zone-indicator" aria-hidden="true">
            Board
          </span>
          <div className="board-world">
            <div className="board-surface">
              {children &&
                cloneElement(children, {
                  canvasRef,
                  boardZoom: board.zoom,
                })}
            </div>
          </div>
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
              <AlignDistributeSection
                selectionCount={selectionCount}
                onAlign={onAlign}
                onDistribute={onDistribute}
                gridSnapEnabled={gridSnapEnabled}
                onGridSnapChange={onGridSnapChange}
              />
              <p className="inspector-hint">
                Drag on empty canvas to box-select. Shift+click or Shift+drag to add. Drag selection to
                move all. Space-drag pans the board.
              </p>
            </div>
          </aside>
        )}
        {editMode && !pageSelected && selected && selectionCount === 1 && (
          <InspectorPanel
            element={selected}
            elements={config.elements}
            onChange={onElementChange}
            onLayerOrder={onLayerOrder}
            onBeginContinuousEdit={onBeginContinuousEdit}
            onEndContinuousEdit={onEndContinuousEdit}
            onAlignChildren={onAlignChildren}
            onAlign={onAlign}
            onDistribute={onDistribute}
            gridSnapEnabled={gridSnapEnabled}
            onGridSnapChange={onGridSnapChange}
            scrollZoneActive={inspectorScrollActive}
            onScrollZoneActivate={() => setActiveScrollZone(SCROLL_ZONE.INSPECTOR)}
            overlayMode={overlayMode}
          />
        )}
      </div>
      {coworker && <CoworkerFlash flashes={coworker.flashes} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
