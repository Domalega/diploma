import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { useEffect, useId, useRef, useState } from "react";
import { FiCheck, FiCheckCircle, FiGrid, FiMaximize2, FiSettings } from "react-icons/fi";
import { formatDay } from "../../calendar/utils/calendarDates";
import { intakeKey, matrixForDay } from "../utils/schedule";
import useMatrixOrientation from "../hooks/useMatrixOrientation";
import TimeSymbol from "./TimeSymbol";
import MatrixAddControl from "./MatrixAddControl";
import "../styles/Medications.css";

export default function MedicationMatrix({
  tracker,
  date,
  onConfigure,
  onExpand,
  expanded = false,
  standalone = false,
}) {
  const { t, locale } = useLanguage();
  const helpId = useId();
  const [matrixRef, verticalSpace] = useMatrixOrientation(
    tracker?.plan.enabled,
    standalone,
    expanded,
  );

  const [celebration, setCelebration] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const timer = useRef(null);
  const context = date + ":" + tracker?.plan.enabled + ":" + tracker?.plan.revision;
  const latestContext = useRef(context);
  latestContext.current = context;
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    setCelebration(null);
    setAnnouncement("");
    window.clearTimeout(timer.current);
  }, [date, tracker?.plan.enabled, tracker?.plan.revision]);
  if (!tracker?.plan.enabled) return null;
  const { plan, records, loading, pending, error, mark, reload } = tracker;
  const { rows, slots, marks, scheduled } = matrixForDay(plan, records, date);
  const busy = loading || pending;
  const vertical = verticalSpace && rows.length > 0 && slots.length > 0;
  function celebrate(slot) {
    window.clearTimeout(timer.current);
    setCelebration({ id: slot.id, key: Date.now() });
    setAnnouncement(t("All scheduled items for {time} are marked as taken.", { time: slot.time }));
    timer.current = window.setTimeout(() => setCelebration(null), 2400);
  }
  async function toggle(row, slot) {
    const startedIn = context;
    const taken = !marks.has(intakeKey(row.id, slot.id));
    const column = rows.filter((item) => scheduled(item, slot));
    const completes =
      taken && column.every((item) => item.id === row.id || marks.has(intakeKey(item.id, slot.id)));
    try {
      await mark({ date, medicationId: row.id, slotId: slot.id, taken });
      if (latestContext.current !== startedIn) return;
      if (!taken) {
        window.clearTimeout(timer.current);
        setCelebration(null);
      }
      if (completes && column.length) celebrate(slot);
      else
        setAnnouncement(
          t(taken ? "{name} at {time} marked as taken." : "{name} at {time} unchecked.", {
            name: row.name,
            time: slot.time,
          }),
        );
    } catch {
      /* The tracker displays the error and preserves the previous marks. */
    }
  }
  async function toggleColumn(slot, complete) {
    const startedIn = context;
    try {
      await mark({ date, slotId: slot.id, taken: !complete }, true);
      if (latestContext.current !== startedIn) return;
      if (!complete) celebrate(slot);
      else {
        window.clearTimeout(timer.current);
        setCelebration(null);
        setAnnouncement(t("Intakes at {time} were unchecked.", { time: slot.time }));
      }
    } catch {
      /* No optimistic marks are shown for a failed request. */
    }
  }
  function timeHeading(slot) {
    const due = rows.filter((row) => scheduled(row, slot));
    const done = due.filter((row) => marks.has(intakeKey(row.id, slot.id))).length;
    const complete = due.length > 0 && done === due.length;
    const active = celebration?.id === slot.id;
    return (
      <th
        scope={vertical ? "row" : "col"}
        key={slot.id}
        className={
          (vertical ? "medication-time-column " : "") +
          (active ? "medication-column-celebrating" : "")
        }
      >
        <button
          type="button"
          className={"medication-column-button" + (complete ? " is-complete" : "")}
          disabled={busy || !due.length}
          aria-pressed={complete}
          aria-label={t(
            complete
              ? "Uncheck scheduled medications at {time}{label}"
              : "Mark all scheduled medications at {time}{label}",
            { time: slot.time, label: slot.label ? " — " + slot.label : "" },
          )}
          onClick={() => toggleColumn(slot, complete)}
          title={
            complete
              ? t("Uncheck all intakes at this time")
              : t("Mark all intakes at this time as taken")
          }
        >
          <span className="medication-time-symbol">
            <TimeSymbol time={slot.time} />
            {active && (
              <span
                key={celebration.key}
                className="medication-completion-burst"
                data-testid="medication-column-completion"
                aria-hidden="true"
              >
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
            )}
          </span>
          <time dateTime={date + "T" + slot.time}>{slot.time}</time>
          {slot.label && <span className="medication-slot-label">{slot.label}</span>}
          <span className="medication-column-progress">
            {slot.historical ? (
              t("Archived")
            ) : complete ? (
              <>
                <FiCheckCircle aria-hidden="true" />
                {t("Taken")}
              </>
            ) : (
              done + "/" + due.length
            )}
          </span>
        </button>
      </th>
    );
  }
  function medicationLabel(row) {
    return (
      <>
        <span>{row.name}</span>
        {row.detail && <small>{row.detail}</small>}
        {row.historical && <small>{t("Archived schedule")}</small>}
      </>
    );
  }
  function doseCell(row, slot, index) {
    const record = marks.get(intakeKey(row.id, slot.id));
    const allowed = scheduled(row, slot);
    const active = celebration?.id === slot.id;
    return (
      <td
        key={row.id + ":" + slot.id}
        className={active ? "medication-column-celebrating" : ""}
        style={{ "--dose-delay": Math.min(index * 60, 600) + "ms" }}
      >
        {allowed || record ? (
          <button
            type="button"
            className={"medication-dose" + (record ? " is-taken" : "")}
            disabled={busy}
            aria-pressed={!!record}
            aria-label={t(
              record
                ? "{name} at {time}{label}, taken — undo"
                : "{name} at {time}{label}, mark as taken",
              {
                name: row.name,
                time: slot.time,
                label: slot.label ? " — " + slot.label : "",
              },
            )}
            title={
              record
                ? t("Marked {date}", {
                    date: new Date(record.takenAt).toLocaleString(locale),
                  })
                : t("Mark as taken")
            }
            onClick={() => toggle(row, slot)}
          >
            <span>
              {record ? (
                <FiCheck aria-hidden="true" />
              ) : (
                <span className="medication-dose-dot" aria-hidden="true" />
              )}
            </span>
          </button>
        ) : (
          <span className="medication-unscheduled" aria-label={t("Not scheduled")}>
            —
          </span>
        )}
      </td>
    );
  }
  return (
    <section
      ref={matrixRef}
      className={
        "medication-tracker" +
        (expanded ? " is-expanded" : "") +
        (standalone ? " is-standalone" : "")
      }
      aria-label={standalone ? t("Medication intakes") : t("Medication tracker")}
      aria-busy={busy}
    >
      {!standalone && (
        <div className="medication-heading">
          <div>
            <h3>
              <FiGrid aria-hidden="true" />
              {t("Medication tracker")}
            </h3>
            <span className="experimental-badge">{t("Experimental")}</span>
          </div>
          <div className="medication-heading-actions">
            {!expanded && (
              <button
                className="icon-button"
                type="button"
                aria-label={t("Expand medication tracker")}
                onClick={onExpand}
              >
                <FiMaximize2 aria-hidden="true" />
              </button>
            )}
            <button
              className="icon-button"
              type="button"
              aria-label={t("Manage medication schedule")}
              onClick={() => onConfigure({ section: "medications" })}
            >
              <FiSettings aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="medication-error" role="alert">
          <p>{t(error)}</p>
          <button
            className="theme-button-outline"
            type="button"
            disabled={pending}
            onClick={reload}
          >
            {t("Reload tracker")}
          </button>
        </div>
      )}
      {loading ? (
        <p role="status" aria-label={t("Medication tracker loading")} className="medication-empty">
          {t("Loading your medication tracker…")}
        </p>
      ) : !plan.rows.length && !rows.length ? (
        <div className="medication-empty">
          <p>{t("Add intake times and medications to build your table.")}</p>
          <button
            className="theme-button-outline"
            type="button"
            onClick={() =>
              onConfigure({ section: plan.slots.length ? "medications" : "times", create: true })
            }
          >
            {t("Set up tracker")}
          </button>
        </div>
      ) : (
        <div className="medication-table-frame" key={date}>
          <div
            className="medication-table-scroll"
            tabIndex={0}
            role="region"
            aria-label={t("Scroll medication table")}
          >
            <table
              className={"medication-table" + (vertical ? " is-transposed" : "")}
              aria-describedby={helpId}
            >
              <caption className="visually-hidden">
                {t(
                  "Medication intake for {date}. Select a cell to mark or undo an intake; select a time heading to mark or undo all scheduled items at that time.",
                  { date: formatDay(date, locale) },
                )}
              </caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className={vertical ? "medication-time-column" : "medication-name-column"}
                  >
                    {t(vertical ? "Intake time" : "Medication")}
                  </th>
                  {vertical
                    ? rows.map((row) => (
                        <th scope="col" key={row.id} className="medication-transposed-name">
                          {medicationLabel(row)}
                        </th>
                      ))
                    : slots.map(timeHeading)}
                </tr>
              </thead>
              <tbody>
                {!rows.length && (
                  <tr>
                    <td colSpan={slots.length + 1} className="medication-empty-day">
                      {t("No medications are scheduled for this day.")}
                    </td>
                  </tr>
                )}
                {vertical
                  ? slots.map((slot) => (
                      <tr key={slot.id}>
                        {timeHeading(slot)}
                        {rows.map((row, index) => doseCell(row, slot, index))}
                      </tr>
                    ))
                  : rows.map((row, index) => (
                      <tr key={row.id}>
                        <th scope="row" className="medication-name-column">
                          {medicationLabel(row)}
                        </th>
                        {slots.map((slot) => doseCell(row, slot, index))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <MatrixAddControl
            axis={vertical ? "row" : "column"}
            label={t("Add intake time")}
            disabled={busy}
            onAdd={() => onConfigure({ section: "times", create: true })}
          />
          <MatrixAddControl
            axis={vertical ? "column" : "row"}
            label={t("Add medication")}
            disabled={busy}
            onAdd={() =>
              onConfigure({ section: plan.slots.length ? "medications" : "times", create: true })
            }
          />
          <p id={helpId} className="visually-hidden">
            {t("Times follow your device's local clock. Unscheduled cells stay empty.")}
          </p>
        </div>
      )}
      <span role="status" aria-label={t("Medication update")} className="visually-hidden">
        {announcement}
      </span>
    </section>
  );
}
