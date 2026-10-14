import { FiArrowRight, FiSearch, FiCalendar } from "react-icons/fi";
import { formatDay, formatMonth, moveDays, parseDate } from "../utils/calendarDates";

const shortDate = (date) =>
  parseDate(date).toLocaleDateString("en", { day: "numeric", month: "short" });
export default function NotesList({ notes, selectedDate, onSelect, query, month, today }) {
  const groups = new Map();
  notes.forEach((note) => {
    const day = parseDate(note.date);
    const start = moveDays(note.date, -((day.getDay() + 6) % 7));
    const key = query ? note.date.slice(0, 7) + "-01" : start;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(note);
  });
  return (
    <section className="notes-list agenda" aria-label={query ? "Search results" : "Notes list"}>
      <div className="agenda-summary">
        <span>{query ? "SEARCH RESULTS" : "MONTHLY AGENDA"}</span>
        <p role="status">
          {notes.length} {notes.length === 1 ? "note" : "notes"}
          {query ? " found" : " this month"}
        </p>
      </div>
      {notes.length ? (
        Array.from(groups, ([start, items]) => (
          <section
            className="agenda-week"
            key={start}
            aria-label={query ? formatMonth(start) : "Week of " + shortDate(start)}
          >
            <h3>
              {query
                ? formatMonth(start)
                : shortDate(start) + " — " + shortDate(moveDays(start, 6))}
            </h3>
            <ul>
              {items.map((note) => (
                <li key={note.id}>
                  <button
                    type="button"
                    className={
                      "agenda-note" +
                      (selectedDate === note.date ? " is-selected" : "") +
                      (note.date === today ? " is-today" : "")
                    }
                    aria-label={
                      formatDay(note.date) +
                      (note.date === today ? ", Today" : "") +
                      ", " +
                      (note.comment || "Untitled note")
                    }
                    aria-pressed={selectedDate === note.date}
                    onClick={() => onSelect(note.date)}
                  >
                    <time dateTime={note.date} className="agenda-date">
                      <span>
                        {parseDate(note.date).toLocaleDateString("en", { weekday: "short" })}
                      </span>
                      <strong>{parseDate(note.date).getDate()}</strong>
                    </time>
                    <span className="agenda-marker" aria-hidden="true" />
                    <span className="agenda-note-content">
                      {note.date === today && <span className="agenda-today">Today</span>}
                      <span>{note.comment || "Untitled note"}</span>
                    </span>
                    <FiArrowRight className="agenda-open" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <div className="list-empty">
          {query ? <FiSearch aria-hidden="true" /> : <FiCalendar aria-hidden="true" />}
          <h3>{query ? "No matching notes." : "No notes in " + formatMonth(month) + "."}</h3>
          <p>
            {query
              ? "Try another word or date, or clear your search."
              : "Choose another month, or select a day in the calendar to add a note."}
          </p>
        </div>
      )}
    </section>
  );
}
