import { resolveElement, RESPONSIVE_FIELDS } from "../elementDefaults.js";
import { BreakpointContext, useActiveBreakpoint } from "../elementTree.js";
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
import AlignDistributeSection from "./AlignDistributeSection.jsx";

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

const OVERFLOW_OPTIONS = [
  { value: "visible", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "scroll", label: "Scroll" },
  { value: "auto", label: "Auto" },
];

const TYPE_SECTION_TITLE = {
  image: "Image",
  button: "Button",
  link: "Link",
  divider: "Divider",
  list: "List",
  container: "Frame",
};

function OverrideDot({ field, onReset }) {
  return (
    <button
      type="button"
      title={`Reset ${field} to base`}
      aria-label={`Reset ${field} to base`}
      onClick={onReset}
      style={{
        position: "absolute",
        top: "50%",
        right: 0,
        transform: "translateY(-50%)",
        width: 8,
        height: 8,
        padding: 0,
        border: "none",
        borderRadius: "50%",
        background: "#2563eb",
        cursor: "pointer",
      }}
    />
  );
}

function FieldWithOverride({ field, overridden, onReset, children }) {
  if (!overridden) return children;
  return (
    <div style={{ position: "relative" }}>
      {children}
      <OverrideDot field={field} onReset={onReset} />
    </div>
  );
}

const DISPLAY_OPTIONS = [
  { value: "block", label: "Block" },
  { value: "flex", label: "Flex" },
];

const DIRECTION_OPTIONS = [
  { value: "row", label: "Row" },
  { value: "column", label: "Column" },
];

const ALIGN_ITEMS_OPTIONS = [
  { value: "stretch", label: "Stretch" },
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
];

const JUSTIFY_CONTENT_OPTIONS = [
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "space-between", label: "Between" },
];

