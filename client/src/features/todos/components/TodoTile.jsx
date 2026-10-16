import { useRef, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import "../styles/Todos.css";

export default function TodoTile({ tracker }) {
  const { t } = useLanguage();
  const { list, loading, pending, conflict, error, reload, send } = tracker;
  const [draft, setDraft] = useState("");
  const [validation, setValidation] = useState("");
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
      await send({ type: "add", titles });
      setDraft("");
      input.current?.focus();
    } catch {
      // Keep the full draft for retry, including pasted lines.
    } finally {
      adding.current = false;
    }
  }
  const completed = list.tasks.filter((task) => task.completed).length;
  return (
    <div className="todo-workspace" aria-busy={loading || pending}>
      <div className="todo-summary" role="status">
        {t("{completed} of {total} completed", { completed, total: list.tasks.length })}
      </div>
      {(error || validation) && (
        <div className="todo-error" role="alert">
          <p>{t(validation || error)}</p>
          {error && (
            <button type="button" className="todo-button" disabled={pending} onClick={reload}>
              {t("Reload to-do list")}
            </button>
          )}
        </div>
      )}
      <div className="todo-items">
        {loading ? (
          <p role="status">{t("Loading to-do list…")}</p>
        ) : list.tasks.length ? (
          <ul aria-label={t("To-do tasks")}>
            {list.tasks.map((task) => (
              <TodoRow key={task.id} task={task} busy={busy} send={send} />
            ))}
          </ul>
        ) : (
          <p className="todo-empty">{t("Start with one small task.")}</p>
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
          aria-describedby="todo-input-hint"
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
          <small id="todo-input-hint">
            {t("Enter adds a task. Paste several lines to add several tasks.")}
          </small>
          <button type="submit" className="todo-button" disabled={busy || !draft.trim()}>
            <FiPlus aria-hidden="true" />
            {t("Add tasks")}
          </button>
        </div>
      </form>
    </div>
  );
}

function TodoRow({ task, busy, send }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  async function save(event) {
    event.preventDefault();
    if (busy || !title.trim()) return;
    try {
      await send({ type: "edit", id: task.id, title });
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
          <button className="todo-button" disabled={busy || !title.trim()}>
            {t("Save")}
          </button>
          <button type="button" className="todo-button" onClick={() => setEditing(false)}>
            {t("Cancel")}
          </button>
        </form>
      ) : (
        <>
          <span className="todo-title">{task.completed ? <s>{task.title}</s> : task.title}</span>
          <button
            type="button"
            className="icon-button"
            disabled={busy}
            aria-label={t("Edit to-do {title}", { title: task.title })}
            onClick={() => {
              setTitle(task.title);
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
