import { FiArrowUpRight, FiSearch, FiFeather } from "react-icons/fi";
import { formatDay, parseDate } from "../utils/calendarDates";
export default function NotesList({
  notes,
  selectedDate,
  onSelect,
  query,
  showPast,
  onShowPastChange,
}) {
  return (
    <section className="notes-list" aria-label={query ? "Search results" : "Notes list"}>
      <div className="notes-list-header">
        <h2>{query ? "Search results" : showPast ? "All your notes" : "Coming up"}</h2>
        {!query && (
          <label className="list-filter">
            <span className="visually-hidden">Notes to show</span>
            <select
              value={showPast ? "all" : "upcoming"}
              onChange={(event) => onShowPastChange(event.target.value === "all")}
            >
              <option value="upcoming">Upcoming</option>
              <option value="all">All dates</option>
            </select>
          </label>
        )}
      </div>
      <p className="results-count" role="status">
        {notes.length} {notes.length === 1 ? "note" : "notes"}
        {query ? " found" : ""}
      </p>
      {notes.length ? (
        <ul>
          {notes.map((note) => (
            <li key={note.id}>
              <button
                className={"list-note" + (selectedDate === note.date ? " is-selected" : "")}
                type="button"
                aria-pressed={selectedDate === note.date}
                onClick={() => onSelect(note.date)}
              >
                <span className="list-date">
                  <strong>{parseDate(note.date).getDate()}</strong>
                  <span>{parseDate(note.date).toLocaleDateString("en", { month: "short" })}</span>
                </span>
                <span className="list-note-content">
                  <time dateTime={note.date}>{formatDay(note.date)}</time>
                  <span>{note.comment || "Untitled note"}</span>
                </span>
                <FiArrowUpRight aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="list-empty">
          {query ? <FiSearch aria-hidden="true" /> : <FiFeather aria-hidden="true" />}
          <h3>{query ? "No matching notes." : "A fresh page ahead."}</h3>
          <p>
            {query
              ? "Try another word or date, or clear your search."
              : "Add a note from the calendar, or choose All dates to see older notes."}
          </p>
        </div>
      )}
    </section>
  );
}
