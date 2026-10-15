import { useEffect, useRef, useState } from "react";
import { Modal } from "react-bootstrap";
import {
  FiPlus,
  FiColumns,
  FiClock,
  FiCheck,
  FiMove,
  FiArrowUp,
  FiArrowDown,
  FiCalendar,
  FiRotateCcw,
} from "react-icons/fi";
import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { formatDay } from "../../calendar/utils/calendarDates";
import { columnName, orderedTasks } from "../utils/board";
import * as api from "../api/kanbanApi";
import "../styles/Kanban.css";

export default function KanbanTile({ tracker, selectedDate, onSelectDate }) {
  const { t, locale } = useLanguage();
  const { board, loading, pending, error, conflict, reload, send } = tracker;
  const [dialog, setDialog] = useState(null);
  const [history, setHistory] = useState(false);
  const [onlyDay, setOnlyDay] = useState(false);
  const [query, setQuery] = useState("");
  const [drag, setDrag] = useState(null);
  const [drop, setDrop] = useState(null);
  const [message, setMessage] = useState("");
  const dragRef = useRef(null);
  const columnsRef = useRef(null);
  const busy = loading || pending || conflict;
  async function update(command, close = false) {
    try {
      await send(command);
      setMessage(t("Board saved."));
      if (close) setDialog(null);
      return true;
    } catch {
      return false; /* The tracker keeps the draft and displays the server error. */
    }
  }
  async function move(taskId, columnId, beforeId = null) {
    if (busy || taskId === beforeId) return;
    await update({ type: "task.move", taskId, columnId, beforeId });
  }
  function endDrag(event) {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    setDrop(null);
    if (!current?.active || event.type === "pointercancel") return;
    const target = document
      .elementFromPoint?.(event.clientX, event.clientY)
      ?.closest("[data-kanban-column]");
    if (target) {
      const card = target.closest("[data-kanban-task]");
      if (card?.dataset.kanbanTask === current.id) return;
      let beforeId = card?.dataset.kanbanTask || null;
      if (
        card &&
        event.clientY > card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2
      ) {
        const tasks = orderedTasks(board.tasks, target.dataset.kanbanColumn).filter(
          (task) => task.id !== current.id,
        );
        beforeId = tasks[tasks.findIndex((task) => task.id === beforeId) + 1]?.id || null;
      }
      move(current.id, target.dataset.kanbanColumn, beforeId);
    }
  }
  useEffect(() => {
    const cancel = (event) => {
      if (event.key === "Escape") {
        dragRef.current = null;
        setDrag(null);
        setDrop(null);
      }
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  useEffect(() => {
    if (!drag) return;
    const timer = window.setInterval(() => {
      const area = columnsRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      area.scrollLeft += drag.x < rect.left + 36 ? -12 : drag.x > rect.right - 36 ? 12 : 0;
      const list = document
        .elementFromPoint?.(drag.x, drag.y)
        ?.closest(".kanban-column")
        ?.querySelector(".kanban-column-cards");
      if (list) {
        const bounds = list.getBoundingClientRect();
        list.scrollTop += drag.y < bounds.top + 36 ? -10 : drag.y > bounds.bottom - 36 ? 10 : 0;
      }
    }, 40);
    return () => window.clearInterval(timer);
  }, [drag]);
  const matching = board.tasks.filter(
    (task) =>
      (!onlyDay || task.date === selectedDate) &&
      (!history || task.completedAt) &&
      (task.title + " " + task.description)
        .toLocaleLowerCase(locale)
        .includes(query.toLocaleLowerCase(locale)),
  );
  const visible = board.columns.filter((column) => !column.hidden);
  function openTask(task = null, columnId = "todo") {
    setDialog({ kind: "task", task, columnId });
  }
  function card(task, column) {
    const inColumn = orderedTasks(board.tasks, task.columnId);
    const index = inColumn.findIndex((item) => item.id === task.id);
    return (
      <article
        key={task.id}
        className={
          "kanban-card" +
          (task.completedAt ? " is-completed" : "") +
          (drag?.id === task.id ? " is-dragging" : "")
        }
        data-kanban-task={task.id}
        data-kanban-column={task.columnId}
      >
        <div className="kanban-card-top">
          <button type="button" className="kanban-task-title" onClick={() => openTask(task)}>
            {task.title}
          </button>
          <button
            type="button"
            className="icon-button kanban-drag-handle"
            disabled={busy}
            aria-label={t("Drag task {title}", { title: task.title })}
            aria-describedby="kanban-move-help"
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                document.getElementById("move-task-" + task.id)?.focus();
              }
            }}
            onPointerDown={(event) => {
              if (event.button !== 0 || !event.isPrimary) return;
              event.preventDefault();
              event.currentTarget.focus({ preventScroll: true });
              event.currentTarget.setPointerCapture?.(event.pointerId);
              dragRef.current = { id: task.id, x: event.clientX, y: event.clientY, active: false };
            }}
            onPointerMove={(event) => {
              const current = dragRef.current;
              if (
                !current ||
                (!current.active &&
                  Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6)
              )
                return;
              current.active = true;
              setDrag({ id: current.id, x: event.clientX, y: event.clientY });
              const target = document
                .elementFromPoint?.(event.clientX, event.clientY)
                ?.closest("[data-kanban-column]");
              setDrop(target?.dataset.kanbanColumn || null);
            }}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={() => {
              dragRef.current = null;
              setDrag(null);
              setDrop(null);
            }}
          >
            <FiMove aria-hidden="true" />
          </button>
        </div>
        {task.description && <p className="kanban-card-description">{task.description}</p>}
        {task.date && (
          <button
            className="kanban-task-date"
            type="button"
            onClick={() => onSelectDate(task.date)}
          >
            <FiCalendar aria-hidden="true" />
            {formatDay(task.date, locale)}
          </button>
        )}
        {task.completedAt && (
          <time className="kanban-completed-at" dateTime={task.completedAt}>
            {t("Completed {date}", { date: new Date(task.completedAt).toLocaleString(locale) })}
          </time>
        )}
        <div className="kanban-card-actions">
          <label className="visually-hidden" htmlFor={"move-task-" + task.id}>
            {t("Move task {title}", { title: task.title })}
          </label>
          <select
            id={"move-task-" + task.id}
            value={task.columnId}
            disabled={busy}
            onChange={(event) => move(task.id, event.target.value)}
          >
            {board.columns.map((item) => (
              <option key={item.id} value={item.id}>
                {columnName(item, t)}
                {item.hidden ? " · " + t("Hidden") : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-button"
            disabled={busy || index === 0}
            aria-label={t("Move task {title} up", { title: task.title })}
            onClick={() => move(task.id, task.columnId, inColumn[index - 1]?.id)}
          >
            <FiArrowUp aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={busy || index === inColumn.length - 1}
            aria-label={t("Move task {title} down", { title: task.title })}
            onClick={() => move(task.id, task.columnId, inColumn[index + 2]?.id || null)}
          >
            <FiArrowDown aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={busy}
            aria-label={t(task.completedAt ? "Reopen task {title}" : "Complete task {title}", {
              title: task.title,
            })}
            onClick={() =>
              update({ type: task.completedAt ? "task.reopen" : "task.complete", taskId: task.id })
            }
          >
            {task.completedAt ? <FiRotateCcw aria-hidden="true" /> : <FiCheck aria-hidden="true" />}
          </button>
        </div>
        {history && <small className="kanban-history-stage">{columnName(column, t)}</small>}
      </article>
    );
  }
  return (
    <section
      className="kanban-workspace"
      aria-label={t("Task board")}
      aria-busy={pending || loading}
    >
      <div className="kanban-toolbar">
        <input
          type="search"
          aria-label={t("Search tasks")}
          placeholder={t("Search tasks")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className="kanban-toolbar-button"
          aria-pressed={onlyDay}
          onClick={() => setOnlyDay(!onlyDay)}
          title={formatDay(selectedDate, locale)}
        >
          <FiCalendar aria-hidden="true" />
          {t("Selected day")}
        </button>
        <button
          type="button"
          className="kanban-toolbar-button"
          aria-pressed={history}
          onClick={() => setHistory(!history)}
        >
          <FiClock aria-hidden="true" />
          {t("History")}
        </button>
        <button
          type="button"
          className="kanban-toolbar-button"
          onClick={() => setDialog({ kind: "columns" })}
        >
          <FiColumns aria-hidden="true" />
          {t("Columns")}
        </button>
        <button
          type="button"
          className="kanban-toolbar-button is-primary"
          disabled={busy}
          onClick={() => openTask()}
        >
          <FiPlus aria-hidden="true" />
          {t("New task")}
        </button>
      </div>
      {error && (
        <div role="alert" className="kanban-error">
          {t(error)}{" "}
          <button type="button" onClick={reload} disabled={pending}>
            {t("Reload board")}
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">{t("Loading board…")}</p>
      ) : history ? (
        <div className="kanban-history-list">
          {matching.length ? (
            [...matching]
              .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
              .map((task) =>
                card(
                  task,
                  board.columns.find((col) => col.id === task.columnId),
                ),
              )
          ) : (
            <p>{t("No completed tasks yet.")}</p>
          )}
        </div>
      ) : !visible.length ? (
        <div className="kanban-empty">
          <p>{t("All columns are hidden.")}</p>
          <button type="button" onClick={() => setDialog({ kind: "columns" })}>
            {t("Show columns")}
          </button>
        </div>
      ) : (
        <div
          ref={columnsRef}
          className="kanban-columns"
          tabIndex={0}
          role="group"
          aria-label={t("Board columns")}
        >
          {visible.map((column) => {
            const tasks = orderedTasks(matching, column.id),
              count = board.tasks.filter(
                (task) => task.columnId === column.id && !task.completedAt,
              ).length;
            return (
              <section
                key={column.id}
                className={"kanban-column" + (drop === column.id ? " is-drop-target" : "")}
                data-kanban-column={column.id}
                aria-label={columnName(column, t)}
              >
                <header>
                  <h3>{columnName(column, t)}</h3>
                  <span
                    className={column.wipLimit && count >= column.wipLimit ? "is-at-limit" : ""}
                  >
                    {column.wipLimit ? count + "/" + column.wipLimit : tasks.length}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={busy}
                    aria-label={t("Add task to {column}", { column: columnName(column, t) })}
                    onClick={() => openTask(null, column.id)}
                  >
                    <FiPlus aria-hidden="true" />
                  </button>
                </header>
                <div className="kanban-column-cards">
                  {tasks.map((task) => card(task, column))}
                  {!tasks.length && (
                    <button
                      className="kanban-add-card"
                      type="button"
                      disabled={busy}
                      onClick={() => openTask(null, column.id)}
                    >
                      <FiPlus aria-hidden="true" />
                      {t("Add task")}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <span role="status" className="visually-hidden">
        {message}
      </span>
      <p id="kanban-move-help" className="visually-hidden">
        {t("Drag cards by the handle, or use the stage menu and arrow buttons.")}
      </p>
      {drag && (
        <div
          className="kanban-drag-preview"
          aria-hidden="true"
          style={{
            left: Math.max(8, Math.min(drag.x + 14, window.innerWidth - 240)),
            top: Math.max(8, Math.min(drag.y + 14, window.innerHeight - 70)),
          }}
        >
          {board.tasks.find((task) => task.id === drag.id)?.title}
        </div>
      )}
      {dialog?.kind === "task" && (
        <TaskDialog
          key={dialog.task?.id || "new"}
          task={dialog.task}
          columnId={dialog.columnId}
          columns={board.columns}
          selectedDate={selectedDate}
          busy={pending || loading}
          conflict={conflict}
          error={error}
          onReload={reload}
          onClose={() => setDialog(null)}
          onSave={(values) =>
            update(
              {
                type: dialog.task ? "task.update" : "task.create",
                taskId: dialog.task?.id,
                ...values,
              },
              true,
            )
          }
        />
      )}
      {dialog?.kind === "columns" && (
        <ColumnDialog
          board={board}
          busy={pending || loading}
          conflict={conflict}
          error={error}
          onReload={reload}
          onClose={() => setDialog(null)}
          onSave={update}
        />
      )}
    </section>
  );
}

function TaskDialog({
  task,
  columnId,
  columns,
  selectedDate,
  busy,
  conflict,
  error,
  onReload,
  onClose,
  onSave,
}) {
  const { t, locale } = useLanguage();
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [date, setDate] = useState(task?.date || "");
  const [events, setEvents] = useState([]);
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    if (!task) return;
    const abort = new AbortController();
    api
      .getHistory(task.id, abort.signal)
      .then(setEvents)
      .catch((error) => {
        if (!abort.signal.aborted) setHistoryError(error.message);
      });
    return () => abort.abort();
  }, [task]);
  return (
    <Modal
      show
      centered
      restoreFocus
      onHide={busy ? undefined : onClose}
      className="planner-modal kanban-modal"
      aria-labelledby="kanban-task-title"
    >
      <Modal.Header closeButton={!busy} closeLabel={t("Close")}>
        <Modal.Title id="kanban-task-title">{t(task ? "Edit task" : "New task")}</Modal.Title>
      </Modal.Header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ title, description, date: date || null, columnId: task?.columnId || columnId });
        }}
      >
        <Modal.Body>
          <fieldset disabled={busy}>
            {error && (
              <div role="alert" className="kanban-error">
                {t(error)}{" "}
                <button type="button" onClick={onReload}>
                  {t("Reload board")}
                </button>
              </div>
            )}
            <label>
              {t("Task title")}
              <input
                autoFocus
                required
                maxLength={140}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              {t("Description")}
              <textarea
                maxLength={4000}
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label>
              {t("Calendar date (optional)")}
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            {!date && (
              <button
                type="button"
                className="kanban-text-button"
                onClick={() => setDate(selectedDate)}
              >
                {t("Use selected calendar day")}
              </button>
            )}
          </fieldset>
          {task && (
            <details className="kanban-task-history">
              <summary>{t("Task history")}</summary>
              {historyError && <p role="alert">{t(historyError)}</p>}
              <ol>
                {events.map((event) => (
                  <li key={event.id}>
                    <strong>
                      {t(
                        {
                          created: "Created",
                          edited: "Edited",
                          moved: "Moved",
                          completed: "Completed",
                          reopened: "Reopened",
                        }[event.kind],
                      )}
                    </strong>
                    {event.details.to &&
                      " · " +
                        (columns.find((col) => col.id === event.details.to)
                          ? columnName(
                              columns.find((col) => col.id === event.details.to),
                              t,
                            )
                          : event.details.to)}
                    <time dateTime={event.createdAt}>
                      {new Date(event.createdAt).toLocaleString(locale)}
                    </time>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="theme-button-outline" disabled={busy} onClick={onClose}>
            {t("Cancel")}
          </button>
          <button
            type="submit"
            className="theme-button"
            disabled={busy || conflict || !title.trim()}
          >
            {t("Save task")}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
function ColumnDialog({ board, busy, conflict, error, onReload, onClose, onSave }) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  return (
    <Modal
      show
      centered
      scrollable
      size="lg"
      onHide={busy ? undefined : onClose}
      className="planner-modal kanban-modal"
      aria-labelledby="kanban-columns-title"
    >
      <Modal.Header closeButton={!busy} closeLabel={t("Close")}>
        <Modal.Title id="kanban-columns-title">{t("Board columns")}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <div role="alert" className="kanban-error">
            {t(error)}{" "}
            <button type="button" disabled={busy} onClick={onReload}>
              {t("Reload board")}
            </button>
          </div>
        )}
        <div className="kanban-column-settings">
          {board.columns.map((column, index) => (
            <ColumnForm
              key={column.id}
              column={column}
              busy={busy || conflict}
              onSave={(values) => onSave({ type: "column.update", columnId: column.id, ...values })}
              onMove={(delta) =>
                onSave({ type: "column.move", columnId: column.id, index: index + delta })
              }
              first={index === 0}
              last={index === board.columns.length - 1}
            />
          ))}
        </div>
        <form
          className="kanban-new-column"
          onSubmit={async (event) => {
            event.preventDefault();
            const value = name.trim();
            if (value && (await onSave({ type: "column.create", name: value }))) setName("");
          }}
        >
          <label>
            {t("New column")}
            <input
              value={name}
              maxLength={60}
              required
              disabled={busy || conflict}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="theme-button-outline"
            disabled={busy || conflict || !name.trim()}
          >
            <FiPlus aria-hidden="true" />
            {t("Add column")}
          </button>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <button className="theme-button-outline" type="button" disabled={busy} onClick={onClose}>
          {t("Done")}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
function ColumnForm({ column, busy, onSave, onMove, first, last }) {
  const { t } = useLanguage();
  const [name, setName] = useState(column.name);
  const [limit, setLimit] = useState(column.wipLimit ?? "");
  return (
    <form
      className="kanban-column-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ name, wipLimit: limit === "" ? null : Number(limit) });
      }}
    >
      <div className="kanban-column-form-main">
        <label>
          {t("Column name")}
          <input
            aria-label={t("Name of {column}", { column: columnName(column, t) })}
            placeholder={columnName(column, t)}
            maxLength={60}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <small>{t({ todo: "To do", doing: "In progress", done: "Done" }[column.kind])}</small>
      </div>
      {column.kind === "doing" && (
        <label>
          {t("WIP limit")}
          <input
            type="number"
            min="1"
            max="99"
            placeholder="∞"
            value={limit}
            disabled={busy}
            onChange={(event) => setLimit(event.target.value)}
          />
        </label>
      )}
      <label className="kanban-visibility">
        <input
          type="checkbox"
          aria-label={t("Show column {column}", { column: columnName(column, t) })}
          checked={!column.hidden}
          disabled={busy}
          onChange={(event) => onSave({ hidden: !event.target.checked })}
        />
        {t("Visible")}
      </label>
      <div className="kanban-column-form-actions">
        <button
          type="button"
          className="icon-button"
          disabled={busy || first}
          aria-label={t("Move column {column} earlier", { column: columnName(column, t) })}
          onClick={() => onMove(-1)}
        >
          <FiArrowUp aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button"
          disabled={busy || last}
          aria-label={t("Move column {column} later", { column: columnName(column, t) })}
          onClick={() => onMove(1)}
        >
          <FiArrowDown aria-hidden="true" />
        </button>
        <button className="theme-button-outline" type="submit" disabled={busy}>
          {t("Save")}
        </button>
      </div>
    </form>
  );
}
