import { useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageProvider";
import { LOGIN_ROUTE } from "../config/routes";
import { isOfflineApp } from "./bridge";
import { encryptionSession } from "../encryption/session";
import { FiRefreshCw } from "react-icons/fi";
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
export default function SyncStatus({ sync }) {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const { state, busy, error, action } = sync;
  if (!isOfflineApp() || encryptionSession()) return null;
  const conflicts = state?.conflicts || [];
  return (
    <section className="sync-status" aria-label={t("Phone synchronization")}>
      <h2>
        <FiRefreshCw aria-hidden="true" />
        {t("Phone synchronization")}
      </h2>
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
    </section>
  );
}
