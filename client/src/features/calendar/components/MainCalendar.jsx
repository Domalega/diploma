import { useLayoutEffect, useRef, useState } from "react";
import {
  formatDay,
  monthDays,
  moveDays,
  moveMonths,
  parseDate,
  todayKey,
} from "../utils/calendarDates";
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export default function MainCalendar({
  month,
  selectedDate,
  dates,
  onSelect,
  onMonthChange,
  today = todayKey(),
}) {
  const days = monthDays(month);
  const notes = new Map(dates.map((item) => [item.date, item]));
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
        aria-label="Monthly calendar"
        aria-describedby="calendar-keyboard-help"
      >
        <thead>
          <tr>
            {weekdays.map((day) => (
              <th key={day} scope="col" abbr={day}>
                <span aria-hidden="true">{day.slice(0, 3)}</span>
                <span className="visually-hidden">{day}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: days.length / 7 }, (_, row) => (
            <tr key={row}>
              {days.slice(row * 7, row * 7 + 7).map((value) => {
                const note = notes.get(value),
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
                        formatDay(value) +
                        (isToday ? ", Today" : "") +
                        (note ? ", Note: " + (note.comment || "Untitled note") : "")
                      }
                      aria-pressed={selected}
                      aria-current={isToday ? "date" : undefined}
                      onFocus={() => setFocusDate(value)}
                      onKeyDown={(event) => navigate(event, value)}
                      onClick={() => onSelect(value)}
                    >
                      <span className="day-number">{parseDate(value).getDate()}</span>
                      {isToday && <span className="today-label">Today</span>}
                      {note && (
                        <span className="day-note">
                          <span className="note-dot" aria-hidden="true" />
                          <span>{note.comment || "Untitled note"}</span>
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
        Use arrow keys to explore dates, Enter to open a day, and Page Up / Down to change months.
      </p>
    </>
  );
}
