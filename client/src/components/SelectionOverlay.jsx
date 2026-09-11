import { useLayoutEffect, useRef, useState } from "react";
import Moveable from "react-moveable";

const SNAP_THRESHOLD = 5;
const GRID_SIZE = 8;

function controlBoxOf(moveableRef) {
  const inst = moveableRef.current;
  if (!inst) return null;
  if (typeof inst.getControlBoxElement === "function") {
    return inst.getControlBoxElement();
  }
  return inst.controlBox ?? null;
}

function syncControlBoxZ(moveableRef, targets) {
  const box = controlBoxOf(moveableRef);
  if (!box) return;
  const nodes = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
  let z = 0;
  for (const node of nodes) {
    z = Math.max(z, Number(window.getComputedStyle(node).zIndex) || 0);
  }
  box.style.zIndex = String(z + 1);
}

function useOverlayRectSync({
  moveableRef,
  scrollContainerRef,
  rectKey,
  targets,
}) {
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  useLayoutEffect(() => {
    const update = () => {
      moveableRef.current?.updateRect();
      syncControlBoxZ(moveableRef, targetsRef.current);
    };

    update();
    const raf = requestAnimationFrame(update);

    const container = scrollContainerRef?.current;
    let scrollRaf = 0;
    const onScroll = () => {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(update);
    };

    container?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(scrollRaf);
      container?.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [moveableRef, scrollContainerRef, rectKey]);
}

function isSnapBypass(event) {
  const input = event?.inputEvent ?? event?.originalEvent;
  return !!(input?.ctrlKey || input?.metaKey);
}

function snapProps({ snapEnabled, gridSnapEnabled, elementGuidelines, bypass = false }) {
  if (bypass || !snapEnabled) return {};

  return {
    snappable: true,
    snapThreshold: SNAP_THRESHOLD,
    isDisplaySnapDigit: true,
    snapElement: true,
    snapGap: true,
    elementGuidelines: elementGuidelines ?? [],
    ...(gridSnapEnabled
      ? { snapGridWidth: GRID_SIZE, snapGridHeight: GRID_SIZE }
      : {}),
  };
}

export default function SelectionOverlay({
  mode = "single",
  targetRef,
  targets,
  selectedElements,
  offsetX,
  offsetY,
  layoutKey = "",
  rootContainer,
  scrollContainerRef,
  snapEnabled = true,
  gridSnapEnabled = false,
  elementGuidelines = [],
  onDragStart,
  onDrag,
  onDragGroup,
  onResize,
  onGestureEnd,
}) {
  const moveableRef = useRef(null);
  const [snapBypass, setSnapBypass] = useState(false);

  const syncSnapBypass = (event) => {
    const bypass = isSnapBypass(event);
    setSnapBypass((prev) => (prev === bypass ? prev : bypass));
  };

  const endGesture = () => {
    setSnapBypass(false);
    onGestureEnd();
  };

  const rectKey =
    mode === "group"
      ? `${layoutKey}|${selectedElements
          .map((el) => `${el.id}:${el.offsetX},${el.offsetY}`)
          .join("|")}`
      : `${layoutKey}|${offsetX},${offsetY}`;

  const syncTargets =
    mode === "group"
      ? targets
      : targetRef?.current
        ? [targetRef.current]
        : [];

  useOverlayRectSync({
    moveableRef,
    scrollContainerRef,
    rectKey,
    targets: syncTargets,
  });

  const snapping = snapProps({
    snapEnabled,
    gridSnapEnabled,
    elementGuidelines,
    bypass: snapBypass,
  });

  const beginGesture = (setTranslate) => {
    setTranslate?.([offsetX, offsetY]);
    onDragStart();
  };

  if (mode === "group") {
    return (
      <Moveable
        ref={moveableRef}
        targets={targets}
        rootContainer={rootContainer ?? undefined}
        draggable
        // Policy: group is translate-only. Resize a single target; multi-resize
        // would invent a layout model we do not have (not a missing handle bug).
        resizable={false}
        throttleDrag={0}
        {...snapping}
        onDragGroupStart={(e) => {
          syncSnapBypass(e);
          e.events.forEach((ev, i) => {
            const el = selectedElements[i];
            ev.set([el.offsetX, el.offsetY]);
          });
          onDragStart();
        }}
          onDragGroup={(e) => {
          // Gesture writer: Moveable DOM only. React config updates on end.
          syncSnapBypass(e);
          const updates = e.events.map((ev, i) => {
            const [ox, oy] = ev.beforeTranslate;
            ev.target.style.transform = `translate(${ox}px, ${oy}px)`;
            return {
              id: selectedElements[i].id,
              offsetX: Math.round(ox),
              offsetY: Math.round(oy),
            };
          });
          onDragGroup(updates);
        }}
        onDragGroupEnd={endGesture}
      />
    );
  }

  return (
    <Moveable
      ref={moveableRef}
      target={targetRef}
      rootContainer={rootContainer ?? undefined}
      draggable
      resizable
      useResizeObserver
      keepRatio={false}
      throttleDrag={0}
      throttleResize={0}
      renderDirections={["nw", "n", "ne", "w", "e", "sw", "s", "se"]}
      {...snapping}
      onDragStart={(e) => {
        syncSnapBypass(e);
        beginGesture(e.set);
      }}
      onDrag={(e) => {
        // Gesture writer: Moveable DOM only. React buildStyle stays on pre-gesture offsets.
        syncSnapBypass(e);
        e.target.style.transform = `translate(${e.beforeTranslate[0]}px, ${e.beforeTranslate[1]}px)`;
        onDrag(Math.round(e.beforeTranslate[0]), Math.round(e.beforeTranslate[1]));
      }}
      onDragEnd={endGesture}
      onResizeStart={(e) => {
        syncSnapBypass(e);
        beginGesture(e.dragStart?.set);
      }}
      onResize={(e) => {
        syncSnapBypass(e);
        const [ox, oy] = e.drag.beforeTranslate;
        const changes = { offsetX: Math.round(ox), offsetY: Math.round(oy) };
        if (e.direction[0] !== 0) {
          e.target.style.width = `${e.width}px`;
          changes.width = Math.round(e.width);
        }
        if (e.direction[1] !== 0) {
          e.target.style.height = `${e.height}px`;
          changes.height = Math.round(e.height);
        }
        e.target.style.transform = `translate(${ox}px, ${oy}px)`;
        onResize(changes);
      }}
      onResizeEnd={endGesture}
    />
  );
}
