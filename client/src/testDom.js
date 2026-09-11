import { JSDOM } from "jsdom";

if (!globalThis.document?.createElement) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: window.navigator,
  });
  for (const key of [
    "HTMLElement",
    "SVGElement",
    "Node",
    "DocumentFragment",
    "MutationObserver",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
  ]) {
    if (!(key in globalThis) && window[key]) globalThis[key] = window[key];
  }
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}
