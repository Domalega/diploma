import { useState } from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import { formatDay } from "../utils/calendarDates";
export default function DeleteNoteDialog({ note, onDelete, onDeleted, onClose }) {
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
      <Modal.Header closeButton={!pending}>
        <Modal.Title id="delete-title">Delete this note?</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p id="delete-description">
          Only this note for {formatDay(note.date)}
          {note.time ? " at " + note.time : ""} will be permanently deleted.
        </p>
        <p className="delete-note-preview">{note.comment || "Untitled note"}</p>
        {error && (
          <Alert variant="danger" role="alert">
            {error}
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
          Keep note
        </Button>
        <Button className="danger-button" disabled={pending} onClick={remove}>
          {pending ? "Deleting…" : "Delete note"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
