import { useEffect, useRef } from "react";
import { boardEventsUrl } from "../api.js";

/** Subscribe to the live board stream (changes by AI, tests, other tabs; request updates). */
export default function useBoardEvents(onEvent) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (typeof EventSource === "undefined") return undefined;
    const source = new EventSource(boardEventsUrl());
    source.onmessage = (e) => {
      try {
        handlerRef.current(JSON.parse(e.data));
      } catch {
        // Ignore malformed frames; the next change carries the full config.
      }
    };
    return () => source.close();
  }, []);
}
