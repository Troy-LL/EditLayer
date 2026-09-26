export const ONBOARDING_KEY = "editlayer-onboarding:v1";

export const COACH_STEPS = [
  {
    title: "Edit this page",
    body: "Press E. You are editing this page. Esc leaves edit.",
  },
  {
    title: "Select",
    body: "Click an element. The header is the file and the component.",
  },
  {
    title: "Scope",
    body: "Read the scope line. Just this, every one like this, the component, the token, or this frame. That is how far the change goes.",
  },
  {
    title: "Preview",
    body: "Drag padding or color. The page updates. Nothing is written yet.",
  },
  {
    title: "Apply or Ask",
    body: "Apply only for one leaf that is not a token. Otherwise Ask, with a feel word and Desk, Tab, or Phone.",
  },
  {
    title: "The pin",
    body: "Accept keeps the agent's edit. Revert leaves the pin open so the agent undoes the file.",
  },
  {
    title: "Leave design mode",
    body: "Turn the session off. The overlay hides. You are back to coding.",
  },
];

export function advanceCoach(index) {
  if (index >= COACH_STEPS.length - 1) return "done";
  return index + 1;
}

export function coachBlocksEdit(stored) {
  return readCoach(stored) != null;
}

export function readCoach(stored) {
  if (stored === "done") return null;
  const n = Number(stored);
  if (!Number.isInteger(n) || n < 0 || n >= COACH_STEPS.length) return 0;
  return n;
}
