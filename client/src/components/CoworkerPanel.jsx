import { useEffect, useMemo, useRef, useState } from "react";
import { FEEL_WORDS } from "../../../shared/coworker/requestShape.js";
import { reviewConfig } from "../../../shared/coworker/review.js";
import { elementDisplayName, findElementById } from "../elementTree.js";

const TABS = [
  { id: "requests", label: "Requests" },
  { id: "review", label: "Review" },
  { id: "activity", label: "Activity" },
];

const FEEL_OPTIONS = [...FEEL_WORDS];

function timeAgo(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function isFeedWorthy(entry) {
  return entry.actor?.kind !== "human" || entry.note || entry.summary?.[0] !== "replaced page";
}

function draftFromFeel(feel, selected) {
  const name = selected ? elementDisplayName(selected) : "the page";
  if (!feel.length) return "";
  return `Make ${name} feel ${feel.join(" and ")}`;
}

function TargetChip({ target }) {
  let host = target.url;
  try {
    host = new URL(target.url).host;
  } catch {
    // keep raw url if invalid
  }
  const label = target.component || target.tag || "element";
  return (
    <span className="coworker-chip" title={target.url}>
      {host} · {label}
    </span>
  );
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

function FeelChips({ feel, onToggle }) {
  return (
    <div className="coworker-feel" role="group" aria-label="Style intent for this request">
      {FEEL_OPTIONS.map((word) => {
        const on = feel.includes(word);
        return (
          <button
            key={word}
            type="button"
            className={`coworker-feel-chip${on ? " coworker-feel-chip-on" : ""}`}
            aria-pressed={on}
            onClick={() => onToggle(word)}
          >
            {word}
          </button>
        );
      })}
    </div>
  );
}

function RequestsTab({ requests, config, selectedId, onAsk, onResolve, onFocusElement }) {
  const [text, setText] = useState("");
  const [feel, setFeel] = useState([]);
  const [pin, setPin] = useState(true);
  const [sending, setSending] = useState(false);
  const [queuedHint, setQueuedHint] = useState(false);
  const [draftTouched, setDraftTouched] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef(null);
  const selected = selectedId ? findElementById(config.elements, selectedId) : null;
  const openRequests = requests.filter((r) => r.status === "open");
  const doneRequests = requests.filter((r) => r.status === "done");
  const visibleRequests = showDone ? requests : openRequests;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (draftTouched) return;
    setText(draftFromFeel(feel, selected));
  }, [feel, selected, draftTouched]);

  const toggleFeel = (word) => {
    setFeel((list) => (list.includes(word) ? list.filter((w) => w !== word) : [...list, word]));
  };

  const canSend = Boolean(text.trim() || feel.length);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSend || sending) return;
    setSending(true);
    try {
      const note = text.trim() || draftFromFeel(feel, selected);
      const ok = await onAsk(note, selected && pin ? selected.id : undefined, {
        tag: selected?.type,
        intent: feel.length ? { feel: [...feel] } : undefined,
      });
      if (ok) {
        setText("");
        setFeel([]);
        setDraftTouched(false);
        setQueuedHint(true);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <form className="coworker-ask" onSubmit={submit}>
        <textarea
          ref={inputRef}
          className="toolbar-panel-input coworker-ask-input"
          placeholder="Ask specifically… or pick a feel chip below"
          value={text}
          rows={2}
          onChange={(e) => {
            setDraftTouched(true);
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
          }}
          aria-label="Request for the AI co-worker"
        />
        <FeelChips feel={feel} onToggle={toggleFeel} />
        <div className="coworker-ask-row">
          {selected ? (
            <label className="coworker-pin">
              <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} />
              Pin to {elementDisplayName(selected)}
            </label>
          ) : (
            <span className="coworker-hint">Select an element to pin (keeps the ask specific)</span>
          )}
          <button type="submit" className="toolbar-btn toolbar-btn-primary" disabled={!canSend || sending}>
            Ask
          </button>
        </div>
        <p className="coworker-ask-hint">
          ⌘/Ctrl+Enter queues the ask. Then in this Cursor Agent chat, send anything (e.g. “go”) so the stop hook can dispatch — or start a new Agent session.
        </p>
        {queuedHint && (
          <p className="coworker-queued" role="status">
            Queued on the board. Send “go” (or any message) in the Agent chat to pick it up — don’t re-type the ask.
          </p>
        )}
      </form>
      <div className="toolbar-panel-list">
        {openRequests.length === 0 && !showDone && (
          <p className="toolbar-panel-empty">
            No open requests. Select something, pick a feel or write a specific ask, then Ask.
          </p>
        )}
        {visibleRequests.map((r) => (
          <div key={r.id} className={`coworker-request${r.status === "done" ? " coworker-request-done" : ""}`}>
            <div className="coworker-request-head">
              <span className={`coworker-status coworker-status-${r.status}`}>
                {r.status === "open" ? "Queued" : "Done"}
              </span>
              {r.target ? (
                <TargetChip target={r.target} />
              ) : (
                r.elementId && <ElementChip elements={config.elements} id={r.elementId} onFocusElement={onFocusElement} />
              )}
              <span className="toolbar-panel-row-meta">{timeAgo(r.created_at)}</span>
            </div>
            <p className="coworker-request-text">
              {r.text}
              {r.intent?.feel?.length ? (
                <span className="coworker-summary"> · {r.intent.feel.join(" · ")}</span>
              ) : null}
            </p>
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
        {doneRequests.length > 0 && (
          <button
            type="button"
            className="coworker-done-toggle"
            onClick={() => setShowDone((v) => !v)}
          >
            {showDone ? "Hide done" : `Show ${doneRequests.length} done`}
          </button>
        )}
      </div>
    </>
  );
}

function ReviewTab({ config, onFix, onAsk, onFocusElement }) {
  const review = useMemo(() => reviewConfig(config), [config]);
  const fixable = review.findings.filter((f) => f.fix);
  return (
    <>
      <div className="coworker-score-row">
        <span className={`coworker-score${review.counts.error ? " coworker-score-bad" : review.score >= 90 ? " coworker-score-good" : ""}`}>
          {review.score}
          <span className="coworker-score-max">/100</span>
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
                  {!f.fix && (
                <button
                  type="button"
                  className="toolbar-panel-action"
                  onClick={() => onAsk(`Review finding (${f.rule}): ${f.message}`, f.elementId)}
                >
                  Ask
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
      <div className="toolbar-panel coworker-panel" role="dialog" aria-modal="true" aria-label="Co-worker">
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
        {tab === "review" && (
          <ReviewTab config={config} onFix={onFix} onAsk={onAsk} onFocusElement={onFocusElement} />
        )}
        {tab === "activity" && <ActivityTab activity={activity} config={config} onFocusElement={onFocusElement} />}
      </div>
    </div>
  );
}
