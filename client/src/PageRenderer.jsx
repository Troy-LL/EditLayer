import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Selecto from "react-selecto";
import { mergeElement, mergeConfig, PAGE_BACKGROUND_DEFAULT } from "./elementDefaults.js";
import { findElementById, isElementLocked, elementsLayoutKey } from "./elementTree.js";
import {
  captureVisualRelatives,
  computePlacementOffsets,
  elementVisualClientPoint,
  groupOriginClientPoint,
  isClientPointInElementsFrame,
  PASTE_CURSOR_NUDGE,
  PASTE_STEP_OFFSET,
  PLACEMENT_ORIGIN_OFFSET,
} from "./elementPlacement.js";
import SelectionOverlay from "./components/SelectionOverlay.jsx";
import ContextMenu from "./components/ContextMenu.jsx";
import { buildBoxStyle } from "../../shared/overlay/elementBoxStyle.js";
import { getOverlay } from "../../shared/overlay/index.js";
import { pinFrameStyle } from "../../shared/overlay/placement.js";

function buildStyle(el, type) {
  return buildBoxStyle(el, type);
}

function withOptionalPin(pin, node) {
  if (!pin) return node;
  return (
    <div className="overlay-pin" data-overlay-pin="" style={pinFrameStyle(pin)}>
      {node}
    </div>
  );
}

const selectableProps = (elementId) => ({
  "data-element-id": elementId,
});

