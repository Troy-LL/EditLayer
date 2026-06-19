import { useCallback, useRef, useState } from "react";

const MAX_HISTORY = 50;

export function cloneConfig(config) {
  return structuredClone(config);
}

export function configsEqual(a, b) {
  if (!a || !b) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function useConfigHistory() {
  const pastRef = useRef([]);
  const futureRef = useRef([]);
  const [, setTick] = useState(0);

  const notify = () => setTick((t) => t + 1);

  const clear = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    notify();
  }, []);

  const push = useCallback((config) => {
    pastRef.current = [...pastRef.current, cloneConfig(config)].slice(-MAX_HISTORY);
    futureRef.current = [];
    notify();
  }, []);

  const undo = useCallback((currentConfig) => {
    if (pastRef.current.length === 0) return null;
    const previous = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [cloneConfig(currentConfig), ...futureRef.current];
    notify();
    return cloneConfig(previous);
  }, []);

  const redo = useCallback((currentConfig) => {
    if (futureRef.current.length === 0) return null;
    const next = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current, cloneConfig(currentConfig)];
    notify();
    return cloneConfig(next);
  }, []);

  return {
    push,
    undo,
    redo,
    clear,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
