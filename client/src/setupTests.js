import "@testing-library/jest-dom";
import { runInThisContext } from "vm";

// Jest's Node environment predates the Web APIs supplied by the project's Node 22 runtime.
if (typeof window === "undefined") {
  for (const name of [
    "DOMException",
    "structuredClone",
    "Event",
    "EventTarget",
    "TextEncoder",
    "TextDecoder",
    "atob",
    "btoa",
  ])
    global[name] = runInThisContext(name);
}

// jsdom does not implement the media-query API used by Bootstrap's Offcanvas.
if (typeof window !== "undefined")
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
