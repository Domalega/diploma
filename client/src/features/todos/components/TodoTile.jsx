import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { formatDay, todayKey } from "../../calendar/utils/calendarDates";
import "../styles/Todos.css";

function useRecentlyCompleted(tasks) {
  const previous = useRef(new Map(tasks.map((task) => [task.id, task.completed])));
  const timers = useRef(new Map());
  const [recent, setRecent] = useState(() => new Set());
  useLayoutEffect(() => {
    const current = new Map(tasks.map((task) => [task.id, task.completed]));
    timers.current.forEach((timer, id) => {
      if (!current.get(id)) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
    });
    tasks.forEach((task) => {
      if (task.completed && previous.current.get(task.id) === false) {
        timers.current.set(
          task.id,
          setTimeout(() => {
            timers.current.delete(task.id);
            setRecent(new Set(timers.current.keys()));
          }, 1500),
        );
      }
    });
    previous.current = current;
    setRecent(new Set(timers.current.keys()));
  }, [tasks]);
  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
    };
  }, []);
  return recent;
}

export default function TodoTile({ tracker, selectedDate = todayKey(), onSelectDate }) {
  const { t } = useLanguage();
  const { list, loading, pending, conflict, error, send } = tracker;
  const [draft, setDraft] = useState("");
  const [date, setDate] = useState("");
  const [scope, setScope] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [validation, setValidation] = useState("");
  const recentlyCompleted = useRecentlyCompleted(list.tasks);
  const adding = useRef(false);
  const input = useRef(null);
  const busy = loading || pending || conflict;
  async function add(value = draft) {
    if (busy || adding.current) return;
    const titles = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!titles.length) return;
    if (titles.length > 100) {
      setValidation("Add up to 100 tasks at a time");
      return;
    }
    if (titles.some((title) => title.length > 500)) {
      setValidation("Use one line of up to 500 characters per task");
      return;
    }
    adding.current = true;
    setValidation("");
    try {
      await send({ type: "add", titles, date: date || todayKey() });
      setDraft("");
      setShowCompleted(false);
      if (scope === "day" && (date || todayKey()) !== selectedDate) setScope("all");
      input.current?.focus();
    } catch {
      // Keep the full draft for retry, including pasted lines.
    } finally {
      adding.current = false;
    }
  }
  const tasks =
    scope === "day" ? list.tasks.filter((task) => task.date === selectedDate) : list.tasks;
  const completed = tasks.filter((task) => task.completed).length;
  const visibleTasks = tasks.filter((task) =>
    showCompleted ? task.completed : !task.completed || recentlyCompleted.has(task.id),
  );
  return (
    <div className="todo-workspace" aria-busy={loading || pending}>
      <div className="todo-summary" role="status">
        {t("{completed} of {total} completed", { completed, total: tasks.length })}
      </div>
      <div className="todo-scope" role="group" aria-label={t("To-do view")}>
        <button
          type="button"
          className="todo-button"
          aria-pressed={scope === "all"}
          onClick={() => setScope("all")}
        >
          {t("All tasks")}
        </button>
        <button
          type="button"
          className="todo-button"
          aria-pressed={scope === "day"}
          onClick={() => setScope("day")}
        >
          {t("Selected day")}
        </button>
        <button
          type="button"
          className="todo-button"
          aria-pressed={showCompleted}
          onClick={() => setShowCompleted((value) => !value)}
        >
          {t("Completed tasks")} ({completed})
        </button>
      </div>
      {(error || validation) && (
        <div className="todo-error" role="alert">
          <p>{t(validation || error)}</p>
        </div>
      )}
      <div className="todo-items">
        {loading ? (
          <p role="status">{t("Loading to-do list…")}</p>
        ) : visibleTasks.length ? (
          <ul aria-label={t("To-do tasks")}>
            {visibleTasks.map((task) => (
              <TodoRow
                key={task.id}
                task={task}
                busy={busy}
                send={send}
                onSelectDate={onSelectDate}
              />
            ))}
          </ul>
        ) : (
          <p className="todo-empty">
            {t(
              showCompleted
                ? "No completed tasks yet."
                : tasks.length
                  ? "No active tasks."
                  : "Start with one small task.",
            )}
          </p>
        )}
      </div>
      <form
        className="todo-composer"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <label className="visually-hidden" htmlFor="todo-draft">
          {t("New to-do tasks")}
        </label>
        <textarea
          id="todo-draft"
          ref={input}
          rows={2}
          value={draft}
          readOnly={busy}
          placeholder={t("What needs to be done?")}
          onChange={(event) => {
            const value = event.target.value;
            setDraft(value);
            setValidation("");
            if (value.includes("\n")) add(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault();
              add();
            }
          }}
        />
        <div className="todo-composer-footer">
          <label className="todo-date-field">
            <span>{t("Task date (today if empty)")}</span>
            <input
              type="date"
              value={date}
              disabled={busy}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <button type="submit" className="todo-button" disabled={busy || !draft.trim()}>
            <FiPlus aria-hidden="true" />
            {t("Add tasks")}
          </button>
        </div>
      </form>
    </div>
  );
}

export function TodoRow({ task, busy, send, onSelectDate }) {
  const { t, locale } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date || "");
  async function save(event) {
    event.preventDefault();
    if (busy || !title.trim()) return;
    try {
      await send({ type: "edit", id: task.id, title, date: date || todayKey() });
      setEditing(false);
    } catch {
      // A failed save must leave the editor open.
    }
  }
  return (
    <li className={"todo-row" + (task.completed ? " is-completed" : "")}>
      <input
        type="checkbox"
        className="todo-check"
        checked={task.completed}
        disabled={busy}
        aria-label={t(task.completed ? "Reopen task {title}" : "Complete task {title}", {
          title: task.title,
        })}
        onChange={(event) =>
          send({ type: "complete", id: task.id, completed: event.target.checked }).catch(() => {})
        }
      />
      {editing ? (
        <form className="todo-edit" onSubmit={save}>
          <input
            autoFocus
            aria-label={t("Task title")}
            value={title}
            maxLength={500}
            disabled={busy}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditing(false);
            }}
          />
          <label className="todo-date-field">
            <span>{t("Task date (today if empty)")}</span>
            <input
              type="date"
              value={date}
              disabled={busy}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <button className="todo-button" disabled={busy || !title.trim()}>
            {t("Save")}
          </button>
          <button type="button" className="todo-button" onClick={() => setEditing(false)}>
            {t("Cancel")}
          </button>
        </form>
      ) : (
        <>
          <span className="todo-title">
            {task.completed ? <s>{task.title}</s> : task.title}
            {task.date && (
              <button
                type="button"
                className="todo-task-date"
                onClick={() => onSelectDate?.(task.date)}
                aria-label={t("Show {date} in calendar", { date: formatDay(task.date, locale) })}
              >
                <time dateTime={task.date}>{formatDay(task.date, locale)}</time>
              </button>
            )}
          </span>
          <button
            type="button"
            className="icon-button"
            disabled={busy}
            aria-label={t("Edit to-do {title}", { title: task.title })}
            onClick={() => {
              setTitle(task.title);
              setDate(task.date || "");
              setEditing(true);
            }}
          >
            <FiEdit2 aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={busy}
            aria-label={t("Delete to-do {title}", { title: task.title })}
            onClick={() => send({ type: "remove", id: task.id }).catch(() => {})}
          >
            <FiTrash2 aria-hidden="true" />
          </button>
        </>
      )}
    </li>
  );
}
