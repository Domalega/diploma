import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { parseDate } from "../utils/calendarDates";

export default function CurrentDateTile({ today }) {
  const { locale } = useLanguage();

  const day = parseDate(today);
  return (
    <div className="current-date-tile">
      <time dateTime={today}>
        <span className="current-date-number">{day.getDate()}</span>
        <span className="current-date-weekday">
          {day.toLocaleDateString(locale, { weekday: "long" })}
        </span>
        <span className="current-date-month">
          {day.toLocaleDateString(locale, { month: "long", year: "numeric" })}
        </span>
      </time>
    </div>
  );
}
