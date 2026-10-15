import { FiArrowUpRight } from "react-icons/fi";
import { parseDate } from "../utils/calendarDates";

export default function CurrentDateTile({ today, onToday }) {
  const day = parseDate(today);
  return (
    <div className="current-date-tile">
      <time dateTime={today}>
        <span className="current-date-number">{day.getDate()}</span>
        <span className="current-date-weekday">
          {day.toLocaleDateString("en", { weekday: "long" })}
        </span>
        <span className="current-date-month">
          {day.toLocaleDateString("en", { month: "long", year: "numeric" })}
        </span>
      </time>
      <button type="button" className="current-date-link" onClick={onToday}>
        Go to today <FiArrowUpRight aria-hidden="true" />
      </button>
    </div>
  );
}
