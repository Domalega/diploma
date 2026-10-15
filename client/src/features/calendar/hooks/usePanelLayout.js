import { useState } from "react";

export const PANEL_ORDER = ["calendar", "today", "notes", "medications"];
export const PANEL_LAYOUT_KEY = "daymark.panel-layout.v1";
export const PANEL_SIZES_KEY = "daymark.panel-sizes.v1";
export const PANEL_COLUMNS = { calendar: 8, today: 4, notes: 4, medications: 12 };
const MIN_COLUMNS = { calendar: 6, today: 3, notes: 3, medications: 6 };
const MIN_HEIGHT = { calendar: 600, today: 220, notes: 240, medications: 260 };
export function clampPanelSize(id, size) {
  if (!PANEL_ORDER.includes(id) || !size || typeof size !== "object") return {};
  const result = {};
  for (const [key, min, max] of [
    ["columns", MIN_COLUMNS[id], 12],
    ["height", MIN_HEIGHT[id], 1600],
  ]) {
    if (typeof size[key] === "number" && Number.isFinite(size[key]))
      result[key] = Math.min(max, Math.max(min, Math.round(size[key])));
  }
  return result;
}
export function normalizePanelSizes(value) {
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const id of PANEL_ORDER) {
    const size = clampPanelSize(id, value[id]);
    if (Object.keys(size).length) result[id] = size;
  }
  return result;
}
export function normalizePanelOrder(value) {
  if (!Array.isArray(value)) return [...PANEL_ORDER];
  return [...new Set([...value.filter((id) => PANEL_ORDER.includes(id)), ...PANEL_ORDER])];
}
function readLayout() {
  try {
    return normalizePanelOrder(JSON.parse(localStorage.getItem(PANEL_LAYOUT_KEY)));
  } catch {
    return [...PANEL_ORDER];
  }
}
export default function usePanelLayout() {
  const [order, setOrder] = useState(readLayout);
  const [sizes, setSizes] = useState(() => {
    try {
      return normalizePanelSizes(JSON.parse(localStorage.getItem(PANEL_SIZES_KEY)));
    } catch {
      return {};
    }
  });
  function saveSizes(next) {
    setSizes(next);
    try {
      localStorage.setItem(PANEL_SIZES_KEY, JSON.stringify(next));
    } catch {
      /* Resizing remains available without browser storage. */
    }
  }
  function save(next) {
    setOrder(next);
    try {
      localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(next));
    } catch {
      /* Layout changes still work when browser storage is unavailable. */
    }
  }
  function move(id, target) {
    if (id === target || !order.includes(id) || !order.includes(target)) return;
    const next = [...order];
    next.splice(order.indexOf(id), 1);
    next.splice(order.indexOf(target), 0, id);
    save(next);
  }
  function resize(id, size) {
    if (!PANEL_ORDER.includes(id)) return;
    saveSizes(normalizePanelSizes({ ...sizes, [id]: size }));
  }
  return {
    order,
    sizes,
    move,
    resize,
    reset: () => {
      save([...PANEL_ORDER]);
      saveSizes({});
    },
  };
}
