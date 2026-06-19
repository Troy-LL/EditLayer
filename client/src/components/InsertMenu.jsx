import { useEffect, useRef, useState } from "react";
import { INSERTABLE_TYPES } from "../elementFactory.js";

export default function InsertMenu({ onInsert }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const pick = (type) => {
    onInsert(type);
    setOpen(false);
  };

  return (
    <div className="insert-menu-root" ref={rootRef}>
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => setOpen((v) => !v)}
        title="Insert element"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        + Insert
      </button>
      {open && (
        <div className="insert-menu" role="menu">
          {INSERTABLE_TYPES.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              className="insert-menu-item"
              role="menuitem"
              onClick={() => pick(type)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
