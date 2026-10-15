import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { useState } from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import { formatDay } from "../utils/calendarDates";
export default function DeleteNoteDialog({ note, onDelete, onDeleted, onClose }) {
  const { t, locale } = useLanguage();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await onDelete(note.id);
      onDeleted();
    } catch (error) {
      setError(error.message);
      setPending(false);
    }
  }
  return (
    <Modal
      show
      restoreFocus={false}
      centered
      onHide={pending ? undefined : onClose}
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      className="planner-modal"
    >
      <Modal.Header closeButton={!pending} closeLabel={t("Close")}>
        <Modal.Title id="delete-title">{t("Delete this note?")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p id="delete-description">
          {t("Only this note for {date}{time} will be permanently deleted.", {
            date: formatDay(note.date, locale),
            time: note.time ? t(" at {time}", { time: note.time }) : "",
          })}
        </p>
        <p className="delete-note-preview">{note.comment || t("Untitled note")}</p>
        {error && (
          <Alert variant="danger" role="alert">
            {t(error)}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          autoFocus
          variant="outline-secondary"
          className="theme-button-outline"
          disabled={pending}
          onClick={onClose}
        >
          {t("Keep note")}
        </Button>
        <Button className="danger-button" disabled={pending} onClick={remove}>
          {pending ? t("Deleting…") : t("Delete note")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
