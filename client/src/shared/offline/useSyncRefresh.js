import { useEffect } from "react";
export default function useSyncRefresh(reload) {
  useEffect(() => {
    const refresh = () => {
      Promise.resolve(reload()).catch(() => {});
    };
    window.addEventListener("daymark:sync", refresh);
    return () => window.removeEventListener("daymark:sync", refresh);
  }, [reload]);
}
