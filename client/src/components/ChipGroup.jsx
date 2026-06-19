export default function ChipGroup({ label, value, options, onChange }) {
  const hasTextLabels = options.some((opt) => !opt.icon);
  return (
    <div className="field-row chip-field">
      {label && <label>{label}</label>}
      <div className="chip-group" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`chip${hasTextLabels && !opt.icon ? " chip-text" : ""}${value === opt.value ? " chip-active" : ""}`}
            onClick={() => onChange(opt.value)}
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={value === opt.value}
          >
            {opt.icon ?? <span className="chip-label">{opt.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
