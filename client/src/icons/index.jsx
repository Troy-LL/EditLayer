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
