import { useEffect, useState } from "react";
export const NOTIFICATION_KEY = "calendar.notifications";
const permissionNow = () => ("Notification" in window ? Notification.permission : "unavailable");
function savedEnabled() {
  try {
    return localStorage.getItem(NOTIFICATION_KEY) !== "off";
  } catch {
    return true;
  }
}
export default function useNotificationSettings() {
  const [enabled, updateEnabled] = useState(savedEnabled);
  const [permission, setPermission] = useState(permissionNow);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => setPermission(permissionNow());
    const sync = (event) => {
      if (event.key === NOTIFICATION_KEY || event.key === null) updateEnabled(savedEnabled());
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", sync);
    };
  }, []);
  function setEnabled(value) {
    updateEnabled(value);
    try {
      localStorage.setItem(NOTIFICATION_KEY, value ? "on" : "off");
    } catch {
      /* Storage may be restricted. */
    }
  }
  async function requestPermission(enableNotes = true) {
    if (!("Notification" in window) || pending) return;
    setPending(true);
    setError("");
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted" && enableNotes !== false) setEnabled(true);
    } catch {
      setError("Notifications are unavailable in this browser.");
    } finally {
      setPending(false);
    }
  }
  return {
    supported: "Notification" in window,
    permission,
    enabled,
    pending,
    error,
    setEnabled,
    requestPermission,
  };
}
