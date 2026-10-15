import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { weekdayLabel } from "../../../shared/i18n/formatters";
import { useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { FiEdit3, FiPlus, FiTrash2 } from "react-icons/fi";
import { todayKey } from "../../calendar/utils/calendarDates";
import { EVERY_DAY, WEEKDAYS, repeatLabel } from "../utils/schedule";
import TimeSymbol from "./TimeSymbol";
import "../styles/Medications.css";

const newSlot = () => ({ id: crypto.randomUUID(), time: "", label: "" });
const newRow = (slots) => ({
  id: crypto.randomUUID(),
  name: "",
  detail: "",
  slotIds: slots.map((slot) => slot.id),
  weekdays: [...EVERY_DAY],
  startDate: todayKey(),
  endDate: null,
});

export default function MedicationManager({ tracker, intent = {}, onClose }) {
  const { t, locale } = useLanguage();

  const { plan, pending, loading, savePlan, reload } = tracker;
  const [section, setSection] = useState(intent.section || "medications");
  const [draftSlot, setDraftSlot] = useState(() =>
    intent.create && intent.section === "times" ? newSlot() : null,
  );
  const [draftRow, setDraftRow] = useState(() =>
    intent.create && intent.section !== "times" && plan.slots.length ? newRow(plan.slots) : null,
  );
  const [removing, setRemoving] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const busy = pending || loading;
  async function save(changes, success) {
    setError("");
    setMessage("");
    try {
      await savePlan(changes);
      setDraftSlot(null);
      setDraftRow(null);
      setRemoving(null);
      setMessage(success);
    } catch (error) {
      setError(error.message);
    }
  }
  async function submitSlot(event) {
    event.preventDefault();
    const exists = plan.slots.some((slot) => slot.id === draftSlot.id);
    const slot = { ...draftSlot, label: draftSlot.label.trim() };
    await save(
      {
        slots: exists
          ? plan.slots.map((item) => (item.id === slot.id ? slot : item))
          : [...plan.slots, slot],
      },
      t("Intake time saved."),
    );
  }
  async function submitRow(event) {
    event.preventDefault();
    if (!draftRow.weekdays.length || !draftRow.slotIds.length) {
      setError("Choose at least one weekday and intake time.");
      return;
    }
    const exists = plan.rows.some((row) => row.id === draftRow.id);
    const row = {
      ...draftRow,
      name: draftRow.name.trim(),
      detail: draftRow.detail.trim(),
      endDate: draftRow.endDate || null,
    };
    await save(
      {
        rows: exists
          ? plan.rows.map((item) => (item.id === row.id ? row : item))
          : [...plan.rows, row],
      },
      t("Medication schedule saved."),
    );
  }
  function remove() {
    if (removing.kind === "medication")
      return save(
        { rows: plan.rows.filter((row) => row.id !== removing.id) },
        t("Medication removed from the schedule. Previous marks were kept."),
      );
    const affected = plan.rows.filter(
      (row) => row.slotIds.includes(removing.id) && row.slotIds.length === 1,
    );
    if (affected.length) {
      setError(
        t(
          "This is the only intake time for {names}. Edit those medications to choose another time first.",
          { names: affected.map((row) => row.name).join(", ") },
        ),
      );
      setRemoving(null);
      return;
    }
    return save(
      {
        slots: plan.slots.filter((slot) => slot.id !== removing.id),
        rows: plan.rows.map((row) => ({
          ...row,
          slotIds: row.slotIds.filter((id) => id !== removing.id),
        })),
      },
      t("Intake time removed. Previous marks were kept."),
    );
  }
  function editSection(value) {
    setSection(value);
    setDraftRow(null);
    setDraftSlot(null);
    setRemoving(null);
    setError("");
    setMessage("");
  }
  const rowExists = draftRow && plan.rows.some((row) => row.id === draftRow.id);
  const slotExists = draftSlot && plan.slots.some((slot) => slot.id === draftSlot.id);
  const editSlot = (field, value) => setDraftSlot((slot) => ({ ...slot, [field]: value }));
  const editRow = (field, value) => setDraftRow((row) => ({ ...row, [field]: value }));
  return (
    <Modal
      show
      size="lg"
      fullscreen="sm-down"
      centered
      restoreFocus={false}
      onHide={busy ? undefined : onClose}
      aria-labelledby="medication-manager-title"
      className="planner-modal medication-manager"
    >
      <Modal.Header closeButton={!busy} closeLabel={t("Close")}>
        <Modal.Title id="medication-manager-title">{t("Medication schedule")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="medication-manager-tabs" role="group" aria-label={t("Schedule section")}>
          <button
            type="button"
            disabled={busy}
            aria-pressed={section === "times"}
            onClick={() => editSection("times")}
          >
            {t("Intake times")}
          </button>
          <button
            type="button"
            disabled={busy}
            aria-pressed={section === "medications"}
            onClick={() => editSection("medications")}
          >
            {t("Medications")}
          </button>
        </div>
        {error && (
          <Alert variant="danger" role="alert">
            {t(error)}
            <Button
              variant="outline-secondary"
              className="theme-button-outline ms-2"
              disabled={busy}
              onClick={() => {
                setError("");
                reload();
              }}
            >
              {t("Reload schedule")}
            </Button>
          </Alert>
        )}
        <p
          className="medication-manager-status"
          role="status"
          aria-label={t("Medication schedule update")}
        >
          {t(message)}
        </p>
        {removing && (
          <div className="medication-remove-confirm">
            <p>
              {t("Remove") + " "}
              <strong>{removing.name}</strong>
              {" " + t("from the schedule? Previous intake marks will remain.")}
            </p>
            <Button
              variant="outline-secondary"
              className="theme-button-outline"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              {t("Keep")}
            </Button>
            <Button className="danger-button ms-2" disabled={busy} onClick={remove}>
              {t("Remove from schedule")}
            </Button>
          </div>
        )}
        {section === "times" ? (
          <>
            <p className="medication-manager-help">
              {t("Each time becomes a column. The symbol follows its time of day.")}
            </p>
            <ul className="medication-config-list">
              {[...plan.slots]
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((slot) => (
                  <li key={slot.id}>
                    <span className="medication-config-time">
                      <TimeSymbol time={slot.time} />
                      <strong>{slot.time}</strong>
                      <span>{slot.label}</span>
                    </span>
                    <div>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t("Edit intake time {time}", { time: slot.time })}
                        disabled={busy}
                        onClick={() => {
                          setDraftSlot({ ...slot });
                          setRemoving(null);
                          setError("");
                        }}
                      >
                        <FiEdit3 aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t("Remove intake time {time}", { time: slot.time })}
                        disabled={busy}
                        onClick={() => {
                          setRemoving({
                            kind: "time",
                            id: slot.id,
                            name: slot.time + (slot.label ? " — " + slot.label : ""),
                          });
                          setDraftSlot(null);
                        }}
                      >
                        <FiTrash2 aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
            {!draftSlot && (
              <Button
                variant="outline-secondary"
                className="theme-button-outline"
                disabled={busy || plan.slots.length >= 12}
                onClick={() => {
                  setDraftSlot(newSlot());
                  setRemoving(null);
                  setError("");
                }}
              >
                <FiPlus aria-hidden="true" />
                {t("Add intake time")}
              </Button>
            )}
            {draftSlot && (
              <Form className="medication-edit-form" onSubmit={submitSlot}>
                <h3>{slotExists ? t("Edit intake time") : t("New intake time")}</h3>
                <div className="medication-form-columns">
                  <Form.Group controlId="medication-slot-time">
                    <Form.Label>{t("Intake time")}</Form.Label>
                    <Form.Control
                      type="time"
                      step={60}
                      required
                      autoFocus
                      value={draftSlot.time}
                      disabled={busy}
                      onInput={(event) => editSlot("time", event.currentTarget.value)}
                      onChange={(event) =>
                        setDraftSlot((value) => ({ ...value, time: event.target.value }))
                      }
                    />
                  </Form.Group>
                  <Form.Group controlId="medication-slot-label">
                    <Form.Label>{t("Column label (optional)")}</Form.Label>
                    <Form.Control
                      value={draftSlot.label}
                      maxLength={40}
                      disabled={busy}
                      placeholder={t("Morning, evening…")}
                      onChange={(event) =>
                        setDraftSlot((value) => ({ ...value, label: event.target.value }))
                      }
                    />
                  </Form.Group>
                </div>
                <div className="medication-form-actions">
                  <Button
                    variant="outline-secondary"
                    className="theme-button-outline"
                    disabled={busy}
                    onClick={() => setDraftSlot(null)}
                  >
                    {t("Cancel editing")}
                  </Button>
                  <Button type="submit" className="theme-button" disabled={busy}>
                    {pending ? t("Saving…") : t("Save intake time")}
                  </Button>
                </div>
              </Form>
            )}
          </>
        ) : (
          <>
            <p className="medication-manager-help">
              {t(
                "Choose the days and intake times for each medication. Marks belong to the selected calendar day.",
              )}
            </p>
            {!plan.slots.length && (
              <div className="medication-empty">
                <p>{t("Add an intake time before adding a medication.")}</p>
                <Button
                  className="theme-button-outline"
                  variant="outline-secondary"
                  onClick={() => {
                    setSection("times");
                    setDraftSlot(newSlot());
                  }}
                >
                  {t("Add first intake time")}
                </Button>
              </div>
            )}
            <ul className="medication-config-list">
              {plan.rows.map((row) => (
                <li key={row.id}>
                  <span>
                    <strong>{row.name}</strong>
                    {row.detail && <small>{row.detail}</small>}
                    <small>
                      {repeatLabel(row, locale)} ·{" "}
                      {plan.slots
                        .filter((slot) => row.slotIds.includes(slot.id))
                        .map((slot) => slot.time)
                        .sort()
                        .join(", ")}
                    </small>
                  </span>
                  <div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={t("Edit medication {name}", { name: row.name })}
                      disabled={busy}
                      onClick={() => {
                        setDraftRow({
                          ...row,
                          weekdays: [...row.weekdays],
                          slotIds: [...row.slotIds],
                        });
                        setRemoving(null);
                        setError("");
                      }}
                    >
                      <FiEdit3 aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={t("Remove medication {name}", { name: row.name })}
                      disabled={busy}
                      onClick={() => {
                        setRemoving({ kind: "medication", id: row.id, name: row.name });
                        setDraftRow(null);
                      }}
                    >
                      <FiTrash2 aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {!draftRow && !!plan.slots.length && (
              <Button
                variant="outline-secondary"
                className="theme-button-outline"
                disabled={busy || plan.rows.length >= 40}
                onClick={() => {
                  setDraftRow(newRow(plan.slots));
                  setRemoving(null);
                  setError("");
                }}
              >
                <FiPlus aria-hidden="true" />
                {t("Add medication")}
              </Button>
            )}
            {draftRow && (
              <Form className="medication-edit-form" onSubmit={submitRow}>
                <h3>{rowExists ? t("Edit medication") : t("New medication")}</h3>
                <Form.Group controlId="medication-name" className="mb-3">
                  <Form.Label>{t("Medication name")}</Form.Label>
                  <Form.Control
                    autoFocus
                    required
                    maxLength={80}
                    value={draftRow.name}
                    disabled={busy}
                    onChange={(event) =>
                      setDraftRow((value) => ({ ...value, name: event.target.value }))
                    }
                  />
                </Form.Group>
                <Form.Group controlId="medication-detail" className="mb-3">
                  <Form.Label>{t("Note or label (optional)")}</Form.Label>
                  <Form.Control
                    maxLength={120}
                    value={draftRow.detail}
                    disabled={busy}
                    placeholder={t("Your own instructions")}
                    onChange={(event) =>
                      setDraftRow((value) => ({ ...value, detail: event.target.value }))
                    }
                  />
                </Form.Group>
                <fieldset className="medication-repeat">
                  <legend>{t("Repeat on")}</legend>
                  <div className="medication-weekdays">
                    {WEEKDAYS.map((day) => (
                      <button
                        type="button"
                        key={day.value}
                        aria-label={t(day.name)}
                        aria-pressed={draftRow.weekdays.includes(day.value)}
                        disabled={busy}
                        onClick={() =>
                          setDraftRow((value) => ({
                            ...value,
                            weekdays: value.weekdays.includes(day.value)
                              ? value.weekdays.filter((item) => item !== day.value)
                              : [...value.weekdays, day.value],
                          }))
                        }
                      >
                        {locale === "ru" ? weekdayLabel(day.value, locale) : day.short}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="medication-every-day"
                    disabled={busy}
                    onClick={() => setDraftRow((value) => ({ ...value, weekdays: [...EVERY_DAY] }))}
                  >
                    {t("Every day")}
                  </button>
                </fieldset>
                <fieldset className="medication-intake-options">
                  <legend>{t("Intake times")}</legend>
                  {plan.slots.map((slot) => (
                    <label key={slot.id}>
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={draftRow.slotIds.includes(slot.id)}
                        onChange={() =>
                          setDraftRow((value) => ({
                            ...value,
                            slotIds: value.slotIds.includes(slot.id)
                              ? value.slotIds.filter((id) => id !== slot.id)
                              : [...value.slotIds, slot.id],
                          }))
                        }
                      />
                      <TimeSymbol time={slot.time} />
                      <span>
                        {slot.time}
                        {slot.label ? " — " + slot.label : ""}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div className="medication-form-columns">
                  <Form.Group controlId="medication-course-start">
                    <Form.Label>{t("Start date")}</Form.Label>
                    <Form.Control
                      type="date"
                      required
                      value={draftRow.startDate}
                      disabled={busy}
                      onInput={(event) => editRow("startDate", event.currentTarget.value)}
                      onChange={(event) =>
                        setDraftRow((value) => ({ ...value, startDate: event.target.value }))
                      }
                    />
                  </Form.Group>
                  <Form.Group controlId="medication-course-end">
                    <Form.Label>{t("End date (optional)")}</Form.Label>
                    <Form.Control
                      type="date"
                      min={draftRow.startDate}
                      value={draftRow.endDate || ""}
                      disabled={busy}
                      onInput={(event) => editRow("endDate", event.currentTarget.value || null)}
                      onChange={(event) =>
                        setDraftRow((value) => ({ ...value, endDate: event.target.value || null }))
                      }
                    />
                  </Form.Group>
                </div>
                <div className="medication-form-actions">
                  <Button
                    variant="outline-secondary"
                    className="theme-button-outline"
                    disabled={busy}
                    onClick={() => setDraftRow(null)}
                  >
                    {t("Cancel editing")}
                  </Button>
                  <Button
                    type="submit"
                    className="theme-button"
                    disabled={busy || !draftRow.weekdays.length || !draftRow.slotIds.length}
                  >
                    {pending ? t("Saving…") : t("Save medication")}
                  </Button>
                </div>
              </Form>
            )}
          </>
        )}
        <p className="medication-manager-help medication-history-hint">
          {t("Changing or removing a schedule keeps previous intake marks.")}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="outline-secondary"
          className="theme-button-outline"
          disabled={busy}
          onClick={onClose}
        >
          {t("Done")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