export default function InspectorPanel({
  element,
  breakpoint,
  onChange,
  onLayerOrder,
  onBeginContinuousEdit,
  onEndContinuousEdit,
  onAlignChildren,
  onAlign,
  onDistribute,
  gridSnapEnabled = false,
  onGridSnapChange,
  scrollZoneActive = false,
  onScrollZoneActivate,
}) {
  const contextBp = useActiveBreakpoint();
  if (!element) return null;

  const bp = breakpoint ?? contextBp;
  const { merged: el, overrides } = resolveElement(element, bp);
  const rawResponsive =
    element.responsive && typeof element.responsive === "object" ? element.responsive : {};

  const update = (key, value) => {
    if (el[key] === value) return;
    if (bp !== "base" && RESPONSIVE_FIELDS.has(key)) {
      onChange(element.id, {
        responsive: {
          ...rawResponsive,
          [bp]: { ...(rawResponsive[bp] ?? {}), [key]: value },
        },
      });
      return;
    }
    onChange(element.id, { [key]: value });
  };

  const resetField = (field) => {
    if (bp === "base") return;
    const nextBp = { ...(rawResponsive[bp] ?? {}) };
    delete nextBp[field];
    const next = { ...rawResponsive };
    if (Object.keys(nextBp).length > 0) next[bp] = nextBp;
    else delete next[bp];
    onChange(element.id, { responsive: next });
  };

  const isOverridden = (field) => bp !== "base" && overrides.has(field);
  const fieldReset = (field) => () => resetField(field);

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
        {onAlign && (
          <AlignDistributeSection
            selectionCount={1}
            onAlign={onAlign}
            onDistribute={onDistribute}
            gridSnapEnabled={gridSnapEnabled}
            onGridSnapChange={onGridSnapChange}
          />
        )}
        <SectionHeader title="Position & Size">
          <FieldWithOverride field="offsetX" overridden={isOverridden("offsetX")} onReset={fieldReset("offsetX")}>
            <NumberField label="X" value={el.offsetX} min={-2000} max={2000} unit="px" onChange={(v) => update("offsetX", v)} />
          </FieldWithOverride>
          <FieldWithOverride field="offsetY" overridden={isOverridden("offsetY")} onReset={fieldReset("offsetY")}>
            <NumberField label="Y" value={el.offsetY} min={-2000} max={2000} unit="px" onChange={(v) => update("offsetY", v)} />
          </FieldWithOverride>
          <FieldWithOverride field="width" overridden={isOverridden("width")} onReset={fieldReset("width")}>
            <NullableNumberField label="W" value={el.width} min={1} max={2000} unit="px" onChange={(v) => update("width", v)} />
          </FieldWithOverride>
          <FieldWithOverride field="height" overridden={isOverridden("height")} onReset={fieldReset("height")}>
            <NullableNumberField label="H" value={el.height} min={1} max={2000} unit="px" onChange={(v) => update("height", v)} />
          </FieldWithOverride>
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
              <FieldWithOverride field="fontSize" overridden={isOverridden("fontSize")} onReset={fieldReset("fontSize")}>
                <NumberField label="Size" value={el.fontSize} min={8} max={120} unit="px" onChange={(v) => update("fontSize", v)} />
              </FieldWithOverride>
            )}
            {(element.type === "heading" || element.type === "paragraph" || element.type === "list") && (
              <FieldWithOverride field="fontSize" overridden={isOverridden("fontSize")} onReset={fieldReset("fontSize")}>
                <NumberField label="Size" value={el.fontSize} min={8} max={120} unit="px" onChange={(v) => update("fontSize", v)} />
              </FieldWithOverride>
            )}
            {element.type === "link" && (
              <FieldWithOverride field="fontSize" overridden={isOverridden("fontSize")} onReset={fieldReset("fontSize")}>
                <NumberField label="Size" value={el.fontSize} min={8} max={120} unit="px" onChange={(v) => update("fontSize", v)} />
              </FieldWithOverride>
            )}
            <FieldWithOverride field="color" overridden={isOverridden("color")} onReset={fieldReset("color")}>
              <SwatchInput
                label="Color"
                color={el.color}
                onChange={(c) => update("color", c)}
                onBeginContinuousEdit={onBeginContinuousEdit}
                onEndContinuousEdit={onEndContinuousEdit}
              />
            </FieldWithOverride>
            {(element.type === "heading" || element.type === "paragraph") && (
              <FieldWithOverride field="textAlign" overridden={isOverridden("textAlign")} onReset={fieldReset("textAlign")}>
                <ChipGroup label="Align" value={el.textAlign} options={ALIGN_OPTIONS} onChange={(v) => update("textAlign", v)} />
              </FieldWithOverride>
            )}
          </SectionHeader>
        )}

        {element.type !== "divider" && element.type !== "container" && (
          <SectionHeader title="Fill">
            <FieldWithOverride field="backgroundColor" overridden={isOverridden("backgroundColor")} onReset={fieldReset("backgroundColor")}>
              <SwatchInput
                label="Background"
                color={el.backgroundColor}
                onChange={(c) => update("backgroundColor", c)}
                allowTransparent
                onBeginContinuousEdit={onBeginContinuousEdit}
                onEndContinuousEdit={onEndContinuousEdit}
              />
            </FieldWithOverride>
          </SectionHeader>
        )}

        {element.type === "container" && (
          <SectionHeader title="Overflow & scroll">
            <ChipGroup label="Overflow X" value={el.overflowX} options={OVERFLOW_OPTIONS} onChange={(v) => update("overflowX", v)} />
            <ChipGroup label="Overflow Y" value={el.overflowY} options={OVERFLOW_OPTIONS} onChange={(v) => update("overflowY", v)} />
          </SectionHeader>
        )}

        <SectionHeader title="Layout">
          {element.type === "container" && (
            <>
              <ChipGroup
                label="Display"
                value={el.layout === "flex" ? "flex" : "block"}
                options={DISPLAY_OPTIONS}
                onChange={(v) => update("layout", v === "flex" ? "flex" : null)}
              />
              {el.layout === "flex" && (
                <>
                  <ChipGroup label="Direction" value={el.direction} options={DIRECTION_OPTIONS} onChange={(v) => update("direction", v)} />
                  <NumberField label="Gap" value={el.gap} min={0} max={80} unit="px" onChange={(v) => update("gap", v)} />
                  <ChipGroup label="Align items" value={el.alignItems} options={ALIGN_ITEMS_OPTIONS} onChange={(v) => update("alignItems", v)} />
                  <ChipGroup label="Justify" value={el.justifyContent} options={JUSTIFY_CONTENT_OPTIONS} onChange={(v) => update("justifyContent", v)} />
                </>
              )}
            </>
          )}
          <FieldWithOverride field="padding" overridden={isOverridden("padding")} onReset={fieldReset("padding")}>
            <NumberField label="Padding" value={el.padding} min={0} max={80} unit="px" onChange={(v) => update("padding", v)} />
          </FieldWithOverride>
          <FieldWithOverride field="marginBottom" overridden={isOverridden("marginBottom")} onReset={fieldReset("marginBottom")}>
            <NumberField label="Margin" value={el.marginBottom} min={0} max={80} unit="px" onChange={(v) => update("marginBottom", v)} />
          </FieldWithOverride>
        </SectionHeader>

        {!hideStroke && (
          <SectionHeader title="Stroke">
            <FieldWithOverride field="borderWidth" overridden={isOverridden("borderWidth")} onReset={fieldReset("borderWidth")}>
              <NumberField label="Width" value={el.borderWidth} min={0} max={20} unit="px" onChange={(v) => update("borderWidth", v)} />
            </FieldWithOverride>
            {el.borderWidth > 0 && (
              <SwatchInput
                label="Color"
                color={el.borderColor}
                onChange={(c) => update("borderColor", c)}
                onBeginContinuousEdit={onBeginContinuousEdit}
                onEndContinuousEdit={onEndContinuousEdit}
              />
            )}
            <FieldWithOverride field="borderRadius" overridden={isOverridden("borderRadius")} onReset={fieldReset("borderRadius")}>
              <NumberField label="Radius" value={el.borderRadius} min={0} max={40} unit="px" onChange={(v) => update("borderRadius", v)} />
            </FieldWithOverride>
          </SectionHeader>
        )}

        <SectionHeader title="Effects">
          <FieldWithOverride field="opacity" overridden={isOverridden("opacity")} onReset={fieldReset("opacity")}>
            <RangeField
              label="Opacity"
              value={el.opacity}
              min={0}
              max={100}
              onChange={(v) => update("opacity", v)}
              onBeginContinuousEdit={onBeginContinuousEdit}
              onEndContinuousEdit={onEndContinuousEdit}
            />
          </FieldWithOverride>
        </SectionHeader>
      </div>
    </aside>
  );
}
