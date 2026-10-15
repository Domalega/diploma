import { useLanguage } from "../../../shared/i18n/LanguageProvider";
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
  const { t } = useLanguage();

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(note?.time || "");
  const [comment, setComment] = useState(note?.comment || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await (note
        ? onUpdate(note.id, { date, comment: comment.trim(), time: time || null })
        : onCreate(date, comment.trim(), time || null));
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
      <Modal.Header closeButton={!pending} closeLabel={t("Close")}>
        <Modal.Title id="note-editor-title">
          {note ? t("Edit your note") : t("A note for your day")}
        </Modal.Title>
      </Modal.Header>
      <Form onSubmit={submit}>
        <Modal.Body>
          {error && (
            <Alert variant="danger" role="alert">
              {t(error)}
            </Alert>
          )}
          <Form.Group controlId="note-date" className="mb-4">
            <Form.Label>{t("Date")}</Form.Label>
            <Form.Control
              type="date"
              required
              value={date}
              disabled={pending}
              onInput={(event) => setDate(event.currentTarget.value)}
              onChange={(event) => setDate(event.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="note-time" className="mb-4">
            <Form.Label>
              {t("Time") + " "}
              <span className="detail-muted">{t("(optional)")}</span>
            </Form.Label>
            <div className="note-time-control">
              <Form.Control
                type="time"
                step={60}
                value={time}
                disabled={pending}
                onInput={(event) => setTime(event.currentTarget.value)}
                onChange={(event) => setTime(event.target.value)}
                aria-describedby="note-time-help"
              />
              {time && (
                <Button
                  className="theme-button-outline"
                  variant="outline-secondary"
                  disabled={pending}
                  onClick={() => setTime("")}
                >
                  {t("Clear time")}
                </Button>
              )}
            </div>
            <Form.Text id="note-time-help">
              {t("Leave empty for an all-day note. Times use your device's local clock.")}
            </Form.Text>
          </Form.Group>
          <Form.Group controlId="note-text">
            <Form.Label>{t("Your note")}</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              autoFocus
              maxLength={255}
              disabled={pending}
              value={comment}
              aria-describedby="note-length"
              placeholder={t("What would you like to remember?")}
              onChange={(event) => setComment(event.target.value)}
            />
            <p className="note-length" id="note-length">
              {t("{count} / 255 characters", { count: comment.length })}
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
            {t("Cancel")}
          </Button>
          <Button type="submit" className="theme-button" disabled={pending}>
            {pending ? t("Saving…") : t("Save note")}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
