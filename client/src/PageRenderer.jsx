import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Selecto from "react-selecto";
import { headingTagLevel, mergeElement, mergeConfig } from "./elementDefaults.js";
import { canCanvasGesture, canMutate, findElementById, elementsLayoutKey } from "./elementTree.js";
import { pageChromeStyle } from "../../shared/overlay/pageChrome.js";
import {
  captureVisualRelatives,
  computePlacementOffsets,
  elementVisualClientPoint,
  elementVisualPagePoint,
  groupOriginClientPoint,
  isClientPointInElementsFrame,
  PASTE_CURSOR_NUDGE,
  PASTE_STEP_OFFSET,
  PLACEMENT_ORIGIN_OFFSET,
} from "./elementPlacement.js";
import SelectionOverlay from "./components/SelectionOverlay.jsx";
import ContextMenu from "./components/ContextMenu.jsx";
import { buildBoxStyle } from "../../shared/overlay/elementBoxStyle.js";
import { getOverlay, groupMoveableRoot } from "../../shared/overlay/index.js";
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

const ElementView = memo(function ElementView({
  element,
  elements,
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
  const inheritLocked = !canCanvasGesture(elements, element.id);
  const className = `editable${selected ? " selected" : ""}${styleOnly ? " selected-style-only" : ""}${inheritLocked ? " element-locked" : ""}`;
  const dataProps = selectableProps(element.id);
  const editPointerProps =
    editMode && !inheritLocked
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
    const HeadingTag = `h${headingTagLevel(el)}`;
    return withOptionalPin(
      pin,
      <HeadingTag
        className={className}
        style={style}
        {...editPointerProps}
        onContextMenu={handleContextMenu}
        ref={setRef}
        {...dataProps}
      >
        {el.text}
      </HeadingTag>
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
            elements={elements}
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
});

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
  onGestureDraft,
}) {
  const overlay = getOverlay(overlayMode);
  const elementRefs = useRef({});
  const localPageRef = useRef(null);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectPins, setSelectPins] = useState({});
  const selectPinsRef = useRef({});
  selectPinsRef.current = selectPins;
  const gestureDraftRef = useRef(null);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

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
      captureVisualPagePoints: (ids) => {
        const pageEl = localPageRef.current;
        const out = {};
        if (!pageEl) return out;
        for (const id of ids) {
          const el = elementRefs.current[id];
          if (!el) continue;
          out[id] = elementVisualPagePoint(el, pageEl);
        }
        return out;
      },
      getPageClientRect: () => localPageRef.current?.getBoundingClientRect() ?? null,
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
      .filter((id) => canCanvasGesture(config.elements, id))
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
      if (!canMutate(config.elements, elementId)) return;
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
  const pageStyle = pageChromeStyle(pagePreset, mergedConfig.pageBackground);

  const unlockedSelectedIds = selectedIds.filter((id) => canCanvasGesture(config.elements, id));
  const unlockedSelectedElements = unlockedSelectedIds
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
  const groupRootContainer = groupMoveableRoot(handleableNodes, (node) =>
    overlay.moveableRoot(node)
  );
  const targetRef = useRef(null);
  targetRef.current =
    handleableIds.length === 1 ? elementRefs.current[handleableIds[0]] ?? null : null;

  const commitOverlayPatch = (id, changes) => {
    const raw = findElementById(config.elements, id);
    if (!raw) return null;
    const live = mergeElement(raw);
    const pinned = overlay.commitSelectPin(live, selectPinsRef.current[id]);
    const el = { ...live, ...pinned };
    const patch = overlay.patchOffset(el, changes);
    if (!patch && !Object.keys(pinned).length) return null;
    return { id, ...pinned, ...patch };
  };

  const beginOverlayGesture = () => {
    gestureDraftRef.current = null;
    onGestureDraft?.(null);
    onBeginContinuousEdit();
  };

  const endOverlayGesture = () => {
    const draft = gestureDraftRef.current;
    gestureDraftRef.current = null;
    if (Array.isArray(draft) && draft.length && onElementsChange) {
      const next = draft.flatMap(({ id, ...changes }) => {
        const patch = commitOverlayPatch(id, changes);
        return patch ? [patch] : [];
      });
      if (next.length) onElementsChange(next);
    } else if (draft && !Array.isArray(draft) && draft.id) {
      const { id, ...changes } = draft;
      const patch = commitOverlayPatch(id, changes);
      if (patch) onElementChange(id, patch);
    } else if (overlay.id === "B" && onElementsChange) {
      const updates = selectedIds.flatMap((id) => {
        const patch = commitOverlayPatch(id, {});
        return patch ? [patch] : [];
      });
      if (updates.length) onElementsChange(updates);
    }
    onGestureDraft?.(null);
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
            elements={config.elements}
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
            canMutate={
              !contextMenu.elementId || canMutate(config.elements, contextMenu.elementId)
            }
            canGroup={canGroup}
            canUngroup={canUngroup}
            onGroup={() => onGroup?.()}
            onUngroup={() => onUngroup?.()}
            onLayerOrder={
              contextMenu.elementId && canMutate(config.elements, contextMenu.elementId)
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
            onDragStart={beginOverlayGesture}
            onDrag={(offsetX, offsetY) => {
              const draft = { id: singleHandleableId, offsetX, offsetY };
              gestureDraftRef.current = draft;
              onGestureDraft?.(draft);
            }}
            onResize={(changes) => {
              const draft = { id: singleHandleableId, ...changes };
              gestureDraftRef.current = draft;
              onGestureDraft?.(draft);
            }}
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
            rootContainer={groupRootContainer}
            snapEnabled={snapEnabled}
            gridSnapEnabled={gridSnapEnabled}
            elementGuidelines={elementGuidelines}
            onDragStart={beginOverlayGesture}
            onDragGroup={(updates) => {
              gestureDraftRef.current = updates;
              onGestureDraft?.(updates[0] ?? null);
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
