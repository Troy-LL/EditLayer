import {
  IconAlignBottom,
  IconAlignCenter,
  IconAlignLeft,
  IconAlignMiddleV,
  IconAlignRight,
  IconAlignTop,
  IconDistributeH,
  IconDistributeV,
} from "../icons/index.jsx";
import ChipGroup from "./ChipGroup.jsx";
import SectionHeader from "./SectionHeader.jsx";

const HORIZONTAL_ALIGN = [
  { value: "left", label: "Align left", icon: <IconAlignLeft /> },
  { value: "center", label: "Align center horizontal", icon: <IconAlignCenter /> },
  { value: "right", label: "Align right", icon: <IconAlignRight /> },
];

const VERTICAL_ALIGN = [
  { value: "top", label: "Align top", icon: <IconAlignTop /> },
  { value: "middle", label: "Align middle vertical", icon: <IconAlignMiddleV /> },
  { value: "bottom", label: "Align bottom", icon: <IconAlignBottom /> },
];

const DISTRIBUTE_OPTIONS = [
  { value: "horizontal", label: "Distribute horizontal spacing", icon: <IconDistributeH /> },
  { value: "vertical", label: "Distribute vertical spacing", icon: <IconDistributeV /> },
];

/**
 * @param {{
 *   selectionCount: number,
 *   onAlign: (horizontal?: string, vertical?: string) => void,
 *   onDistribute: (axis: 'horizontal' | 'vertical') => void,
 *   gridSnapEnabled?: boolean,
 *   onGridSnapChange?: (enabled: boolean) => void,
 * }} props
 */
export default function AlignDistributeSection({
  selectionCount,
  onAlign,
  onDistribute,
  gridSnapEnabled = false,
  onGridSnapChange,
}) {
  const canDistribute = selectionCount >= 3;

  return (
    <SectionHeader title="Align & distribute">
      <ChipGroup
        label="Horizontal"
        value=""
        options={HORIZONTAL_ALIGN}
        onChange={(value) => onAlign(value, undefined)}
      />
      <ChipGroup
        label="Vertical"
        value=""
        options={VERTICAL_ALIGN}
        onChange={(value) => onAlign(undefined, value)}
      />
      {canDistribute && (
        <ChipGroup
          label="Distribute"
          value=""
          options={DISTRIBUTE_OPTIONS}
          onChange={(value) => onDistribute(value)}
        />
      )}
      {onGridSnapChange && (
        <div className="field-row chip-field">
          <label>Grid snap</label>
          <button
            type="button"
            className={`chip chip-text${gridSnapEnabled ? " chip-active" : ""}`}
            onClick={() => onGridSnapChange(!gridSnapEnabled)}
            aria-pressed={gridSnapEnabled}
            title="Snap to 8px grid while dragging or nudging with arrow keys"
          >
            8px
          </button>
        </div>
      )}
    </SectionHeader>
  );
}
