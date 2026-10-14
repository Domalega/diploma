import { Button } from "react-bootstrap";
import { FiEdit3, FiPlus, FiTrash2, FiFeather, FiClock } from "react-icons/fi";
import { formatDay, parseDate, todayKey } from "../utils/calendarDates";
import { noteTime } from "../utils/noteTimes";
export default function NoteDetails({
  date,
  notes,
  selectedNoteId,
  onAdd,
  onEdit,
  onDelete,
  ready,
}) {
  const day = parseDate(date);
  return (
    <div className="day-details">
      <span className="planner-eyebrow">{date === todayKey() ? "TODAY" : "SELECTED DAY"}</span>
      <div className="detail-date">
        <span>{day.getDate()}</span>
        <div>
          <strong>{day.toLocaleDateString("en", { weekday: "long" })}</strong>
          <time dateTime={date}>
            {day.toLocaleDateString("en", { month: "long", year: "numeric" })}
          </time>
        </div>
      </div>
      <h2 className="visually-hidden">{formatDay(date)}</h2>
      {!ready ? (
        <p className="detail-muted">Your notes will appear here once loaded.</p>
      ) : notes.length ? (
        <>
          <div className="day-notes-heading">
            <h3>
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </h3>
            <Button className="theme-button-outline" variant="outline-secondary" onClick={onAdd}>
              <FiPlus aria-hidden="true" />
              Add a note
            </Button>
          </div>
          <ol className="day-notes">
            {notes.map((note) => (
              <li key={note.id}>
                <article
                  className={"note-paper" + (note.id === selectedNoteId ? " is-highlighted" : "")}
                  aria-label={noteTime(note) + " — " + (note.comment || "Untitled note")}
                >
                  <div className="note-paper-time">
                    <FiClock aria-hidden="true" />
                    <time dateTime={note.date + (note.time ? "T" + note.time : "")}>
                      {noteTime(note)}
                    </time>
                  </div>
                  <p>{note.comment || "No text added yet."}</p>
                  <div className="detail-actions">
                    <Button
                      className="theme-button-outline"
                      variant="outline-secondary"
                      onClick={() => onEdit(note)}
                    >
                      <FiEdit3 aria-hidden="true" />
                      Edit note
                    </Button>
                    <Button
                      variant="outline-secondary"
                      className="theme-button-outline delete-note-button"
                      onClick={() => onDelete(note)}
                    >
                      <FiTrash2 aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="empty-day">
          <span className="empty-day-icon">
            <FiFeather aria-hidden="true" />
          </span>
          <h3>No notes for this day.</h3>
          <Button className="theme-button" onClick={onAdd}>
            <FiPlus aria-hidden="true" />
            Add a note
          </Button>
        </div>
      )}
    </div>
  );
}
