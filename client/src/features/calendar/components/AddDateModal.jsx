import { useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import colors from "../../../shared/config/colors";

export default function AddDateModal({ open, onClose, onCreate }) {
  const [date, setDate] = useState("");
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await onCreate(date, comment);
      setDate("");
      setComment("");
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal show={open} onHide={pending ? undefined : onClose} centered>
      <div style={{ background: colors.BgColorDark, color: colors.TextColorDark }}>
        <Modal.Header closeButton={!pending}>
          <Modal.Title>Add date</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}
          <Form onSubmit={handleSubmit}>
            <Form.Group controlId="note-date" className="mb-3">
              <Form.Label>Date</Form.Label>
              <Form.Control
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="note-comment" className="mb-3">
              <Form.Label>Comment</Form.Label>
              <Form.Control
                type="text"
                maxLength={255}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </Form.Group>
            <Button type="submit" disabled={pending} style={{ background: colors.BtnColorDark }}>
              {pending ? "Saving..." : "Submit"}
            </Button>
          </Form>
        </Modal.Body>
      </div>
    </Modal>
  );
}
