import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { useEffect, useRef } from "react";
import { todayKey } from "../utils/calendarDates";
export default function useDateNotifications(dates, enabled, permission) {
  const { t } = useLanguage();

  const notified = useRef(new Set());
  useEffect(() => {
    if (!enabled || !("Notification" in window) || permission !== "granted") return;
    function remind() {
      if (Notification.permission !== "granted") return;
      const today = todayKey();
      const now = new Date();
      const clock =
        String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
      notified.current.forEach((key) => {
        if (!key.startsWith(today + ":")) notified.current.delete(key);
      });
      dates
        .filter((item) => item.date === today && (!item.time || item.time <= clock))
        .forEach((item) => {
          const key = today + ":" + item.id + ":" + (item.time || "all-day");
          if (notified.current.has(key)) return;
          try {
            const notification = new Notification(
              item.time ? item.time + " — " + t("A note for today") : t("A note for today"),
              {
                body: item.comment || t("Open your calendar to see today's note."),
                icon:
                  process.env.PUBLIC_URL +
                  "/daymark-" +
                  (document.documentElement.dataset.theme === "dark" ? "dark" : "light") +
                  ".svg",
              },
            );
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
  }, [dates, enabled, permission, t]);
}
