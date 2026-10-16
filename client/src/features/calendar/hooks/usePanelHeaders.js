import { useEffect, useState } from "react";

export const HIDE_PANEL_HEADERS_KEY = "calendar.hidePanelHeaders";
const read = () => {
  try {
    return localStorage.getItem(HIDE_PANEL_HEADERS_KEY) === "true";
  } catch {
    return false;
  }
};

export default function usePanelHeaders() {
  const [hidden, setHidden] = useState(read);
  useEffect(() => {
    const sync = (event) => {
      if (event.key === HIDE_PANEL_HEADERS_KEY || event.key === null) setHidden(read());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return [
    hidden,
    (value) => {
      setHidden(value);
      try {
        localStorage.setItem(HIDE_PANEL_HEADERS_KEY, String(value));
      } catch {
        // Keep the setting usable when browser storage is restricted.
      }
    },
  ];
}
