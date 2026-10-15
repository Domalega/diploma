import { useEffect, useState } from "react";
import {
  isNativeApp,
  nativeRequest,
  deviceRemindersEnabled,
  setDeviceReminders,
} from "../../../shared/reminders/nativeBridge";
export const NOTIFICATION_KEY = "calendar.notifications";
const permissionNow = () =>
  isNativeApp() ? "default" : "Notification" in window ? Notification.permission : "unavailable";
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
  const [message, setMessage] = useState("");
  useEffect(() => {
    const refresh = () => {
      if (isNativeApp())
        nativeRequest("status")
          .then((status) => {
            setPermission(deviceRemindersEnabled() ? status.permission : "default");
          })
          .catch(() => {});
      else setPermission(permissionNow());
    };
    refresh();
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
    if ((!isNativeApp() && !("Notification" in window)) || pending) return;
    setPending(true);
    setError("");
    try {
      const result = isNativeApp()
        ? (await nativeRequest("permission")).permission
        : await Notification.requestPermission();
      if (isNativeApp() && result === "granted") setDeviceReminders(true);
      setPermission(result);
      if (result === "granted" && enableNotes !== false) setEnabled(true);
    } catch {
      setError(
        isNativeApp()
          ? "Device reminders could not be saved. Reopen the app and try again."
          : "Notifications are unavailable in this browser.",
      );
    } finally {
      setPending(false);
    }
  }
  return {
    supported: isNativeApp() || "Notification" in window,
    native: isNativeApp(),
    async disableDevice() {
      setError("");
      setMessage("");
      try {
        await nativeRequest("clear");
        setDeviceReminders(false);
        setPermission("default");
      } catch {
        setError("Device reminders could not be saved. Reopen the app and try again.");
      }
    },
    async testDevice() {
      setError("");
      setMessage("");
      try {
        await nativeRequest("test");
        setMessage("Test notification scheduled in five seconds. You can close the app.");
      } catch {
        setError("Device reminders could not be saved. Reopen the app and try again.");
      }
    },
    async configureExact() {
      await nativeRequest("exactSettings");
    },
    permission,
    enabled,
    pending,
    error,
    message,
    setEnabled,
    requestPermission,
  };
}
