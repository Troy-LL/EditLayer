import { useCallback, useRef } from "react";

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export default function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onBeginContinuousEdit,
  onEndContinuousEdit,
}) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);

  const valueFromClientX = useCallback(
    (clientX) => {
      const track = trackRef.current;
      if (!track) return value;
      const rect = track.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      const raw = min + ratio * (max - min);
      const stepped = Math.round(raw / step) * step;
      return clamp(stepped, min, max);
    },
    [value, min, max, step]
  );

  const handlePointerDown = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onBeginContinuousEdit?.();
    onChange(valueFromClientX(e.clientX));
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    onChange(valueFromClientX(e.clientX));
  };

  const endDrag = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onEndContinuousEdit?.();
  };

  const handleKeyDown = (e) => {
    let next = value;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = value - step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = value + step;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    else return;
    e.preventDefault();
    onChange(clamp(next, min, max));
  };

  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div
      ref={trackRef}
      className="slider"
      role="slider"
      tabIndex={0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
    >
      <div className="slider-track">
        <div className="slider-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="slider-thumb" style={{ left: `${percent}%` }} />
    </div>
  );
}
