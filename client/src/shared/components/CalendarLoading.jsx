import { useEffect, useState } from "react";
import "../styles/CalendarLoading.css";

export default function CalendarLoading({ fullPage = false, label = "Opening your calendar…" }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 12000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`calendar-loading${fullPage ? " calendar-loading-page" : ""}`}>
      <div className="calendar-loading-art" aria-hidden="true">
        <span className="calendar-loading-orbit" />
        <div className="calendar-loading-sheet">
          <span className="calendar-loading-binding" />
          <div className="calendar-loading-header">
            <span />
            <span />
          </div>
          <div className="calendar-loading-days">
            {Array.from({ length: 21 }, (_, day) => (
              <span key={day} style={{ "--day-delay": `${day * 65}ms` }} />
            ))}
          </div>
        </div>
        <span className="calendar-loading-spark" />
      </div>
      <div className="calendar-loading-copy" role="status" aria-live="polite" aria-atomic="true">
        <p>{label}</p>
        <span>
          {slow ? "The server is taking a little longer. Still connecting…" : "Just a moment."}
        </span>
      </div>
    </div>
  );
}
