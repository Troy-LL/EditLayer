import { useEffect, useRef } from "react";

export default function ContextMenu({
  x,
  y,
  canPaste,
  canGroup,
  canUngroup,
  onCopy,
  onCut,
  onDuplicate,
  onDelete,
  onPaste,
  onGroup,
  onUngroup,
  onLayerOrder,
  onClose,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  const run = (action) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
      role="menu"
    >
      <button type="button" className="context-menu-item" role="menuitem" onClick={() => run(onCopy)}>
        Copy
        <span className="context-menu-shortcut">Ctrl+C</span>
      </button>
      <button type="button" className="context-menu-item" role="menuitem" onClick={() => run(onCut)}>
        Cut
        <span className="context-menu-shortcut">Ctrl+X</span>
      </button>
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => run(onDuplicate)}
      >
        Duplicate
        <span className="context-menu-shortcut">Ctrl+D</span>
      </button>
      {onDelete && (
        <button
          type="button"
          className="context-menu-item context-menu-item-danger"
          role="menuitem"
          onClick={() => run(onDelete)}
        >
          Delete
          <span className="context-menu-shortcut">Del</span>
        </button>
      )}
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        disabled={!canPaste}
        onClick={() => run(onPaste)}
      >
        Paste
        <span className="context-menu-shortcut">Ctrl+V</span>
      </button>
      {(canGroup || canUngroup) && <div className="context-menu-divider" role="separator" />}
      {canGroup && (
        <button type="button" className="context-menu-item" role="menuitem" onClick={() => run(onGroup)}>
          Group
          <span className="context-menu-shortcut">Ctrl+G</span>
        </button>
      )}
      {canUngroup && (
        <button type="button" className="context-menu-item" role="menuitem" onClick={() => run(onUngroup)}>
          Ungroup
          <span className="context-menu-shortcut">Ctrl+Shift+G</span>
        </button>
      )}
      {onLayerOrder && (
        <>
          <div className="context-menu-divider" role="separator" />
          <button type="button" className="context-menu-item" role="menuitem" onClick={() => run(() => onLayerOrder("front"))}>
            Bring to front
            <span className="context-menu-shortcut">Ctrl+Shift+]</span>
          </button>
          <button type="button" className="context-menu-item" role="menuitem" onClick={() => run(() => onLayerOrder("forward"))}>
            Bring forward
            <span className="context-menu-shortcut">Ctrl+]</span>
          </button>
          <button type="button" className="context-menu-item" role="menuitem" onClick={() => run(() => onLayerOrder("backward"))}>
            Send backward
            <span className="context-menu-shortcut">Ctrl+[</span>
          </button>
          <button type="button" className="context-menu-item" role="menuitem" onClick={() => run(() => onLayerOrder("back"))}>
            Send to back
            <span className="context-menu-shortcut">Ctrl+Shift+[</span>
          </button>
        </>
      )}
    </div>
  );
}