function ElementView({
  element,
  editMode,
  selected,
  selectedIdSet,
  onSelect,
  registerRef,
  onContextMenu,
  livePin = null,
  selectPins = {},
  overlay = getOverlay("A"),
}) {
  const el = mergeElement(element);
  if (el.hidden) return null;

  const pin = el.pin ?? livePin;
  const viewEl =
    livePin && !el.pin ? { ...el, pin: livePin, positioning: "pinned" } : el;
  const style = buildStyle(viewEl, element.type);
  const styleOnly = selected && !overlay.canClaimHandles(el);
  const className = `editable${selected ? " selected" : ""}${styleOnly ? " selected-style-only" : ""}${el.locked ? " element-locked" : ""}`;
  const dataProps = selectableProps(element.id);
  const editPointerProps =
    editMode && !el.locked
      ? {
          onMouseDown: (e) => {
            if (e.button === 0) e.preventDefault();
          },
          onClick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.getSelection()?.removeAllRanges();
            onSelect(element.id, { additive: e.shiftKey });
          },
        }
      : {};
  const handleContextMenu = editMode
    ? (e) => onContextMenu(e, element.id)
    : undefined;
  const setRef = (node) => registerRef(element.id, node);

  if (element.type === "heading") {
    return withOptionalPin(
      pin,
      <h1
        className={className}
        style={style}
        {...editPointerProps}
        onContextMenu={handleContextMenu}
        ref={setRef}
        {...dataProps}
      >
        {el.text}
      </h1>
    );
  }

  if (element.type === "paragraph") {
    return withOptionalPin(
      pin,
      <p className={className} style={style} {...editPointerProps} onContextMenu={handleContextMenu} ref={setRef} {...dataProps}>
        {el.text}
      </p>
    );
  }

  if (element.type === "image") {
    const imgStyle = {
      width: "100%",
      height: el.height != null ? "100%" : "auto",
      objectFit: el.objectFit,
      display: "block",
      borderRadius: `${el.borderRadius}px`,
    };
    return withOptionalPin(
      pin,
      <div className={className} style={style} {...editPointerProps} onContextMenu={handleContextMenu} ref={setRef} {...dataProps}>
        {el.src ? (
          <img src={el.src} alt={el.alt} style={imgStyle} draggable={false} />
        ) : (
          <div className="image-placeholder" style={{ height: el.height ?? 160 }}>
            No image
          </div>
        )}
      </div>
    );
  }

  if (element.type === "button") {
    if (editMode) {
      return withOptionalPin(
        pin,
        <button
          type="button"
          className={className}
          style={style}
          {...editPointerProps}
          onContextMenu={handleContextMenu}
          ref={setRef}
          {...dataProps}
        >
          {el.label}
        </button>
      );
    }
    if (el.href) {
      return withOptionalPin(
        pin,
        <a
          className={className}
          style={style}
          href={el.href}
          target={el.target}
          rel={el.target === "_blank" ? "noopener noreferrer" : undefined}
          ref={setRef}
          {...dataProps}
        >
          {el.label}
        </a>
      );
    }
    return withOptionalPin(
      pin,
      <button type="button" className={className} style={style} ref={setRef} {...dataProps}>
        {el.label}
      </button>
    );
  }

  if (element.type === "link") {
    if (editMode || !el.href) {
      return withOptionalPin(
        pin,
        <span
          className={className}
          style={style}
          {...editPointerProps}
          onContextMenu={handleContextMenu}
          ref={setRef}
          {...dataProps}
        >
          {el.text}
        </span>
      );
    }
    return withOptionalPin(
      pin,
      <a
        className={className}
        style={style}
        href={el.href}
        target={el.target}
        rel={el.target === "_blank" ? "noopener noreferrer" : undefined}
        ref={setRef}
        {...dataProps}
      >
        {el.text}
      </a>
    );
  }

  if (element.type === "divider") {
    const lineStyle = {
      height: `${el.dividerThickness}px`,
      backgroundColor: el.dividerColor,
      width: "100%",
      borderRadius: 1,
    };
    return withOptionalPin(
      pin,
      <div
        className={className}
        style={style}
        {...editPointerProps}
        onContextMenu={handleContextMenu}
        ref={setRef}
        aria-hidden="true"
        {...dataProps}
      >
        <div style={lineStyle} />
      </div>
    );
  }

  if (element.type === "list") {
    const Tag = el.ordered ? "ol" : "ul";
    return withOptionalPin(
      pin,
      <Tag
        className={className}
        style={style}
        {...editPointerProps}
        onContextMenu={handleContextMenu}
        ref={setRef}
        {...dataProps}
      >
        {(el.items ?? []).map((item, i) => (
          <li key={`${element.id}-item-${i}`}>{item}</li>
        ))}
      </Tag>
    );
  }

  if (element.type === "container") {
    const containerStyle = {
      ...style,
      boxSizing: "border-box",
      minHeight: el.height != null ? undefined : 40,
    };
    if (style.position !== "absolute") {
      containerStyle.position = "relative";
    }
    return withOptionalPin(
      pin,
      <div
        className={`${className} element-container`}
        style={containerStyle}
        {...editPointerProps}
        onContextMenu={handleContextMenu}
        ref={setRef}
        {...dataProps}
      >
        {(el.children ?? []).map((child) => (
          <ElementView
            key={child.id}
            element={child}
            editMode={editMode}
            selected={editMode && selectedIdSet.has(child.id)}
            selectedIdSet={selectedIdSet}
            onSelect={onSelect}
            registerRef={registerRef}
            onContextMenu={onContextMenu}
            livePin={selectPins[child.id] ?? null}
            selectPins={selectPins}
            overlay={overlay}
          />
        ))}
      </div>
    );
  }

  return withOptionalPin(
    pin,
    <p className={className} style={style} {...editPointerProps} onContextMenu={handleContextMenu} ref={setRef} {...dataProps}>
      {el.text}
    </p>
  );
}

function CanvasSelecto({ canvasRef, editMode, onSelectMany, onClearSelection }) {
  const [container, setContainer] = useState(null);

  useEffect(() => {
    setContainer(canvasRef?.current ?? null);
  }, [canvasRef, editMode]);

  if (!editMode || !container) return null;

  return (
    <Selecto
      container={container}
      dragContainer={container}
      selectableTargets={[".editable:not(.element-locked)"]}
      selectByClick={false}
      selectFromInside={false}
      continueSelect={false}
      toggleContinueSelect="shift"
      hitRate={0}
      scrollOptions={{
        container,
        throttleTime: 20,
        threshold: 0,
      }}
      dragCondition={(e) => {
        const target = e.inputEvent.target;
        if (target.closest(".moveable-control-box")) return false;
        if (target.closest(".editable")) return false;
        if (target.closest(".context-menu")) return false;
        return true;
      }}
      onSelectEnd={(e) => {
        const ids = e.selected
          .map((el) => el.dataset.elementId)
          .filter(Boolean);
        if (!ids.length) {
          if (!e.inputEvent?.shiftKey) onClearSelection();
          return;
        }
        onSelectMany(ids, { additive: e.inputEvent?.shiftKey });
      }}
    />
  );
}

