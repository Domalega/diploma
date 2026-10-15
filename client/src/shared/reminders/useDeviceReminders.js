import { useEffect, useState } from "react";
import { isNativeApp, nativeRequest, deviceRemindersEnabled } from "./nativeBridge";
import { reminderPlan } from "./reminderPlan";

export default function useDeviceReminders(options, ready) {
  const [state, setState] = useState({ error: "", savedAt: null, exact: true });
  const payload = JSON.stringify(reminderPlan(options));
  useEffect(() => {
    if (!isNativeApp()) return;
    const refresh = () => {
      if (deviceRemindersEnabled())
        nativeRequest("status")
          .then((result) => setState((value) => ({ ...value, ...result })))
          .catch(() => {});
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  useEffect(() => {
    if (!isNativeApp() || !ready || !deviceRemindersEnabled()) return;
    let current = true;
    // Serialize native writes; each snapshot replaces the complete set of future rules.
    const timer = setTimeout(() => {
      nativeRequest("sync", JSON.parse(payload)).then(
        (result) => current && setState({ error: "", ...result }),
        () =>
          current &&
          setState((value) => ({
            ...value,
            error: "Device reminders could not be saved. Reopen the app and try again.",
          })),
      );
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [payload, ready]);
  return state;
}
