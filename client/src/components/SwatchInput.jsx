import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { TOKENS } from "../designTokens";

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

const VAR_RE = /^var\((--[\w-]+)\)$/;

function matchToken(value) {
  const m = typeof value === "string" ? value.match(VAR_RE) : null;
  if (!m) return null;
  return TOKENS.find((t) => t.name === m[1]) || { name: m[1], value: "" };
}

const isVarRef = (v) => typeof v === "string" && VAR_RE.test(v);

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
  const activeToken = !isTransparent ? matchToken(color) : null;
  const resolvedPickerColor =
    (!isTransparent && activeToken?.value) || (!isTransparent ? color : "#ffffff");

  useEffect(() => {
    setHexDraft(isTransparent ? "" : activeToken ? activeToken.name : color);
  }, [color, isTransparent, activeToken]);

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
      setHexDraft(isTransparent ? "" : activeToken ? activeToken.name : color);
    }
  };

  const pickToken = (token) => {
    onChange(`var(${token.name})`);
    setHexDraft(token.name);
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
              color={resolvedPickerColor}
              onChange={(c) => {
                onChange(c);
                setHexDraft(c);
              }}
            />
            <div
              className="swatch-tokens"
              role="listbox"
              aria-label="Design tokens"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 4,
                maxHeight: 160,
                overflowY: "auto",
                padding: "8px 12px 4px",
                borderTop: "1px solid var(--border)",
              }}
            >
              {TOKENS.map((token) => (
                <button
                  key={token.name}
                  type="button"
                  role="option"
                  aria-selected={activeToken?.name === token.name}
                  className={`swatch-token${activeToken?.name === token.name ? " swatch-token-active" : ""}`}
                  onClick={() => pickToken(token)}
                  title={token.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 6px",
                    border: `1px solid ${activeToken?.name === token.name ? "var(--accent)" : "transparent"}`,
                    borderRadius: 4,
                    background: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    font: "inherit",
                    fontSize: 11,
                    color: "var(--text-primary)",
                  }}
                >
                  <span
                    className="swatch-token-chip"
                    style={{
                      width: 14,
                      height: 14,
                      flexShrink: 0,
                      borderRadius: 3,
                      border: "1px solid var(--border)",
                      backgroundColor: token.value,
                    }}
                  />
                  <span className="swatch-token-name">{token.name}</span>
                </button>
              ))}
            </div>
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