export default function PageRenderer({
  config,
  pagePreset = "demo",
  editMode,
  selectedIds,
  onSelect,
  onSelectMany,
  onClearSelection,
  onElementChange,
  onElementsChange,
  onBeginContinuousEdit,
  onEndContinuousEdit,
  hasClipboard,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  canGroup,
  canUngroup,
  onLayerOrder,
  lastPointerRef,
  pageRef,
  canvasRef,
  placementApiRef,
  placementJob,
  onApplyPlacement,
  onPlacementDone,
  snapEnabled = true,
  gridSnapEnabled = false,
  overlayMode = "A",
}) {
  const overlay = getOverlay(overlayMode);
  const elementRefs = useRef({});
  const localPageRef = useRef(null);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectPins, setSelectPins] = useState({});
  const selectPinsRef = useRef({});
  selectPinsRef.current = selectPins;

  const selectedId = selectedIds[selectedIds.length - 1] ?? null;
  const selectedIdSet = new Set(selectedIds);

  const setPageRef = useCallback(
    (node) => {
      localPageRef.current = node;
      if (pageRef) pageRef.current = node;
    },
    [pageRef]
  );

  const registerRef = useCallback((id, node) => {
    elementRefs.current[id] = node;
  }, []);

  useLayoutEffect(() => {
    if (!placementApiRef) return;
    placementApiRef.current = {
      captureVisualRelatives: (ids) =>
        captureVisualRelatives(localPageRef.current, elementRefs.current, ids),
      getElementClientPoint: (id) => {
        const el = elementRefs.current[id];
        return el ? elementVisualClientPoint(el) : null;
      },
      getGroupOriginClientPoint: (ids) =>
        groupOriginClientPoint(elementRefs.current, ids),
      isPointInElementsFrame: (point, ids) =>
        isClientPointInElementsFrame(point, elementRefs.current, ids),
    };
  });

  useLayoutEffect(() => {
    if (!placementJob || !onApplyPlacement) return;

    const { ids, anchorClient, visualRelatives, originOffset = PLACEMENT_ORIGIN_OFFSET } =
      placementJob;

    const allExist = ids.every((id) => findElementById(config.elements, id));
    if (!allExist) {
      onPlacementDone?.();
      return;
    }

    let raf2 = 0;

    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const pageEl = localPageRef.current;
        if (!pageEl) {
          onPlacementDone?.();
          return;
        }

        const ready = ids.every((id) => elementRefs.current[id]);
        if (!ready) {
          onPlacementDone?.();
          return;
        }

        const updates = computePlacementOffsets(
          pageEl,
          elementRefs.current,
          ids,
          anchorClient,
          visualRelatives,
          originOffset
        );

        onApplyPlacement(updates);
        onPlacementDone?.();
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [placementJob, config, onApplyPlacement, onPlacementDone]);

  useLayoutEffect(() => {
    const nodes = selectedIds
      .filter((id) => !isElementLocked(config.elements, id))
      .map((id) => elementRefs.current[id])
      .filter(Boolean);
    setSelectedNodes(nodes);
  }, [selectedIds, config, selectPins]);

  useLayoutEffect(() => {
    if (!editMode || overlay.id !== "B") {
      setSelectPins((prev) => (Object.keys(prev).length ? {} : prev));
      return;
    }
    setSelectPins((prev) => {
      const next = {};
      for (const id of selectedIds) {
        if (prev[id]) {
          next[id] = prev[id];
          continue;
        }
        const raw = findElementById(config.elements, id);
        if (!raw) continue;
        const pin = overlay.measureSelectPin(mergeElement(raw), elementRefs.current[id]);
        if (pin) next[id] = pin;
      }
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && nextKeys.every((k) => prev[k] === next[k])) {
        return prev;
      }
      return next;
    });
  }, [editMode, overlay, overlayMode, selectedIds, config]);

  useEffect(() => {
    if (!editMode) setContextMenu(null);
  }, [editMode]);

  const trackPointer = useCallback(
    (e) => {
      if (lastPointerRef) {
        lastPointerRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [lastPointerRef]
  );

  const handleContextMenu = useCallback(
    (e, elementId) => {
      e.preventDefault();
      trackPointer(e);
      const el = findElementById(config.elements, elementId);
      if (el && mergeElement(el).locked) return;
      if (!selectedIdSet.has(elementId)) {
        onSelect(elementId, { additive: false });
      }
      setContextMenu({ x: e.clientX, y: e.clientY, elementId });
    },
    [onSelect, selectedIdSet, trackPointer, config.elements]
  );

  const handlePageContextMenu = useCallback(
    (e) => {
      if (!editMode || !hasClipboard) return;
      if (e.target !== localPageRef.current) return;
      e.preventDefault();
      trackPointer(e);
      setContextMenu({ x: e.clientX, y: e.clientY, elementId: null });
    },
    [editMode, hasClipboard, trackPointer]
  );

  const handlePageClick = useCallback(
    (e) => {
      if (!editMode) return;
      if (e.target !== localPageRef.current && !e.target.closest(".page-empty")) return;
      onClearSelection?.();
    },
    [editMode, onClearSelection]
  );

  const mergedConfig = mergeConfig(config);
  const pageStyle =
    mergedConfig.pageBackground && mergedConfig.pageBackground !== PAGE_BACKGROUND_DEFAULT
      ? { backgroundColor: mergedConfig.pageBackground }
      : undefined;

  const unlockedSelectedIds = selectedIds.filter((id) => !isElementLocked(config.elements, id));
  const unlockedSelectedElements = unlockedSelectedIds
    .map((id) => findElementById(config.elements, id))
    .filter(Boolean)
    .map((el) => mergeElement(el));

  const selectedElements = selectedIds
    .map((id) => findElementById(config.elements, id))
    .filter(Boolean)
    .map((el) => mergeElement(el));

  const handleableElements = unlockedSelectedElements.filter((el) => overlay.canClaimHandles(el));
  const handleableIds = handleableElements.map((el) => el.id);
  const handleableNodes = handleableIds.map((id) => elementRefs.current[id]).filter(Boolean);

  const singleHandleable = handleableElements.length === 1 ? handleableElements[0] : null;
  const singleHandleableId = handleableIds[0] ?? null;

  const layoutKey = elementsLayoutKey(config.elements);
  const singleRootContainer =
    singleHandleableId != null
      ? overlay.moveableRoot(elementRefs.current[singleHandleableId])
      : null;
  const targetRef = useRef(null);
  targetRef.current =
    handleableIds.length === 1 ? elementRefs.current[handleableIds[0]] ?? null : null;

  const applyOffsetPatch = (id, next) => {
    const raw = findElementById(config.elements, id);
    if (!raw) return;
    const patch = overlay.patchOffset(mergeElement(raw), next);
    if (patch) onElementChange(id, patch);
  };

  const endOverlayGesture = () => {
    if (overlay.id === "B" && onElementsChange) {
      const updates = [];
      for (const id of selectedIds) {
        const raw = findElementById(config.elements, id);
        if (!raw) continue;
        const patch = overlay.commitSelectPin(mergeElement(raw), selectPinsRef.current[id]);
        if (patch && Object.keys(patch).length) updates.push({ id, ...patch });
      }
      if (updates.length) onElementsChange(updates);
    }
    onEndContinuousEdit();
  };

  const snapGuidelineSet = new Set(unlockedSelectedIds);
  const elementGuidelines = Object.entries(elementRefs.current)
    .filter(([id]) => !snapGuidelineSet.has(id))
    .map(([, node]) => node)
    .filter(Boolean);

  return (
    <>
      <div
        ref={setPageRef}
        className={`page page--${pagePreset} page--overlay-${overlayMode.toLowerCase()}${editMode ? " edit-mode" : ""}`}
        style={pageStyle}
        onMouseMove={editMode ? trackPointer : undefined}
        onClick={handlePageClick}
        onContextMenu={handlePageContextMenu}
      >
        {editMode && config.elements.length === 0 && (
          <div className="page-empty">
            <p className="page-empty-title">No elements yet</p>
            <p className="page-empty-hint">
              Click <strong>+ Insert</strong> in the toolbar to add elements.
            </p>
          </div>
        )}
        {config.elements.map((el) => (
          <ElementView
            key={el.id}
            element={el}
            editMode={editMode}
            selected={editMode && selectedIdSet.has(el.id)}
            selectedIdSet={selectedIdSet}
            onSelect={onSelect}
            registerRef={registerRef}
            onContextMenu={handleContextMenu}
            livePin={selectPins[el.id] ?? null}
            selectPins={selectPins}
            overlay={overlay}
          />
        ))}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            canPaste={hasClipboard}
            canGroup={canGroup}
            canUngroup={canUngroup}
            onGroup={() => onGroup?.()}
            onUngroup={() => onUngroup?.()}
            onLayerOrder={
              contextMenu.elementId
                ? (action) => onLayerOrder?.(action, contextMenu.elementId)
                : undefined
            }
            onCopy={() =>
              onCopy(contextMenu.elementId, {
                x: contextMenu.x,
                y: contextMenu.y,
              })
            }
            onCut={() =>
              onCut(contextMenu.elementId, {
                x: contextMenu.x,
                y: contextMenu.y,
              })
            }
            onDuplicate={() => onDuplicate(contextMenu.elementId)}
            onDelete={
              contextMenu.elementId
                ? () => onDelete(contextMenu.elementId)
                : undefined
            }
            onPaste={() =>
              onPaste(contextMenu.elementId, {
                x: contextMenu.x,
                y: contextMenu.y,
              })
            }
            onClose={() => setContextMenu(null)}
          />
        )}
        {editMode && handleableNodes.length === 1 && singleHandleable && (
          <SelectionOverlay
            key={`single-${singleHandleableId}-${layoutKey}-${overlayMode}`}
            mode="single"
            targetRef={targetRef}
            scrollContainerRef={canvasRef}
            layoutKey={layoutKey}
            rootContainer={singleRootContainer}
            offsetX={singleHandleable.offsetX}
            offsetY={singleHandleable.offsetY}
            snapEnabled={snapEnabled}
            gridSnapEnabled={gridSnapEnabled}
            elementGuidelines={elementGuidelines}
            onDragStart={onBeginContinuousEdit}
            onDrag={(offsetX, offsetY) => applyOffsetPatch(singleHandleableId, { offsetX, offsetY })}
            onResize={({ width, height, offsetX, offsetY }) =>
              applyOffsetPatch(singleHandleableId, { width, height, offsetX, offsetY })
            }
            onGestureEnd={endOverlayGesture}
          />
        )}
        {editMode && handleableNodes.length > 1 && (
          <SelectionOverlay
            key={`group-${handleableIds.join("-")}-${layoutKey}-${overlayMode}`}
            mode="group"
            targets={handleableNodes}
            selectedElements={handleableElements}
            scrollContainerRef={canvasRef}
            layoutKey={layoutKey}
            snapEnabled={snapEnabled}
            gridSnapEnabled={gridSnapEnabled}
            elementGuidelines={elementGuidelines}
            onDragStart={onBeginContinuousEdit}
            onDragGroup={(updates) => {
              const next = updates.flatMap(({ id, offsetX, offsetY }) => {
                const el = handleableElements.find((item) => item.id === id);
                if (!el) return [];
                const patch = overlay.patchOffset(el, { offsetX, offsetY });
                return patch ? [{ id, ...patch }] : [];
              });
              if (next.length) onElementsChange(next);
            }}
            onGestureEnd={endOverlayGesture}
          />
        )}
      </div>
      <CanvasSelecto
        canvasRef={canvasRef}
        editMode={editMode}
        onSelectMany={onSelectMany}
        onClearSelection={onClearSelection}
      />
    </>
  );
}
