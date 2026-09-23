import { useLayoutEffect, useState } from "react";

function measure(flashes) {
  return flashes.flatMap((flash) =>
    flash.ids.flatMap((id, i) => {
      const node = document.querySelector(`.page [data-element-id="${CSS.escape(id)}"]`);
      if (!node) return [];
      const r = node.getBoundingClientRect();
      if (!r.width && !r.height) return [];
      return [{ key: `${flash.key}-${id}`, top: r.top, left: r.left, width: r.width, height: r.height, label: i === 0 ? flash.label : null, kind: flash.kind }];
    })
  );
}

/** Multiplayer-style outline + name tag on elements another actor just changed. */
export default function CoworkerFlash({ flashes }) {
  const [boxes, setBoxes] = useState([]);

  useLayoutEffect(() => {
    if (!flashes.length) {
      setBoxes([]);
      return undefined;
    }
    let frame = requestAnimationFrame(function tick() {
      setBoxes(measure(flashes));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [flashes]);

  if (!boxes.length) return null;
  return (
    <div className="coworker-flash-layer" aria-hidden="true">
      {boxes.map((b) => (
        <div
          key={b.key}
          className={`coworker-flash coworker-flash-${b.kind}`}
          style={{ top: b.top - 3, left: b.left - 3, width: b.width + 6, height: b.height + 6 }}
        >
          {b.label && <span className="coworker-flash-tag">{b.label}</span>}
        </div>
      ))}
    </div>
  );
}
