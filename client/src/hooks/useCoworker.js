import { useCallback, useEffect, useRef, useState } from "react";
import { CLIENT_ID, createRequest, fetchActivity, fetchRequests, updateRequest } from "../api.js";
import useBoardEvents from "./useBoardEvents.js";

const PRESENCE_MS = 8000;
const FLASH_MS = 2400;
const ACTIVITY_LIMIT = 50;

/**
 * Board-level collaboration state: activity feed, requests (comment-style asks),
 * AI presence, and flashes on elements another actor just touched. Page config
 * changes are handed to `onRemoteChange`; this hook never owns the config.
 */
export default function useCoworker({ onRemoteChange, onError }) {
  const [activity, setActivity] = useState([]);
  const [requests, setRequests] = useState([]);
  const [aiActive, setAiActive] = useState(false);
  const [flashes, setFlashes] = useState([]);
  const presenceTimer = useRef(null);

  useEffect(() => {
    fetchActivity()
      .then((data) => setActivity(data.activity ?? []))
      .catch(() => {});
    fetchRequests()
      .then((data) => setRequests(data.requests ?? []))
      .catch(() => {});
    return () => clearTimeout(presenceTimer.current);
  }, []);

  useBoardEvents((event) => {
    if (event.type === "request") {
      setRequests((list) => [event.request, ...list.filter((r) => r.id !== event.request.id)]);
      return;
    }
    if (event.type !== "change") return;
    const { config: _config, ops: _ops, ...entry } = event;
    setActivity((list) => [entry, ...list].slice(0, ACTIVITY_LIMIT));
    if (event.origin === CLIENT_ID) return;
    onRemoteChange(event);
    if (event.actor?.kind === "human") return;
    if (event.actor?.kind === "ai") {
      setAiActive(true);
      clearTimeout(presenceTimer.current);
      presenceTimer.current = setTimeout(() => setAiActive(false), PRESENCE_MS);
    }
    if (event.touchedIds?.length) {
      const key = `${event.version}-${Date.now()}`;
      setFlashes((list) => [...list, { key, ids: event.touchedIds, label: event.actor.name, kind: event.actor.kind }]);
      setTimeout(() => setFlashes((list) => list.filter((f) => f.key !== key)), FLASH_MS);
    }
  });

  const ask = useCallback(
    async (text, elementId) => {
      try {
        await createRequest(text, elementId);
        return true;
      } catch (err) {
        onError?.(err.message ?? "Could not send request");
        return false;
      }
    },
    [onError]
  );

  const resolve = useCallback(
    async (id, status = "done") => {
      try {
        await updateRequest(id, { status });
      } catch (err) {
        onError?.(err.message ?? "Could not update request");
      }
    },
    [onError]
  );

  const openCount = requests.filter((r) => r.status === "open").length;

  return { activity, requests, openCount, aiActive, flashes, ask, resolve };
}
