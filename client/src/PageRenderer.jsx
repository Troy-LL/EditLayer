import { useCallback, useEffect, useRef, useState } from "react";
import Selecto from "react-selecto";
import { mergeElement } from "./elementDefaults.js";
import { findElementById } from "./elementTree.js";
import SelectionOverlay from "./components/SelectionOverlay.jsx";
import ContextMenu from "./components/ContextMenu.jsx";

function buildStyle(el, type) {
  const border =
    el.borderWidth > 0 ? `${el.borderWidth}px solid ${el.borderColor}` : "none";

  const style = {
    color: el.color,
    fontSize: `${el.fontSize}px`,
    backgroundColor: el.backgroundColor,
    opacity: el.opacity / 100,
    padding: `${el.padding}px`,
    margin: `0 0 ${el.marginBottom}px`,
    borderRadius: `${el.borderRadius}px`,
    border,
    textAlign: el.textAlign,
  };

  if (type === "link") {
    style.textDecoration = "underline";
    style.cursor = "pointer";
  }

  if (type === "button") {
    style.cursor = "pointer";
    style.display = "inline-block";
    style.border = border === "none" ? "none" : border;
    style.fontWeight = 500;
  }

  if (type === "divider") {
    style.backgroundColor = "transparent";
    style.padding = 0;
    style.border = "none";
    style.display = "block";
  }

  if (type === "image") {
    style.display = "inline-block";
    style.lineHeight = 0;
  }

  if (el.offsetX !== 0 || el.offsetY !== 0) {
    style.transform = `translate(${el.offsetX}px, ${el.offsetY}px)`;
  }
  if (el.width != null) {
    style.width = `${el.width}px`;
    if (type === "heading" || type === "paragraph" || type === "list") {
      style.whiteSpace = "normal";
      style.overflowWrap = "break-word";
      style.wordBreak = "break-word";
    }
  }
  if (el.height != null) {
    style.height = `${el.height}px`;
    if (type !== "image") {
      style.overflow = "hidden";
    }
  }

  return style;
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
}) {
  const el = mergeElement(element);
  const style = buildStyle(el, element.type);
  const className = `editable${selected ? " selected" : ""}`;
  const dataProps = selectableProps(element.id);
  const handleClick = editMode
    ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(element.id, { additive: e.shiftKey });
      }
    : undefined;
  const handleContextMenu = editMode
    ? (e) => onContextMenu(e, element.id)
    : undefined;
  const setRef = (node) => registerRef(element.id, node);

  if (element.type === "heading") {
    return (
      <h1 className={className} style={style} onClick={handleClick} onContextMenu={handleContextMenu} ref={setRef} {...dataProps}>
        {el.text}
      </h1>
    );
  }

  if (element.type === "paragraph") {
    return (
      <p className={className} style={style} onClick={handleClick} onContextMenu={handleContextMenu} ref={setRef} {...dataProps}>
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
    return (
      <div className={className} style={style} onClick={handleClick} onContextMenu={handleContextMenu} ref={setRef} {...dataProps}>
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
      return (
        <button
          type="button"
          className={className}
          style={style}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          ref={setRef}
          {...dataProps}
        >
          {el.label}
        </button>
      );
    }
    if (el.href) {
      return (
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
    return (
      <button type="button" className={className} style={style} ref={setRef} {...dataProps}>
        {el.label}
      </button>
    );
  }

  if (element.type === "link") {
    if (editMode || !el.href) {
      return (
        <span
          className={className}
          style={style}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          ref={setRef}
          {...dataProps}
        >
          {el.text}
        </span>
      );
    }
    return (
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
    return (
      <div
        className={className}
        style={style}
        onClick={handleClick}
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
    return (
      <Tag
        className={className}
        style={style}
        onClick={handleClick}
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
      position: "relative",
      boxSizing: "border-box",
      minHeight: el.height != null ? undefined : 40,
    };
    return (
      <div
        className={`${className} element-container`}
        style={containerStyle}
        onClick={handleClick}
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
          />
        ))}
      </div>
    );
  }

  return (
    <p className={className} style={style} onClick={handleClick} onContextMenu={handleContextMenu} ref={setRef} {...dataProps}>
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
      selectableTargets={[".editable"]}
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
  lastPointerRef,
  pageRef,
  canvasRef,
}) {
  const elementRefs = useRef({});
  const localPageRef = useRef(null);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);

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

  useEffect(() => {
    const nodes = selectedIds
      .map((id) => elementRefs.current[id])
      .filter(Boolean);
    setSelectedNodes(nodes);
  }, [selectedIds, config]);

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
      if (!selectedIdSet.has(elementId)) {
        onSelect(elementId, { additive: false });
      }
      setContextMenu({ x: e.clientX, y: e.clientY, elementId });
    },
    [onSelect, selectedIdSet, trackPointer]
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

  const selectedElements = selectedIds
    .map((id) => findElementById(config.elements, id))
    .filter(Boolean)
    .map((el) => mergeElement(el));

  const singleSelected = selectedElements.length === 1 ? selectedElements[0] : null;
  const targetRef = useRef(null);
  targetRef.current = selectedNodes[0] ?? null;

  return (
    <>
      <div
        ref={setPageRef}
        className={`page page--${pagePreset}${editMode ? " edit-mode" : ""}`}
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
          />
        ))}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            canPaste={hasClipboard}
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
        {editMode && selectedNodes.length === 1 && singleSelected && (
          <SelectionOverlay
            mode="single"
            targetRef={targetRef}
            scrollContainerRef={canvasRef}
            offsetX={singleSelected.offsetX}
            offsetY={singleSelected.offsetY}
            onDragStart={onBeginContinuousEdit}
            onDrag={(offsetX, offsetY) =>
              onElementChange(selectedId, { offsetX, offsetY })
            }
            onResize={({ width, height, offsetX, offsetY }) =>
              onElementChange(selectedId, { width, height, offsetX, offsetY })
            }
            onGestureEnd={onEndContinuousEdit}
          />
        )}
        {editMode && selectedNodes.length > 1 && (
          <SelectionOverlay
            mode="group"
            targets={selectedNodes}
            selectedElements={selectedElements}
            scrollContainerRef={canvasRef}
            onDragStart={onBeginContinuousEdit}
            onDragGroup={(updates) =>
              onElementsChange(
                updates.map(({ id, offsetX, offsetY }) => ({ id, offsetX, offsetY }))
              )
            }
            onGestureEnd={onEndContinuousEdit}
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
