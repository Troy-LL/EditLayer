import { useEffect, useRef } from "react";
import Moveable from "react-moveable";

function useOverlayRectSync(moveableRef, scrollContainerRef, rectKey) {
  useEffect(() => {
    const update = () => moveableRef.current?.updateRect();
    update();

    const container = scrollContainerRef?.current;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    container?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      container?.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [moveableRef, scrollContainerRef, rectKey]);
}

export default function SelectionOverlay({
  mode = "single",
  targetRef,
  targets,
  selectedElements,
  offsetX,
  offsetY,
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
      ? selectedElements
          .map((el) => `${el.id}:${el.offsetX},${el.offsetY}`)
          .join("|")
      : `${offsetX},${offsetY}`;

  useOverlayRectSync(moveableRef, scrollContainerRef, rectKey);

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
