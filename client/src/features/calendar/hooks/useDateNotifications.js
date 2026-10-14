import { useEffect, useRef } from "react";
import moment from "moment";

export default function useDateNotifications(dates, permissionVersion) {
  const notified = useRef(new Set());
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const today = moment().format("YYYY-MM-DD");
    dates
      .filter((item) => item.date === today)
      .forEach((item) => {
        if (notified.current.has(item.id)) return;
        try {
          const notification = new Notification("Today", {
            body: item.comment || "",
            icon: `${process.env.PUBLIC_URL}/logo.png`,
          });
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
          notified.current.add(item.id);
        } catch {
          // Some browsers expose Notification but cannot create desktop notifications.
        }
      });
  }, [dates, permissionVersion]);
}
