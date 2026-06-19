import { mergeElement } from "../elementDefaults.js";
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
} from "../icons/index.jsx";
import ChipGroup from "./ChipGroup.jsx";
import SectionHeader from "./SectionHeader.jsx";
import Slider from "./Slider.jsx";
import SwatchInput from "./SwatchInput.jsx";
import TypeInspectorFields, { isTextType, isInteractiveType } from "./TypeInspectorFields.jsx";
import LayerOrderSection from "./LayerOrderSection.jsx";

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

function NullableNumberField({ label, value, min, max, unit, onChange }) {
  return (
    <div className="field-row">
      <label>{label}</label>
      <div className="field-input-group">
        <input
          type="number"
          className="field-input field-input-mono"
          min={min}
          max={max}
          placeholder="auto"
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === "" ? null : Number(raw));
          }}
        />
        {unit && <span className="field-unit">{unit}</span>}
      </div>
    </div>
  );
}

function RangeField({ label, value, min, max, onChange, onBeginContinuousEdit, onEndContinuousEdit }) {
  return (
    <div className="field-row field-row-stack">
      <label>
        {label} <span className="field-value">{value}%</span>
      </label>
      <Slider
        value={value}
        min={min}
        max={max}
        onChange={onChange}
        onBeginContinuousEdit={onBeginContinuousEdit}
        onEndContinuousEdit={onEndContinuousEdit}
      />
    </div>
  );
}

const ALIGN_OPTIONS = [
  { value: "left", label: "Align left", icon: <IconAlignLeft /> },
  { value: "center", label: "Align center", icon: <IconAlignCenter /> },
  { value: "right", label: "Align right", icon: <IconAlignRight /> },
];

const TYPE_SECTION_TITLE = {
  image: "Image",
  button: "Button",
  link: "Link",
  divider: "Divider",
  list: "List",
  container: "Frame",
};

export default function InspectorPanel({
  element,
  onChange,
  onLayerOrder,
  onBeginContinuousEdit,
  onEndContinuousEdit,
  onAlignChildren,
  scrollZoneActive = false,
  onScrollZoneActivate,
}) {
  if (!element) return null;

  const el = mergeElement(element);
  const update = (key, value) => {
    if (el[key] === value) return;
    onChange(element.id, { [key]: value });
  };

  const showTypography = isTextType(element.type) || isInteractiveType(element.type);
  const typeSection = TYPE_SECTION_TITLE[element.type];
  const hideStroke = element.type === "divider";

  return (
    <aside
      className={`inspector scroll-zone scroll-zone--tool${scrollZoneActive ? " scroll-zone--active" : ""}`}
      aria-label="Inspector"
      onPointerDown={() => onScrollZoneActivate?.()}
    >
      <span className="scroll-zone-indicator" aria-hidden="true">
        Inspector
      </span>
      <div className="inspector-header">
        <span className="inspector-title">{element.type}</span>
      </div>
      <div className="inspector-body scroll-zone-viewport">
        <SectionHeader title="Element">
          <div className="field-row field-row-stack">
            <label>Name</label>
            <input
              type="text"
              className="field-input"
              placeholder={element.type}
              value={el.name ?? ""}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
        </SectionHeader>
        <LayerOrderSection
          onOrder={(action) => onLayerOrder?.(action, element.id)}
          disabled={el.locked}
        />
        <SectionHeader title="Position & Size">
          <NumberField label="X" value={el.offsetX} min={-2000} max={2000} unit="px" onChange={(v) => update("offsetX", v)} />
          <NumberField label="Y" value={el.offsetY} min={-2000} max={2000} unit="px" onChange={(v) => update("offsetY", v)} />
          <NullableNumberField label="W" value={el.width} min={1} max={2000} unit="px" onChange={(v) => update("width", v)} />
          <NullableNumberField label="H" value={el.height} min={1} max={2000} unit="px" onChange={(v) => update("height", v)} />
        </SectionHeader>

        {typeSection && (
          <SectionHeader title={typeSection}>
            <TypeInspectorFields
              element={element}
              el={el}
              update={update}
              onBeginContinuousEdit={onBeginContinuousEdit}
              onEndContinuousEdit={onEndContinuousEdit}
              onAlignChildren={
                element.type === "container" ? (h, v) => onAlignChildren?.(element.id, h, v) : undefined
              }
            />
          </SectionHeader>
        )}

        {showTypography && (
          <SectionHeader title="Typography">
            {(element.type === "heading" || element.type === "paragraph") && (
              <div className="field-row field-row-stack">
                <label>Text</label>
                <input
                  type="text"
                  className="field-input"
                  value={el.text}
                  onChange={(e) => update("text", e.target.value)}
                />
              </div>
            )}
            {element.type === "button" && (
              <NumberField label="Size" value={el.fontSize} min={8} max={120} unit="px" onChange={(v) => update("fontSize", v)} />
            )}
            {(element.type === "heading" || element.type === "paragraph" || element.type === "list") && (
              <NumberField label="Size" value={el.fontSize} min={8} max={120} unit="px" onChange={(v) => update("fontSize", v)} />
            )}
            {element.type === "link" && (
              <NumberField label="Size" value={el.fontSize} min={8} max={120} unit="px" onChange={(v) => update("fontSize", v)} />
            )}
            <SwatchInput
              label="Color"
              color={el.color}
              onChange={(c) => update("color", c)}
              onBeginContinuousEdit={onBeginContinuousEdit}
              onEndContinuousEdit={onEndContinuousEdit}
            />
            {(element.type === "heading" || element.type === "paragraph") && (
              <ChipGroup label="Align" value={el.textAlign} options={ALIGN_OPTIONS} onChange={(v) => update("textAlign", v)} />
            )}
          </SectionHeader>
        )}

        {element.type !== "divider" && element.type !== "container" && (
          <SectionHeader title="Fill">
            <SwatchInput
              label="Background"
              color={el.backgroundColor}
              onChange={(c) => update("backgroundColor", c)}
              allowTransparent
              onBeginContinuousEdit={onBeginContinuousEdit}
              onEndContinuousEdit={onEndContinuousEdit}
            />
          </SectionHeader>
        )}

        <SectionHeader title="Layout">
          <NumberField label="Padding" value={el.padding} min={0} max={80} unit="px" onChange={(v) => update("padding", v)} />
          <NumberField label="Margin" value={el.marginBottom} min={0} max={80} unit="px" onChange={(v) => update("marginBottom", v)} />
        </SectionHeader>

        {!hideStroke && (
          <SectionHeader title="Stroke">
            <NumberField label="Width" value={el.borderWidth} min={0} max={20} unit="px" onChange={(v) => update("borderWidth", v)} />
            {el.borderWidth > 0 && (
              <SwatchInput
                label="Color"
                color={el.borderColor}
                onChange={(c) => update("borderColor", c)}
                onBeginContinuousEdit={onBeginContinuousEdit}
                onEndContinuousEdit={onEndContinuousEdit}
              />
            )}
            <NumberField label="Radius" value={el.borderRadius} min={0} max={40} unit="px" onChange={(v) => update("borderRadius", v)} />
          </SectionHeader>
        )}

        <SectionHeader title="Effects">
          <RangeField
            label="Opacity"
            value={el.opacity}
            min={0}
            max={100}
            onChange={(v) => update("opacity", v)}
            onBeginContinuousEdit={onBeginContinuousEdit}
            onEndContinuousEdit={onEndContinuousEdit}
          />
        </SectionHeader>
      </div>
    </aside>
  );
}
