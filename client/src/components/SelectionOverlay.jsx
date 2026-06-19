import { useLayoutEffect, useRef } from "react";
import Moveable from "react-moveable";

function findControlBox() {
  return document.querySelector(".moveable-control-box");
}

function syncControlBoxWithTarget(target) {
  if (!target) return;

  const box = findControlBox();
  if (!box) return;

  const z = Number(window.getComputedStyle(target).zIndex) || 0;
  box.style.zIndex = String(z + 1);
}

function useOverlayRectSync({
  moveableRef,
  scrollContainerRef,
  rectKey,
  targetRef,
}) {
  useLayoutEffect(() => {
    const update = () => {
      moveableRef.current?.updateRect();
      const target = targetRef?.current;
      if (target) {
        syncControlBoxWithTarget(target);
      } else {
        const box = findControlBox();
        if (box) box.style.zIndex = "100";
      }
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
  }, [moveableRef, scrollContainerRef, rectKey, targetRef]);
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
  onDragStart,
  onDrag,
  onDragGroup,
  onResize,
  onGestureEnd,
}) {
  const moveableRef = useRef(null);

  const rectKey =
    mode === "group"
      ? `${layoutKey}|${selectedElements
          .map((el) => `${el.id}:${el.offsetX},${el.offsetY}`)
          .join("|")}`
      : `${layoutKey}|${offsetX},${offsetY}`;

  useOverlayRectSync({
    moveableRef,
    scrollContainerRef,
    rectKey,
    targetRef: mode === "single" ? targetRef : null,
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
        draggable
        resizable={false}
        throttleDrag={0}
        onDragGroupStart={({ events }) => {
          events.forEach((ev, i) => {
            const el = selectedElements[i];
            ev.set([el.offsetX, el.offsetY]);
          });
          onDragStart();
        }}
        onDragGroup={({ events }) => {
          const updates = events.map((ev, i) => {
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
        onDragGroupEnd={onGestureEnd}
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
      onDragStart={({ set }) => beginGesture(set)}
      onDrag={({ target, beforeTranslate }) => {
        target.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)`;
        onDrag(Math.round(beforeTranslate[0]), Math.round(beforeTranslate[1]));
      }}
      onDragEnd={onGestureEnd}
      onResizeStart={({ dragStart }) => {
        beginGesture(dragStart?.set);
      }}
      onResize={({ target, width, height, drag, direction }) => {
        const [ox, oy] = drag.beforeTranslate;
        const changes = { offsetX: Math.round(ox), offsetY: Math.round(oy) };
        if (direction[0] !== 0) {
          target.style.width = `${width}px`;
          changes.width = Math.round(width);
        }
        if (direction[1] !== 0) {
          target.style.height = `${height}px`;
          changes.height = Math.round(height);
        }
        target.style.transform = `translate(${ox}px, ${oy}px)`;
        onResize(changes);
      }}
      onResizeEnd={onGestureEnd}
    />
  );
}
