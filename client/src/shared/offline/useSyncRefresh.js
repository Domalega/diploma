import { useEffect } from "react";
import { isOfflineApp } from "./bridge";
import { encryptionSession } from "../encryption/session";
export default function useSyncRefresh(reload) {
  useEffect(() => {
    const refresh = () => {
      Promise.resolve(reload()).catch(() => {});
    };
    const visibleRefresh = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const browser = !isOfflineApp() || !!encryptionSession();
    window.addEventListener("daymark:sync", refresh);
    if (browser) {
      window.addEventListener("online", refresh);
      window.addEventListener("focus", visibleRefresh);
    }
    const timer = browser ? setInterval(visibleRefresh, 60000) : null;
    return () => {
      window.removeEventListener("daymark:sync", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", visibleRefresh);
      if (timer) clearInterval(timer);
    };
  }, [reload]);
}
