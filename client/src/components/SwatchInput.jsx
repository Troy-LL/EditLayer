import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";

function normalizeHex(raw) {
  let hex = raw.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;
  return null;
}

export default function SwatchInput({
  label,
  color,
  onChange,
  allowTransparent = false,
  onBeginContinuousEdit,
  onEndContinuousEdit,
}) {
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(color === "transparent" ? "" : color);
  const rootRef = useRef(null);
  const draggingRef = useRef(false);

  const isTransparent = color === "transparent";
  const pickerColor = isTransparent ? "#ffffff" : color;

  useEffect(() => {
    setHexDraft(isTransparent ? "" : color);
  }, [color, isTransparent]);

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

  const commitHex = (raw) => {
    const normalized = normalizeHex(raw);
    if (normalized) {
      onChange(normalized);
      setHexDraft(normalized);
    } else {
      setHexDraft(isTransparent ? "" : color);
    }
  };

  const handlePickerPointerDown = () => {
    draggingRef.current = true;
    onBeginContinuousEdit?.();
  };

  useEffect(() => {
    if (!open) return;

    const onPointerUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        onEndContinuousEdit?.();
      }
    };

    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, [open, onEndContinuousEdit]);

  return (
    <div className="field-row swatch-field" ref={rootRef}>
      <label>{label}</label>
      <div className="swatch-row">
        <button
          type="button"
          className={`swatch${isTransparent ? " swatch-transparent" : ""}`}
          style={isTransparent ? undefined : { backgroundColor: color }}
          onClick={() => setOpen((v) => !v)}
          aria-label={`${label} color picker`}
          aria-expanded={open}
        />
        <input
          type="text"
          className="field-input hex-input"
          value={isTransparent ? "transparent" : hexDraft}
          placeholder="#000000"
          onChange={(e) => {
            const val = e.target.value;
            setHexDraft(val);
            if (allowTransparent && val.toLowerCase() === "transparent") {
              onChange("transparent");
              return;
            }
            const normalized = normalizeHex(val);
            if (normalized) onChange(normalized);
          }}
          onBlur={() => commitHex(hexDraft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitHex(hexDraft);
              e.target.blur();
            }
          }}
        />
        {open && (
          <div
            className="swatch-popover"
            role="dialog"
            aria-label={`${label} picker`}
            onPointerDown={handlePickerPointerDown}
          >
            <HexColorPicker
              color={pickerColor}
              onChange={(c) => {
                onChange(c);
                setHexDraft(c);
              }}
            />
            {allowTransparent && (
              <button
                type="button"
                className="toolbar-btn toolbar-btn-block swatch-clear"
                onClick={() => {
                  onChange("transparent");
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
