import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { columnName } from "../utils/board";
import { getHistory } from "../api/kanbanApi";

export default function TaskHistory({ taskId, columns }) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const controller = useRef(null);
  const load = useCallback(
    async (before = null) => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      setLoading(true);
      setError("");
      try {
        const result = await getHistory(taskId, abort.signal, before);
        if (abort.signal.aborted) return;
        const page = Array.isArray(result) ? { events: result, nextCursor: null } : result;
        setEvents((previous) => {
          const merged = new Map((before ? previous : []).map((event) => [event.id, event]));
          page.events.forEach((event) => merged.set(event.id, event));
          return [...merged.values()];
        });
        setNextCursor(page.nextCursor);
        setOffline(!!page.offline);
      } catch (error) {
        if (!abort.signal.aborted) setError(error.message);
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    },
    [taskId],
  );
  useEffect(() => {
    if (!open) return;
    load();
    return () => controller.current?.abort();
  }, [open, load]);
  return (
    <details
      className="kanban-task-history"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{t("Task history")}</summary>
      {offline && (
        <p role="status">{t("Showing saved activity. Connect to load the latest history.")}</p>
      )}
      {error && (
        <p role="alert">
          {t(error)}{" "}
          <button type="button" onClick={() => load(nextCursor)}>
            {t("Retry")}
          </button>
        </p>
      )}
      <ol>
        {events.map((event) => {
          const column = columns.find((item) => item.id === event.details.to);
          return (
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
              {event.details.to && " · " + (column ? columnName(column, t) : event.details.to)}
              <time dateTime={event.createdAt}>
                {new Date(event.createdAt).toLocaleString(locale)}
              </time>
            </li>
          );
        })}
      </ol>
      {loading && <p role="status">{t("Loading task history…")}</p>}
      {nextCursor && !error && (
        <button type="button" disabled={loading} onClick={() => load(nextCursor)}>
          {t("Load more activity")}
        </button>
      )}
      {!loading && !error && !offline && !events.length && <p>{t("No activity yet.")}</p>}
    </details>
  );
}
