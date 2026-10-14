import { Button } from "react-bootstrap";
import { FiEdit3, FiPlus, FiTrash2, FiFeather } from "react-icons/fi";
import { formatDay, parseDate, todayKey } from "../utils/calendarDates";
export default function NoteDetails({ date, note, onEdit, onDelete, ready }) {
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
      ) : note ? (
        <>
          <div className="note-paper">
            <FiFeather aria-hidden="true" />
            <h3>Your note</h3>
            <p>{note.comment || "No text added yet."}</p>
          </div>
          <div className="detail-actions">
            <Button className="theme-button" onClick={onEdit}>
              <FiEdit3 aria-hidden="true" />
              Edit note
            </Button>
            <Button
              variant="outline-secondary"
              className="theme-button-outline delete-note-button"
              onClick={onDelete}
            >
              <FiTrash2 aria-hidden="true" />
              Delete
            </Button>
          </div>
        </>
      ) : (
        <div className="empty-day">
          <span className="empty-day-icon">
            <FiFeather aria-hidden="true" />
          </span>
          <h3>No note for this day.</h3>
          <Button className="theme-button" onClick={onEdit}>
            <FiPlus aria-hidden="true" />
            Add a note
          </Button>
        </div>
      )}
    </div>
  );
}
