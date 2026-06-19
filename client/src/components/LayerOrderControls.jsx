const ACTIONS = [
  { id: "front", label: "Bring to front", shortcut: "Ctrl+Shift+]" },
  { id: "forward", label: "Bring forward", shortcut: "Ctrl+]" },
  { id: "backward", label: "Send backward", shortcut: "Ctrl+[" },
  { id: "back", label: "Send to back", shortcut: "Ctrl+Shift+[" },
];

export default function LayerOrderControls({ onOrder, disabled = false }) {
  return (
    <div className="layer-order-grid">
      {ACTIONS.map(({ id, label, shortcut }) => (
        <button
          key={id}
          type="button"
          className="layer-order-btn"
          disabled={disabled}
          onClick={() => onOrder(id)}
          title={`${label} (${shortcut})`}
        >
          <span className="layer-order-label">{label}</span>
          <span className="layer-order-shortcut">{shortcut}</span>
        </button>
      ))}
    </div>
  );
}
