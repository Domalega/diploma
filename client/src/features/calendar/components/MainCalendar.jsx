import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { weekdayLabel } from "../../../shared/i18n/formatters";
import { useLayoutEffect, useRef, useState } from "react";
import {
  formatDay,
  monthDays,
  moveDays,
  moveMonths,
  parseDate,
  todayKey,
} from "../utils/calendarDates";
import { compareNotes } from "../utils/noteTimes";
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export default function MainCalendar({
  month,
  selectedDate,
  dates,
  onSelect,
  onMonthChange,
  today = todayKey(),
}) {
  const { t, locale } = useLanguage();

  const days = monthDays(month);
  const notes = new Map();
  [...dates].sort(compareNotes).forEach((note) => {
    if (!notes.has(note.date)) notes.set(note.date, []);
    notes.get(note.date).push(note);
  });
  const [focusDate, setFocusDate] = useState(selectedDate);
  const focusAfterRender = useRef(false);
  const grid = useRef(null);
  const tabDate = days.includes(focusDate)
    ? focusDate
    : days.includes(selectedDate)
      ? selectedDate
      : month;
  useLayoutEffect(() => {
    if (!focusAfterRender.current) return;
    grid.current?.querySelector('[data-date="' + focusDate + '"]')?.focus();
    focusAfterRender.current = false;
  }, [focusDate, month]);
  function navigate(event, value) {
    const day = (parseDate(value).getDay() + 6) % 7;
    const offsets = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -day,
      End: 6 - day,
    };
    let next;
    if (event.key in offsets) next = moveDays(value, offsets[event.key]);
    else if (event.key === "PageUp" || event.key === "PageDown")
      next = moveMonths(value, (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1));
    else return;
    event.preventDefault();
    focusAfterRender.current = true;
    setFocusDate(next);
    if (next.slice(0, 7) !== month.slice(0, 7)) onMonthChange(next);
  }
  return (
    <>
      <table
        className="month-grid"
        ref={grid}
        aria-label={t("Monthly calendar")}
        aria-describedby="calendar-keyboard-help"
      >
        <thead>
          <tr>
            {weekdays.map((day, index) => (
              <th key={day} scope="col" abbr={t(day)}>
                <span aria-hidden="true">{weekdayLabel((index + 1) % 7, locale)}</span>
                <span className="visually-hidden">{t(day)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: days.length / 7 }, (_, row) => (
            <tr key={row}>
              {days.slice(row * 7, row * 7 + 7).map((value) => {
                const dayNotes = notes.get(value) || [],
                  selected = value === selectedDate,
                  isToday = value === today;
                return (
                  <td key={value}>
                    <button
                      type="button"
                      data-date={value}
                      tabIndex={value === tabDate ? 0 : -1}
                      className={[
                        "day-cell",
                        value.slice(0, 7) !== month.slice(0, 7) ? "is-outside" : "",
                        isToday ? "is-today" : "",
                        selected ? "is-selected" : "",
                      ].join(" ")}
                      aria-label={
                        formatDay(value, locale) +
                        (isToday ? t(", Today") : "") +
                        (dayNotes.length
                          ? (dayNotes.length === 1
                              ? t(", Note: ")
                              : ", " + t("notes.count", { count: dayNotes.length }) + ": ") +
                            dayNotes
                              .map(
                                (note) =>
                                  (note.time ? note.time + " " : "") +
                                  (note.comment || t("Untitled note")),
                              )
                              .join("; ")
                          : "")
                      }
                      aria-pressed={selected}
                      aria-current={isToday ? "date" : undefined}
                      onFocus={() => setFocusDate(value)}
                      onKeyDown={(event) => navigate(event, value)}
                      onClick={() => onSelect(value)}
                    >
                      <span className="day-number">{parseDate(value).getDate()}</span>
                      {isToday && <span className="today-label">{t("Today")}</span>}
                      {dayNotes.slice(0, 2).map((note) => (
                        <span className="day-note" key={note.id}>
                          <span className="note-dot" aria-hidden="true" />
                          {note.time && (
                            <time dateTime={note.date + "T" + note.time}>{note.time}</time>
                          )}
                          <span>{note.comment || t("Untitled note")}</span>
                        </span>
                      ))}
                      {dayNotes.length > 2 && (
                        <span className="day-note-more">
                          {t("notes.more", { count: dayNotes.length - 2 })}
                        </span>
                      )}
                      {!!dayNotes.length && (
                        <span className="day-note-count" aria-hidden="true">
                          {t("notes.count", { count: dayNotes.length })}
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p id="calendar-keyboard-help" className="keyboard-help">
        {t(
          "Use arrow keys to explore dates, Enter to open a day, and Page Up / Down to change months.",
        )}
      </p>
    </>
  );
}
