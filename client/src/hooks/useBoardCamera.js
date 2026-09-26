import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const BOARD_ZOOM_MIN = 0.25;
export const BOARD_ZOOM_MAX = 2;
export const BOARD_PAD_X = 80;
export const BOARD_PAD_Y = 64;

const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2];

function clampZoom(z) {
  return Math.min(BOARD_ZOOM_MAX, Math.max(BOARD_ZOOM_MIN, z));
}

function nearestStep(z, direction) {
  if (direction > 0) {
    const next = ZOOM_STEPS.find((s) => s > z + 0.001);
    return next ?? BOARD_ZOOM_MAX;
  }
  const prev = [...ZOOM_STEPS].reverse().find((s) => s < z - 0.001);
  return prev ?? BOARD_ZOOM_MIN;
}

export function fitZoomForWidth(canvasWidth, frameWidth) {
  if (!canvasWidth || !frameWidth) return 1;
  const available = Math.max(120, canvasWidth - BOARD_PAD_X * 2);
  return clampZoom(Math.min(1, available / frameWidth));
}

/**
 * Figma-like board camera: zoom + space-drag pan on a scroll container.
 * Fit mode re-computes when the pane or artboard width changes (IDE squeeze).
 */
export function useBoardCamera({ canvasRef, frameWidth }) {
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState(true);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const panRef = useRef(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const fitModeRef = useRef(fitMode);
  fitModeRef.current = fitMode;

  const applyFit = useCallback(() => {
    const canvas = canvasRef?.current;
    if (!canvas || !frameWidth) return;
    const next = fitZoomForWidth(canvas.clientWidth, frameWidth);
    setZoom(next);
  }, [canvasRef, frameWidth]);

  useLayoutEffect(() => {
    if (!fitMode) return;
    applyFit();
  }, [fitMode, applyFit, frameWidth]);

  useEffect(() => {
    const canvas = canvasRef?.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (fitModeRef.current) applyFit();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef, applyFit]);

  const setZoomManual = useCallback((next) => {
    setFitMode(false);
    setZoom(clampZoom(typeof next === "function" ? next(zoomRef.current) : next));
  }, []);

  const zoomIn = useCallback(() => {
    setZoomManual(nearestStep(zoomRef.current, 1));
  }, [setZoomManual]);

  const zoomOut = useCallback(() => {
    setZoomManual(nearestStep(zoomRef.current, -1));
  }, [setZoomManual]);

  const zoomTo100 = useCallback(() => {
    setFitMode(false);
    setZoom(1);
  }, []);

  const zoomToFit = useCallback(() => {
    setFitMode(true);
    applyFit();
  }, [applyFit]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== "Space") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      if (!e.repeat) setSpaceDown(true);
      e.preventDefault();
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") {
        setSpaceDown(false);
        setPanning(false);
        panRef.current = null;
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
    };
  }, []);

  const onCanvasWheel = useCallback(
    (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const direction = e.deltaY > 0 ? -1 : 1;
      setZoomManual(nearestStep(zoomRef.current, direction));
    },
    [setZoomManual]
  );

  const onCanvasPointerDown = useCallback(
    (e) => {
      if (!spaceDown && e.button !== 1) return;
      const canvas = canvasRef?.current;
      if (!canvas) return;
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      panRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: canvas.scrollLeft,
        scrollTop: canvas.scrollTop,
      };
      setPanning(true);
    },
    [spaceDown, canvasRef]
  );

  const onCanvasPointerMove = useCallback(
    (e) => {
      const pan = panRef.current;
      const canvas = canvasRef?.current;
      if (!pan || !canvas) return;
      canvas.scrollLeft = pan.scrollLeft - (e.clientX - pan.x);
      canvas.scrollTop = pan.scrollTop - (e.clientY - pan.y);
    },
    [canvasRef]
  );

  const onCanvasPointerUp = useCallback((e) => {
    const canvas = canvasRef?.current;
    if (canvas?.hasPointerCapture?.(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    panRef.current = null;
    setPanning(false);
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef?.current;
    if (!canvas) return;
    const wheel = (e) => onCanvasWheel(e);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, [canvasRef, onCanvasWheel]);

  return {
    zoom,
    fitMode,
    spaceDown,
    panning,
    zoomIn,
    zoomOut,
    zoomTo100,
    zoomToFit,
    setZoomManual,
    boardPointer: {
      onPointerDown: onCanvasPointerDown,
      onPointerMove: onCanvasPointerMove,
      onPointerUp: onCanvasPointerUp,
      onPointerCancel: onCanvasPointerUp,
    },
  };
}
