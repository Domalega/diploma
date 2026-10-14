import { useEffect, useState } from "react";
import { todayKey } from "../utils/calendarDates";
export default function useToday() {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const refresh = () => setToday(todayKey());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return today;
}
