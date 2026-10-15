import { useEffect, useRef, useState } from "react";
import { FiCheck, FiCheckCircle, FiGrid, FiMaximize2, FiPlus, FiSettings } from "react-icons/fi";
import { formatDay } from "../../calendar/utils/calendarDates";
import { intakeKey, matrixForDay } from "../utils/schedule";
import TimeSymbol from "./TimeSymbol";
import "../styles/Medications.css";

export default function MedicationMatrix({
  tracker,
  date,
  onConfigure,
  onExpand,
  expanded = false,
}) {
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
  function celebrate(slot) {
    window.clearTimeout(timer.current);
    setCelebration({ id: slot.id, key: Date.now() });
    setAnnouncement("All scheduled items for " + slot.time + " are marked as taken.");
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
          row.name + " at " + slot.time + (taken ? " marked as taken." : " unchecked."),
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
        setAnnouncement("The " + slot.time + " column was unchecked.");
      }
    } catch {
      /* No optimistic marks are shown for a failed request. */
    }
  }
  return (
    <section
      className={"medication-tracker" + (expanded ? " is-expanded" : "")}
      aria-label="Medication tracker"
      aria-busy={busy}
    >
      <div className="medication-heading">
        <div>
          <h3>
            <FiGrid aria-hidden="true" />
            Medication tracker
          </h3>
          <span className="experimental-badge">Experimental</span>
        </div>
        <div className="medication-heading-actions">
          {!expanded && (
            <button
              className="icon-button"
              type="button"
              aria-label="Expand medication tracker"
              onClick={onExpand}
            >
              <FiMaximize2 aria-hidden="true" />
            </button>
          )}
          <button
            className="icon-button"
            type="button"
            aria-label="Manage medication schedule"
            onClick={() => onConfigure({ section: "medications" })}
          >
            <FiSettings aria-hidden="true" />
          </button>
        </div>
      </div>
      {error && (
        <div className="medication-error" role="alert">
          <p>{error}</p>
          <button
            className="theme-button-outline"
            type="button"
            disabled={pending}
            onClick={reload}
          >
            Reload tracker
          </button>
        </div>
      )}
      {loading ? (
        <p role="status" aria-label="Medication tracker loading" className="medication-empty">
          Loading your medication tracker…
        </p>
      ) : !plan.rows.length && !rows.length ? (
        <div className="medication-empty">
          <p>Add intake times and medications to build your table.</p>
          <button
            className="theme-button-outline"
            type="button"
            onClick={() =>
              onConfigure({ section: plan.slots.length ? "medications" : "times", create: true })
            }
          >
            Set up tracker
          </button>
        </div>
      ) : (
        <>
          <div
            className="medication-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scroll medication table"
          >
            <table className="medication-table">
              <caption className="visually-hidden">
                Medication intake for {formatDay(date)}. Select a cell to mark or undo an intake;
                select a column heading to mark or undo all scheduled items in that column.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="medication-name-column">
                    Medication
                  </th>
                  {slots.map((slot) => {
                    const due = rows.filter((row) => scheduled(row, slot));
                    const done = due.filter((row) => marks.has(intakeKey(row.id, slot.id))).length;
                    const complete = due.length > 0 && done === due.length;
                    const active = celebration?.id === slot.id;
                    return (
                      <th
                        scope="col"
                        key={slot.id}
                        className={active ? "medication-column-celebrating" : ""}
                      >
                        <button
                          type="button"
                          className={"medication-column-button" + (complete ? " is-complete" : "")}
                          disabled={busy || !due.length}
                          aria-pressed={complete}
                          aria-label={
                            (complete ? "Uncheck" : "Mark all") +
                            " scheduled medications at " +
                            slot.time +
                            (slot.label ? " — " + slot.label : "")
                          }
                          onClick={() => toggleColumn(slot, complete)}
                          title={
                            complete ? "Uncheck the whole column" : "Mark the whole column as taken"
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
                          {slot.label && (
                            <span className="medication-slot-label">{slot.label}</span>
                          )}
                          <span className="medication-column-progress">
                            {slot.historical ? (
                              "Archived"
                            ) : complete ? (
                              <>
                                <FiCheckCircle aria-hidden="true" />
                                Taken
                              </>
                            ) : (
                              done + "/" + due.length
                            )}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="medication-add-column">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Add intake time"
                      disabled={busy}
                      onClick={() => onConfigure({ section: "times", create: true })}
                    >
                      <FiPlus aria-hidden="true" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {!rows.length && (
                  <tr>
                    <td colSpan={slots.length + 2} className="medication-empty-day">
                      No medications are scheduled for this day.
                    </td>
                  </tr>
                )}
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <th scope="row" className="medication-name-column">
                      <span>{row.name}</span>
                      {row.detail && <small>{row.detail}</small>}
                      {row.historical && <small>Archived schedule</small>}
                    </th>
                    {slots.map((slot) => {
                      const record = marks.get(intakeKey(row.id, slot.id));
                      const allowed = scheduled(row, slot);
                      const active = celebration?.id === slot.id;
                      return (
                        <td
                          key={slot.id}
                          className={active ? "medication-column-celebrating" : ""}
                          style={{ "--dose-delay": Math.min(index * 60, 600) + "ms" }}
                        >
                          {allowed || record ? (
                            <button
                              type="button"
                              className={"medication-dose" + (record ? " is-taken" : "")}
                              disabled={busy}
                              aria-pressed={!!record}
                              aria-label={
                                row.name +
                                " at " +
                                slot.time +
                                (slot.label ? " — " + slot.label : "") +
                                (record ? ", taken — undo" : ", mark as taken")
                              }
                              title={
                                record
                                  ? "Marked " + new Date(record.takenAt).toLocaleString()
                                  : "Mark as taken"
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
                            <span className="medication-unscheduled" aria-label="Not scheduled">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td aria-hidden="true" />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={slots.length + 2}>
                    <button
                      type="button"
                      className="medication-add-row"
                      disabled={busy}
                      onClick={() =>
                        onConfigure({
                          section: plan.slots.length ? "medications" : "times",
                          create: true,
                        })
                      }
                    >
                      <FiPlus aria-hidden="true" />
                      Add medication
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="medication-table-help">
            Times follow your device's local clock. Unscheduled cells stay empty.
          </p>
        </>
      )}
      <span role="status" aria-label="Medication update" className="visually-hidden">
        {announcement}
      </span>
    </section>
  );
}
