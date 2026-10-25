import { useCallback, useEffect, useRef, useState } from "react";
import { getToken } from "../api/tokenStorage";
import { isOfflineApp, offlineNative } from "./bridge";
import { encryptionSession } from "../encryption/session";

// The owner stays mounted while the settings drawer is closed, so background
// exchanges still refresh the calendar and other dashboard tiles.
export default function useOfflineSyncStatus() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(null);
  const active = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const next = await offlineNative("status");
      if (!active.current) return;
      setState(next);
      setError("");
      if (revision.current !== null && revision.current !== next.syncRevision)
        window.dispatchEvent(new Event("daymark:sync"));
      revision.current = next.syncRevision;
    } catch (error) {
      if (active.current) setError(error.message);
    }
  }, []);
  useEffect(() => {
    if (!isOfflineApp() || encryptionSession()) return;
    active.current = true;
    refresh();
    const poll = setInterval(() => {
      if (!document.hidden) refresh();
    }, 3000);
    const sync = () =>
      offlineNative("sync")
        .then(refresh)
        .catch(() => {});
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    return () => {
      active.current = false;
      clearInterval(poll);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
    };
  }, [refresh]);
  async function action(name, payload = {}) {
    setBusy(true);
    try {
      await offlineNative(name, { ...payload, token: getToken() });
      await refresh();
    } catch (error) {
      if (active.current) setError(error.message);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return { state, busy, error, action };
}
