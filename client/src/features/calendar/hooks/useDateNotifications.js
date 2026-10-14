import { useEffect, useRef } from "react";
import { todayKey } from "../utils/calendarDates";
export default function useDateNotifications(dates, enabled, permission) {
  const notified = useRef(new Set());
  useEffect(() => {
    if (!enabled || !("Notification" in window) || permission !== "granted") return;
    function remind() {
      if (Notification.permission !== "granted") return;
      const today = todayKey();
      notified.current.forEach((key) => {
        if (!key.startsWith(today + ":")) notified.current.delete(key);
      });
      dates
        .filter((item) => item.date === today)
        .forEach((item) => {
          const key = today + ":" + item.id;
          if (notified.current.has(key)) return;
          try {
            const notification = new Notification("A note for today", {
              body: item.comment || "Open your calendar to see today's note.",
              icon: process.env.PUBLIC_URL + "/logo.png",
            });
            notification.onclick = () => {
              window.focus();
              notification.close();
            };
            notified.current.add(key);
          } catch {
            /* Some browsers expose the API but cannot create desktop notifications. */
          }
        });
    }
    remind();
    const timer = window.setInterval(remind, 60000);
    window.addEventListener("focus", remind);
    document.addEventListener("visibilitychange", remind);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", remind);
      document.removeEventListener("visibilitychange", remind);
    };
  }, [dates, enabled, permission]);
}
