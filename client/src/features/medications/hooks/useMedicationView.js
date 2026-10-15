import { useState } from "react";

export const MEDICATION_VIEW_KEY = "daymark.medication-view.v1";
export const MEDICATION_VIEWS = ["auto", "table", "buttons"];

export default function useMedicationView() {
  const [view, setView] = useState(() => {
    try {
      const saved = localStorage.getItem(MEDICATION_VIEW_KEY);
      return MEDICATION_VIEWS.includes(saved) ? saved : "auto";
    } catch {
      return "auto";
    }
  });
  function changeView(next) {
    if (!MEDICATION_VIEWS.includes(next)) return;
    setView(next);
    try {
      localStorage.setItem(MEDICATION_VIEW_KEY, next);
    } catch {
      /* The selected view still works when browser storage is unavailable. */
    }
  }
  return [view, changeView];
}
