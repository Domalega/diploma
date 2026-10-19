import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supportsAppUpdates, updateNative } from "./bridge";

const UpdatesContext = createContext({ supported: false });
export const useAppUpdates = () => useContext(UpdatesContext);

export function AppUpdatesProvider({ children }) {
  const supported = supportsAppUpdates();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  const polling = useRef(false);
  const actionPending = useRef(false);
  const epoch = useRef(0);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const refresh = useCallback(async () => {
    if (polling.current || actionPending.current || document.hidden) return;
    polling.current = true;
    const requestId = epoch.current;
    try {
      const result = await updateNative("status");
      if (active.current && requestId === epoch.current) setStatus(result);
    } catch {
      // Manual actions report errors; polling remains quiet while offline.
    } finally {
      polling.current = false;
    }
  }, []);
  useEffect(() => {
    if (!supported) return;
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("daymark:updates", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("daymark:updates", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [supported, refresh]);
  const downloading = !!status?.downloading;
  useEffect(() => {
    if (!supported) return;
    const timer = setInterval(refresh, downloading ? 2500 : 60000);
    return () => clearInterval(timer);
  }, [supported, downloading, refresh]);
  async function run(action) {
    if (!supported || actionPending.current) return;
    actionPending.current = true;
    ++epoch.current;
    setBusy(true);
    setError("");
    try {
      const result = await updateNative(action);
      if (active.current) setStatus(result);
    } catch (failure) {
      if (active.current) setError(failure.message);
    } finally {
      actionPending.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <UpdatesContext.Provider value={{ supported, status, busy, error, run }}>
      {children}
    </UpdatesContext.Provider>
  );
}
