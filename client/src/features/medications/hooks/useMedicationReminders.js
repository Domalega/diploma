import { useEffect, useRef } from "react";
import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { todayKey } from "../../calendar/utils/calendarDates";
import { intakeKey, isDue } from "../utils/schedule";
import { isNativeApp } from "../../../shared/reminders/nativeBridge";

export default function useMedicationReminders(
  plan,
  records,
  permission,
  ready,
  recordsDate = todayKey(),
) {
  const { t } = useLanguage();
  const sent = useRef(new Set());
  useEffect(() => {
    sent.current.clear();
  }, [plan.userId]);
  useEffect(() => {
    if (
      isNativeApp() ||
      !ready ||
      !plan.enabled ||
      !plan.reminders ||
      permission !== "granted" ||
      !("Notification" in window)
    )
      return;
    function remind() {
      if (Notification.permission !== "granted") return;
      const date = todayKey(),
        now = new Date();
      if (date !== recordsDate) return;
      const clock =
        String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
      const marks = new Set(
        records
          .filter((record) => record.date === date)
          .map((record) => intakeKey(record.medicationId, record.slotId)),
      );
      const storageKey = "daymark.medication-reminders." + plan.userId;
      let saved = [];
      try {
        const value = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (value?.date === date && Array.isArray(value.slots)) saved = value.slots;
      } catch {
        /* Reminders remain usable when storage is restricted. */
      }
      sent.current.forEach((key) => {
        if (!key.startsWith(date + ":")) sent.current.delete(key);
      });
      plan.slots
        .filter((slot) => slot.time <= clock)
        .forEach((slot) => {
          const key = date + ":" + slot.id + ":" + slot.time;
          if (sent.current.has(key) || saved.includes(key)) return;
          const remaining = plan.rows.filter(
            (row) =>
              isDue(row, date) &&
              row.slotIds.includes(slot.id) &&
              !marks.has(intakeKey(row.id, slot.id)),
          ).length;
          if (!remaining) return;
          try {
            const notification = new Notification(slot.time + " — " + t("Medication reminder"), {
              body: t("reminders.remaining", { count: remaining }),
              tag: key,
              icon:
                process.env.PUBLIC_URL +
                "/daymark-" +
                (document.documentElement.dataset.theme === "dark" ? "dark" : "light") +
                ".svg",
            });
            notification.onclick = () => {
              window.focus();
              notification.close();
            };
            sent.current.add(key);
            saved.push(key);
            try {
              localStorage.setItem(storageKey, JSON.stringify({ date, slots: saved }));
            } catch {
              /* Keep an in-memory fallback. */
            }
          } catch {
            /* Some browsers cannot create page notifications. */
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
  }, [plan, records, permission, ready, recordsDate, t]);
}
