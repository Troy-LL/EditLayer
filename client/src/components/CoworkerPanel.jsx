import { useEffect, useMemo, useRef, useState } from "react";
import { reviewConfig } from "../../../shared/coworker/review.js";
import { elementDisplayName, findElementById } from "../elementTree.js";

const TABS = [
  { id: "requests", label: "Requests" },
  { id: "review", label: "Review" },
  { id: "activity", label: "Activity" },
];

function timeAgo(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function isFeedWorthy(entry) {
  return entry.actor?.kind !== "human" || entry.note || entry.summary?.[0] !== "replaced page";
}

function ElementChip({ elements, id, onFocusElement }) {
  const el = findElementById(elements, id);
  if (!el) return <span className="coworker-chip coworker-chip-missing">{id}</span>;
  return (
    <button type="button" className="coworker-chip" onClick={() => onFocusElement(id)} title="Select on canvas">
      {elementDisplayName(el)}
    </button>
  );
}

function RequestsTab({ requests, config, selectedId, onAsk, onResolve, onFocusElement }) {
  const [text, setText] = useState("");
  const [pin, setPin] = useState(true);
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);
  const selected = selectedId ? findElementById(config.elements, selectedId) : null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await onAsk(text.trim(), selected && pin ? selected.id : undefined);
    setSending(false);
    if (ok) setText("");
  };

  return (
    <>
      <form className="coworker-ask" onSubmit={submit}>
        <textarea
          ref={inputRef}
          className="toolbar-panel-input coworker-ask-input"
          placeholder="Ask your co-worker… e.g. “Make the hero headline bolder and add a signup button”"
          value={text}
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
          }}
          aria-label="Request for the AI co-worker"
        />
        <div className="coworker-ask-row">
          {selected ? (
            <label className="coworker-pin">
              <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} />
              Pin to {elementDisplayName(selected)}
            </label>
          ) : (
            <span className="coworker-hint">Select an element to pin the request to it</span>
          )}
          <button type="submit" className="toolbar-btn toolbar-btn-primary" disabled={!text.trim() || sending}>
            Ask
          </button>
        </div>
      </form>
      <div className="toolbar-panel-list">
        {requests.length === 0 && (
          <p className="toolbar-panel-empty">
            No requests yet. Ask for a change and your AI co-worker picks it up from the board.
          </p>
        )}
        {requests.map((r) => (
          <div key={r.id} className={`coworker-request${r.status === "done" ? " coworker-request-done" : ""}`}>
            <div className="coworker-request-head">
              <span className={`coworker-status coworker-status-${r.status}`}>{r.status === "open" ? "Open" : "Done"}</span>
              {r.elementId && <ElementChip elements={config.elements} id={r.elementId} onFocusElement={onFocusElement} />}
              <span className="toolbar-panel-row-meta">{timeAgo(r.created_at)}</span>
            </div>
            <p className="coworker-request-text">{r.text}</p>
            {r.reply && <p className="coworker-reply">{r.reply}</p>}
            <div className="toolbar-panel-row-actions">
              <button
                type="button"
                className="toolbar-panel-action"
                onClick={() => onResolve(r.id, r.status === "open" ? "done" : "open")}
              >
                {r.status === "open" ? "Mark done" : "Reopen"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ReviewTab({ config, onFix, onFocusElement }) {
  const review = useMemo(() => reviewConfig(config), [config]);
  const fixable = review.findings.filter((f) => f.fix);
  return (
    <>
      <div className="coworker-score-row">
        <span className={`coworker-score${review.counts.error ? " coworker-score-bad" : review.score >= 90 ? " coworker-score-good" : ""}`}>
          {review.score}
        </span>
        <span className="coworker-score-label">
          {review.counts.error} errors · {review.counts.warn} warnings · {review.counts.info} notes
        </span>
        {fixable.length > 1 && (
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => onFix(fixable.flatMap((f) => f.fix), `Fix all (${fixable.length})`)}
          >
            Fix all
          </button>
        )}
      </div>
      <div className="toolbar-panel-list">
        {review.findings.length === 0 && (
          <p className="toolbar-panel-empty">No issues. Contrast, content, alt text, and tap targets all pass.</p>
        )}
        {review.findings.map((f) => (
          <div key={f.id} className="toolbar-panel-row coworker-finding">
            <div className="toolbar-panel-row-main">
              <span className="toolbar-panel-row-meta">
                <span className={`coworker-sev coworker-sev-${f.severity}`}>{f.severity}</span>
                {f.rule}
              </span>
              <span className="coworker-finding-text">{f.message}</span>
            </div>
            <div className="toolbar-panel-row-actions">
              {f.elementId && (
                <button type="button" className="toolbar-panel-action" onClick={() => onFocusElement(f.elementId)}>
                  Select
                </button>
              )}
              {f.fix && (
                <button type="button" className="toolbar-panel-action" onClick={() => onFix(f.fix, `Fix ${f.rule}`)}>
                  Fix
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ActivityTab({ activity, config, onFocusElement }) {
  const entries = activity.filter(isFeedWorthy);
  return (
    <div className="toolbar-panel-list">
      {entries.length === 0 && <p className="toolbar-panel-empty">Changes from your co-worker show up here as they happen.</p>}
      {entries.map((a) => (
        <div key={`${a.version}-${a.at}`} className="coworker-activity">
          <div className="coworker-request-head">
            <span className={`coworker-actor coworker-actor-${a.actor.kind}`}>{a.actor.name}</span>
            <span className="toolbar-panel-row-meta">v{a.version} · {timeAgo(a.at)}</span>
          </div>
          {a.note && <p className="coworker-request-text">{a.note}</p>}
          <p className="coworker-summary">{a.summary.join(" · ")}</p>
          {a.touchedIds?.length > 0 && (
            <div className="coworker-chips">
              {a.touchedIds.slice(0, 6).map((id) => (
                <ElementChip key={id} elements={config.elements} id={id} onFocusElement={onFocusElement} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function CoworkerPanel({
  open,
  onClose,
  config,
  selectedId,
  requests,
  activity,
  onAsk,
  onResolve,
  onFix,
  onFocusElement,
}) {
  const [tab, setTab] = useState("requests");

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="toolbar-panel-root toolbar-panel-root-wide">
      <div className="toolbar-panel coworker-panel" role="dialog" aria-label="Co-worker">
        <div className="toolbar-panel-header">
          <div className="coworker-tabs" role="tablist">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`coworker-tab${tab === id ? " coworker-tab-active" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
                {id === "requests" && requests.some((r) => r.status === "open") && (
                  <span className="coworker-count">{requests.filter((r) => r.status === "open").length}</span>
                )}
              </button>
            ))}
          </div>
          <button type="button" className="toolbar-panel-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {tab === "requests" && (
          <RequestsTab
            requests={requests}
            config={config}
            selectedId={selectedId}
            onAsk={onAsk}
            onResolve={onResolve}
            onFocusElement={onFocusElement}
          />
        )}
        {tab === "review" && <ReviewTab config={config} onFix={onFix} onFocusElement={onFocusElement} />}
        {tab === "activity" && <ActivityTab activity={activity} config={config} onFocusElement={onFocusElement} />}
      </div>
    </div>
  );
}
