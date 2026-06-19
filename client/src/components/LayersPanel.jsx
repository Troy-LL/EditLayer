import { useEffect, useMemo, useState } from "react";
import { mergeElement } from "../elementDefaults.js";
import {
  buildLayerLabelMap,
  elementBaseName,
  isContainerOnSelectionPath,
  sortSiblingsForLayersPanel,
} from "../elementTree.js";
import {
  IconChevronDown,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconLock,
  IconUnlock,
} from "../icons/index.jsx";
import { SCROLL_ZONE } from "../hooks/useActiveScrollZone.js";

function LayerRow({
  element,
  depth,
  labelMap,
  selectedIds,
  dragState,
  onDragStart,
  onDragOver,
  onDragEnd,
  onSelect,
  onToggleHidden,
  onToggleLock,
  onRename,
  onMoveBefore,
}) {
  const el = mergeElement(element);
  const selected = selectedIds.includes(element.id);
  const isContainer = element.type === "container";
  const hasChildren = isContainer && (el.children?.length ?? 0) > 0;
  const onSelectionPath = isContainer && isContainerOnSelectionPath(element, selectedIds);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const isDropOver = dragState?.overId === element.id && dragState?.dragId !== element.id;
  const displayName = labelMap.get(element.id) ?? elementBaseName(element);

  useEffect(() => {
    setExpanded(onSelectionPath);
  }, [onSelectionPath]);

  const beginRename = () => {
    setDraftName(el.name || elementBaseName(element));
    setEditing(true);
  };

  const commitRename = () => {
    setEditing(false);
    onRename(element.id, draftName.trim());
  };

  return (
    <>
      <div
        className={`layers-row${selected ? " layers-row-selected" : ""}${el.hidden ? " layers-row-hidden" : ""}${el.locked ? " layers-row-locked" : ""}${isDropOver ? " layers-row-drop-over" : ""}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        draggable={!editing}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", element.id);
          e.dataTransfer.effectAllowed = "move";
          onDragStart(element.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          onDragOver(element.id);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const dragId = e.dataTransfer.getData("text/plain");
          if (dragId && dragId !== element.id) onMoveBefore(dragId, element.id);
          onDragEnd();
        }}
        onDragEnd={onDragEnd}
      >
        {isContainer ? (
          <button
            type="button"
            className={`layers-expand${expanded ? " layers-expand-open" : ""}`}
            aria-label={expanded ? "Collapse" : "Expand"}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            <IconChevronDown />
          </button>
        ) : (
          <span className="layers-expand-spacer" aria-hidden="true" />
        )}
        <button
          type="button"
          className="layers-label"
          onClick={() => onSelect(element.id)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            beginRename();
          }}
        >
          {editing ? (
            <input
              className="layers-rename-input"
              value={draftName}
              autoFocus
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setEditing(false);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="layers-name">{displayName}</span>
          )}
          <span className="layers-type">{element.type}</span>
        </button>
        <button
          type="button"
          className="layers-icon-btn layers-icon-btn-rename"
          title="Rename layer"
          aria-label="Rename layer"
          onClick={(e) => {
            e.stopPropagation();
            beginRename();
          }}
        >
          <IconEdit />
        </button>
        <button
          type="button"
          className="layers-icon-btn"
          title={el.hidden ? "Show" : "Hide"}
          aria-label={el.hidden ? "Show element" : "Hide element"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleHidden(element.id);
          }}
        >
          {el.hidden ? <IconEyeOff /> : <IconEye />}
        </button>
        <button
          type="button"
          className="layers-icon-btn"
          title={el.locked ? "Unlock" : "Lock"}
          aria-label={el.locked ? "Unlock element" : "Lock element"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock(element.id);
          }}
        >
          {el.locked ? <IconLock /> : <IconUnlock />}
        </button>
      </div>
      {isContainer &&
        expanded &&
        hasChildren &&
        sortSiblingsForLayersPanel(el.children ?? []).map((child) => (
          <LayerRow
            key={child.id}
            element={child}
            depth={depth + 1}
            labelMap={labelMap}
            selectedIds={selectedIds}
            dragState={dragState}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onSelect={onSelect}
            onToggleHidden={onToggleHidden}
            onToggleLock={onToggleLock}
            onRename={onRename}
            onMoveBefore={onMoveBefore}
          />
        ))}
    </>
  );
}

export default function LayersPanel({
  config,
  selectedIds,
  pageSelected,
  onSelectPage,
  onSelectElement,
  onToggleHidden,
  onToggleLock,
  onRename,
  onMoveBefore,
  scrollZoneActive = false,
  onScrollZoneActivate,
}) {
  const [dragState, setDragState] = useState(null);
  const labelMap = useMemo(() => buildLayerLabelMap(config.elements), [config.elements]);

  useEffect(() => {
    const clear = () => setDragState(null);
    window.addEventListener("dragend", clear);
    return () => window.removeEventListener("dragend", clear);
  }, []);

  const handleDragStart = (dragId) => {
    setDragState({ dragId, overId: dragId });
  };

  const handleDragOver = (overId) => {
    setDragState((prev) => {
      if (!prev) return prev;
      if (prev.overId === overId) return prev;
      return { ...prev, overId };
    });
  };

  const handleDragEnd = () => setDragState(null);

  return (
    <aside
      className={`layers-panel scroll-zone scroll-zone--tool${scrollZoneActive ? " scroll-zone--active" : ""}`}
      aria-label="Layers"
      onPointerDown={() => onScrollZoneActivate?.(SCROLL_ZONE.LAYERS)}
    >
      <span className="scroll-zone-indicator" aria-hidden="true">
        Layers
      </span>
      <div className="layers-header">
        <span className="layers-title">Layers</span>
        <p className="layers-hint">
          Top = in front when overlapping. Drag to reorder. Double-click or ✎ to rename.
        </p>
      </div>
      <div
        className="layers-body scroll-zone-viewport"
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) handleDragEnd();
        }}
      >
        <button
          type="button"
          className={`layers-row layers-row-page${pageSelected ? " layers-row-selected" : ""}`}
          onClick={onSelectPage}
        >
          <span className="layers-expand-spacer" aria-hidden="true" />
          <span className="layers-name">Page</span>
        </button>
        {sortSiblingsForLayersPanel(config.elements).map((el) => (
          <LayerRow
            key={el.id}
            element={el}
            depth={0}
            labelMap={labelMap}
            selectedIds={selectedIds}
            dragState={dragState}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onSelect={onSelectElement}
            onToggleHidden={onToggleHidden}
            onToggleLock={onToggleLock}
            onRename={onRename}
            onMoveBefore={onMoveBefore}
          />
        ))}
      </div>
    </aside>
  );
}
