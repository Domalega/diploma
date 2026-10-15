import { useState } from "react";

export const PANEL_ORDER = ["calendar", "today", "notes", "medications"];
export const PANEL_LAYOUT_KEY = "daymark.panel-layout.v1";
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
  return { order, move, reset: () => save([...PANEL_ORDER]) };
}
