import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { Button } from "react-bootstrap";
import { useEffect, useRef } from "react";
import { FiEdit3, FiPlus, FiTrash2, FiFeather, FiClock } from "react-icons/fi";
import { formatDay } from "../utils/calendarDates";
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
  const { t, locale } = useLanguage();

  const content = useRef(null);
  useEffect(() => {
    if (!content.current) return;
    content.current.scrollTop = 0;
    if (selectedNoteId != null)
      content.current
        .querySelector('[data-note-id="' + selectedNoteId + '"]')
        ?.scrollIntoView?.({ block: "nearest" });
  }, [date, selectedNoteId]);
  return (
    <div className="day-details" ref={content}>
      <h2 className="visually-hidden">{formatDay(date, locale)}</h2>
      {!ready ? (
        <p className="detail-muted">{t("Your notes will appear here once loaded.")}</p>
      ) : notes.length ? (
        <>
          <div className="day-notes-heading">
            <h3>{t("notes.count", { count: notes.length })}</h3>
            <Button className="theme-button-outline" variant="outline-secondary" onClick={onAdd}>
              <FiPlus aria-hidden="true" />
              {t("Add a note")}
            </Button>
          </div>
          <ol className="day-notes">
            {notes.map((note) => (
              <li key={note.id}>
                <article
                  className={"note-paper" + (note.id === selectedNoteId ? " is-highlighted" : "")}
                  data-note-id={note.id}
                  aria-label={noteTime(note, locale) + " — " + (note.comment || t("Untitled note"))}
                >
                  <div className="note-paper-time">
                    <FiClock aria-hidden="true" />
                    <time dateTime={note.date + (note.time ? "T" + note.time : "")}>
                      {noteTime(note, locale)}
                    </time>
                  </div>
                  <p>{note.comment || t("No text added yet.")}</p>
                  <div className="detail-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={t("Edit note")}
                      title={t("Edit note")}
                      onClick={() => onEdit(note)}
                    >
                      <FiEdit3 aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-button delete-note-button"
                      aria-label={t("Delete")}
                      title={t("Delete")}
                      onClick={() => onDelete(note)}
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
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
          <h3>{t("No notes for this day.")}</h3>
          <Button className="theme-button" onClick={onAdd}>
            <FiPlus aria-hidden="true" />
            {t("Add a note")}
          </Button>
        </div>
      )}
    </div>
  );
}
