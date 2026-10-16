import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageProvider";
import { getToken } from "../api/tokenStorage";
import { LOGIN_ROUTE } from "../config/routes";
import { isOfflineApp, offlineNative } from "./bridge";
import "./SyncStatus.css";

function preview(value, t) {
  if (!value) return t("Deleted");
  if (value.title || value.comment || value.nameSnapshot) {
    const parts = [value.title || value.comment || value.nameSnapshot];
    if (value.date) parts.push(value.date);
    if (value.time || value.timeSnapshot) parts.push(value.time || value.timeSnapshot);
    if (typeof value.completed === "boolean")
      parts.push(t(value.completed ? "Completed" : "To do"));
    if (value.description) parts.push(value.description);
    if (value.columnId) parts.push(t(value.completedAt ? "Completed" : "In progress"));
    return parts.join(" · ");
  }
  if (value.columns)
    return value.columns
      .map((c) => c.name || t({ todo: "To do", doing: "In progress", done: "Done" }[c.kind]))
      .join(" · ");
  if (value.rows)
    return [
      t(value.enabled ? "Enabled" : "Disabled"),
      ...value.slots.map((s) => s.time),
      ...value.rows.map(
        (r) => `${r.name}: ${r.startDate} — ${r.endDate || "…"}; ${r.weekdays.join(", ")}`,
      ),
    ].join(" · ");
  return t(value.enabled ? "Enabled" : "Disabled");
}
export default function SyncStatus() {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(null);
  const active = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const next = await offlineNative("status");
      if (!active.current) return;
      setState(next);
      setError("");
      if (revision.current !== null && revision.current !== next.syncRevision)
        window.dispatchEvent(new Event("daymark:sync"));
      revision.current = next.syncRevision;
    } catch (error) {
      if (active.current) setError(error.message);
    }
  }, []);
  useEffect(() => {
    if (!isOfflineApp()) return;
    active.current = true;
    refresh();
    const poll = setInterval(() => {
      if (!document.hidden) refresh();
    }, 3000);
    const sync = () =>
      offlineNative("sync")
        .then(refresh)
        .catch(() => {});
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    return () => {
      active.current = false;
      clearInterval(poll);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
    };
  }, [refresh]);
  if (!isOfflineApp()) return null;
  async function action(name, payload = {}) {
    setBusy(true);
    try {
      await offlineNative(name, { ...payload, token: getToken() });
      await refresh();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  const conflicts = state?.conflicts || [];
  return (
    <aside className="sync-status" aria-label={t("Phone synchronization")}>
      <div className="sync-status-heading">
        <p role="status">
          {!state?.ready
            ? t("Preparing data for offline use…")
            : state?.pending
              ? t("{count} changes saved on this phone", { count: state.pending })
              : t("Data is saved on this phone")}
          {state?.lastSync && (
            <small>
              {t("Last exchange: {time}", {
                time: new Intl.DateTimeFormat(locale, {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(state.lastSync)),
              })}
            </small>
          )}
        </p>
        <button
          type="button"
          className="todo-button"
          disabled={busy}
          onClick={() => action("sync")}
        >
          {t("Sync now")}
        </button>
      </div>
      {(error || state?.error) && <p role="status">{t(error || state.error)}</p>}
      {state?.authRequired && (
        <div>
          <p>{t("Sign in again to resume exchange. Local changes are retained.")}</p>
          <button
            type="button"
            className="todo-button"
            onClick={() => {
              localStorage.removeItem("token");
              navigate(LOGIN_ROUTE);
            }}
          >
            {t("Sign in again")}
          </button>
        </div>
      )}
      {!!conflicts.length && (
        <div className="sync-conflicts" role="alert">
          <h2>{t("These items changed on both devices")}</h2>
          <p>{t("Choose a version for the conflicting items. Other changes will be merged.")}</p>
          <ul>
            {conflicts.map((conflict) => (
              <li key={conflict.key}>
                <span>
                  <strong>{t("Phone")}: </strong>
                  {preview(conflict.local, t)}
                </span>
                <span>
                  <strong>{t("Server")}: </strong>
                  {preview(conflict.remote, t)}
                </span>
              </li>
            ))}
          </ul>
          <div className="sync-conflict-actions">
            <button
              type="button"
              className="todo-button"
              disabled={busy}
              onClick={() => action("resolve", { choice: "local" })}
            >
              {t("Keep phone versions")}
            </button>
            <button
              type="button"
              className="todo-button"
              disabled={busy}
              onClick={() => action("resolve", { choice: "remote" })}
            >
              {t("Keep server versions")}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
