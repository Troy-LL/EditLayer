import { useState } from "react";
import { IconChevronDown } from "../icons/index.jsx";

export default function SectionHeader({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="inspector-section">
      <button
        type="button"
        className="inspector-section-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <IconChevronDown className={`chevron${open ? " open" : ""}`} />
      </button>
      {open && <div className="inspector-section-body">{children}</div>}
    </section>
  );
}
