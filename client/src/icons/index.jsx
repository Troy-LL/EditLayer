import Icon from "./Icon.jsx";

export function IconEdit() {
  return (
    <Icon>
      <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" />
    </Icon>
  );
}

export function IconCheck() {
  return (
    <Icon>
      <path d="M3 8.5l3.5 3.5 6.5-7" />
    </Icon>
  );
}

export function IconX() {
  return (
    <Icon>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Icon>
  );
}

export function IconChevronDown({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M4 6l4 4 4-4" />
    </Icon>
  );
}

export function IconAlignLeft() {
  return (
    <Icon>
      <path d="M2 3h12M2 6h8M2 9h10M2 12h6" />
    </Icon>
  );
}

export function IconAlignCenter() {
  return (
    <Icon>
      <path d="M2 3h12M4 6h8M3 9h10M5 12h6" />
    </Icon>
  );
}

export function IconAlignRight() {
  return (
    <Icon>
      <path d="M2 3h12M6 6h8M4 9h10M8 12h6" />
    </Icon>
  );
}

export function IconAlignTop() {
  return (
    <Icon>
      <path d="M3 2h10M6 4h4M4 6h8M5 8h6" />
    </Icon>
  );
}

export function IconAlignMiddleV() {
  return (
    <Icon>
      <path d="M3 2h10M4 5h8M3 8h10M5 11h6" />
    </Icon>
  );
}

export function IconAlignBottom() {
  return (
    <Icon>
      <path d="M3 6h10M4 8h8M5 10h6M3 12h10" />
    </Icon>
  );
}

export function IconDistributeH() {
  return (
    <Icon>
      <path d="M2 4v8M8 4v8M14 4v8M4 8h4M10 8h4" />
    </Icon>
  );
}

export function IconDistributeV() {
  return (
    <Icon>
      <path d="M4 2h8M4 8h8M4 14h8M8 4v4M8 10v4" />
    </Icon>
  );
}

export function IconSnap() {
  return (
    <Icon>
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3" />
      <rect x="5.5" y="5.5" width="5" height="5" rx="0.5" />
    </Icon>
  );
}

export function IconGridSnap() {
  return (
    <Icon>
      <path d="M3 3h10v10H3z" />
      <path d="M3 7h10M3 11h10M7 3v10M11 3v10" />
    </Icon>
  );
}

export function IconUndo() {
  return (
    <Icon>
      <path d="M3 4.5v4h4M3 8.5a5 5 0 1 1 1.5 3.5" />
    </Icon>
  );
}

export function IconRedo() {
  return (
    <Icon>
      <path d="M13 4.5v4H9M13 8.5a5 5 0 1 0-1.5 3.5" />
    </Icon>
  );
}

export function IconEye() {
  return (
    <Icon>
      <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconEyeOff() {
  return (
    <Icon>
      <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" />
      <path d="M3 3l10 10" />
    </Icon>
  );
}

export function IconLock() {
  return (
    <Icon>
      <rect x="4.5" y="7" width="7" height="5.5" rx="1" />
      <path d="M6 7V5.5a2 2 0 0 1 4 0V7" />
    </Icon>
  );
}

export function IconUnlock() {
  return (
    <Icon>
      <rect x="4.5" y="7" width="7" height="5.5" rx="1" />
      <path d="M6 7V5.5a2 2 0 0 1 4-1" />
    </Icon>
  );
}
