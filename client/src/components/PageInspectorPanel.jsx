import { PAGE_BACKGROUND_DEFAULT, mergeConfig } from "../elementDefaults.js";
import SectionHeader from "./SectionHeader.jsx";
import SwatchInput from "./SwatchInput.jsx";

export default function PageInspectorPanel({
  config,
  onPageChange,
  onBeginContinuousEdit,
  onEndContinuousEdit,
  scrollZoneActive = false,
  onScrollZoneActivate,
}) {
  const merged = mergeConfig(config);

  return (
    <aside
      className={`inspector scroll-zone scroll-zone--tool${scrollZoneActive ? " scroll-zone--active" : ""}`}
      aria-label="Page inspector"
      onPointerDown={() => onScrollZoneActivate?.()}
    >
      <span className="scroll-zone-indicator" aria-hidden="true">
        Inspector
      </span>
      <div className="inspector-header">
        <span className="inspector-title">Page</span>
      </div>
      <div className="inspector-body scroll-zone-viewport">
        <SectionHeader title="Canvas">
          <SwatchInput
            label="Background"
            color={merged.pageBackground ?? PAGE_BACKGROUND_DEFAULT}
            onChange={(c) => onPageChange({ pageBackground: c })}
            onBeginContinuousEdit={onBeginContinuousEdit}
            onEndContinuousEdit={onEndContinuousEdit}
          />
        </SectionHeader>
        <p className="inspector-hint">
          Page background applies to the canvas area, not the editor chrome around it.
        </p>
      </div>
    </aside>
  );
}
