import { useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
export default function NoteEditor({
  date: initialDate,
  note,
  onCreate,
  onUpdate,
  onSaved,
  onClose,
}) {
  const [date, setDate] = useState(initialDate);
  const [comment, setComment] = useState(note?.comment || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await (note ? onUpdate(date, comment.trim()) : onCreate(date, comment.trim()));
      onSaved(date);
    } catch (error) {
      setError(error.message);
      setPending(false);
    }
  }
  return (
    <Modal
      show
      restoreFocus={false}
      onHide={pending ? undefined : onClose}
      centered
      aria-labelledby="note-editor-title"
      className="planner-modal"
    >
      <Modal.Header closeButton={!pending}>
        <Modal.Title id="note-editor-title">
          {note ? "Edit your note" : "A note for your day"}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={submit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}
          <Form.Group controlId="note-date" className="mb-4">
            <Form.Label>Date</Form.Label>
            <Form.Control
              type="date"
              required
              value={date}
              disabled={!!note || pending}
              onChange={(event) => setDate(event.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="note-text">
            <Form.Label>Your note</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              autoFocus
              maxLength={255}
              disabled={pending}
              value={comment}
              aria-describedby="note-length"
              placeholder="What would you like to remember?"
              onChange={(event) => setComment(event.target.value)}
            />
            <p className="note-length" id="note-length">
              {comment.length} / 255 characters · One note per day
            </p>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            className="theme-button-outline"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" className="theme-button" disabled={pending}>
            {pending ? "Saving…" : "Save note"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
