import { useState, useRef } from "react";
import { uploadAsset } from "../api.js";
import ChipGroup from "./ChipGroup.jsx";
import SwatchInput from "./SwatchInput.jsx";

function TextField({ label, value, onChange, placeholder }) {
  return (
    <div className="field-row field-row-stack">
      <label>{label}</label>
      <input
        type="text"
        className="field-input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NumberField({ label, value, min, max, unit, onChange }) {
  return (
    <div className="field-row">
      <label>{label}</label>
      <div className="field-input-group">
        <input
          type="number"
          className="field-input field-input-mono"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {unit && <span className="field-unit">{unit}</span>}
      </div>
    </div>
  );
}

const OBJECT_FIT_OPTIONS = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
  { value: "fill", label: "Fill" },
  { value: "none", label: "None" },
];

const TARGET_OPTIONS = [
  { value: "_self", label: "Same tab" },
  { value: "_blank", label: "New tab" },
];

function ImageFields({ el, update, onBeginContinuousEdit, onEndContinuousEdit }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleUpload = async (file) => {
    if (!file?.type.startsWith("image/")) {
      setUploadError("Choose an image file");
      return;
    }
    setUploadError("");
    setUploading(true);
    try {
      const { url } = await uploadAsset(file);
      update("src", url);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <TextField label="URL" value={el.src} onChange={(v) => update("src", v)} placeholder="https://…" />
      <div className="field-row field-row-stack">
        <label>Upload</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="field-input"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
        {uploading && <span className="field-hint">Uploading…</span>}
        {uploadError && <span className="field-hint field-hint-error">{uploadError}</span>}
      </div>
      <TextField label="Alt" value={el.alt} onChange={(v) => update("alt", v)} />
      <ChipGroup
        label="Fit"
        value={el.objectFit}
        options={OBJECT_FIT_OPTIONS}
        onChange={(v) => update("objectFit", v)}
      />
    </>
  );
}

function ListFields({ el, update }) {
  const text = (el.items ?? []).join("\n");
  return (
    <>
      <div className="field-row field-row-stack">
        <label>Items</label>
        <textarea
          className="field-input field-textarea"
          rows={5}
          value={text}
          onChange={(e) => {
            const items = e.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);
            update("items", items.length ? items : [""]);
          }}
        />
      </div>
      <ChipGroup
        label="Style"
        value={el.ordered ? "ordered" : "unordered"}
        options={[
          { value: "unordered", label: "Bullets" },
          { value: "ordered", label: "Numbers" },
        ]}
        onChange={(v) => update("ordered", v === "ordered")}
      />
    </>
  );
}

export default function TypeInspectorFields({
  element,
  el,
  update,
  onBeginContinuousEdit,
  onEndContinuousEdit,
  onAlignChildren,
}) {
  switch (element.type) {
    case "image":
      return (
        <ImageFields
          el={el}
          update={update}
          onBeginContinuousEdit={onBeginContinuousEdit}
          onEndContinuousEdit={onEndContinuousEdit}
        />
      );
    case "button":
      return (
        <>
          <TextField label="Label" value={el.label} onChange={(v) => update("label", v)} />
          <TextField label="Link" value={el.href} onChange={(v) => update("href", v)} placeholder="https://…" />
          <ChipGroup label="Target" value={el.target} options={TARGET_OPTIONS} onChange={(v) => update("target", v)} />
        </>
      );
    case "link":
      return (
        <>
          <TextField label="Text" value={el.text} onChange={(v) => update("text", v)} />
          <TextField label="Link" value={el.href} onChange={(v) => update("href", v)} placeholder="https://…" />
          <ChipGroup label="Target" value={el.target} options={TARGET_OPTIONS} onChange={(v) => update("target", v)} />
        </>
      );
    case "divider":
      return (
        <>
          <NumberField
            label="Thickness"
            value={el.dividerThickness}
            min={1}
            max={20}
            unit="px"
            onChange={(v) => update("dividerThickness", v)}
          />
          <SwatchInput
            label="Color"
            color={el.dividerColor}
            onChange={(c) => update("dividerColor", c)}
            onBeginContinuousEdit={onBeginContinuousEdit}
            onEndContinuousEdit={onEndContinuousEdit}
          />
        </>
      );
    case "list":
      return <ListFields el={el} update={update} />;
    case "container":
      return (
        <>
          <p className="inspector-hint">
            {(el.children ?? []).length} child{(el.children ?? []).length === 1 ? "" : "ren"}. Ctrl+G groups selection; Ctrl+Shift+G ungroups.
          </p>
          {onAlignChildren && (
            <div className="field-row field-row-stack">
              <label>Align children</label>
              <div className="align-grid">
                {[
                  ["left", "top"],
                  ["center", "top"],
                  ["right", "top"],
                  ["left", "middle"],
                  ["center", "middle"],
                  ["right", "middle"],
                  ["left", "bottom"],
                  ["center", "bottom"],
                  ["right", "bottom"],
                ].map(([h, v]) => (
                  <button
                    key={`${h}-${v}`}
                    type="button"
                    className="align-grid-btn"
                    title={`${h} ${v}`}
                    onClick={() => onAlignChildren(h, v)}
                  >
                    ·
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      );
    default:
      return null;
  }
}

export function isTextType(type) {
  return type === "heading" || type === "paragraph" || type === "list";
}

export function isInteractiveType(type) {
  return type === "button" || type === "link";
}
