import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import { encryptionSession, lockEncryption } from "./session";
import { vaultStatus, syncVault, resolveVault } from "./vault";

function preview(value, t) {
  if (!value) return t("Deleted");
  if (value.title || value.comment || value.nameSnapshot)
    return [value.date, value.title || value.comment || value.nameSnapshot]
      .filter(Boolean)
      .join(" · ");
  if (value.columns)
    return value.columns
      .map((c) => c.name || t({ todo: "To do", doing: "In progress", done: "Done" }[c.kind]))
      .join(" · ");
  if (value.rows)
    return value.rows.map((r) => r.name).join(" · ") || t(value.enabled ? "Enabled" : "Disabled");
  return t(value.enabled ? "Enabled" : "Disabled");
}
export default function EncryptionControls() {
  const { t } = useLanguage();
  const [state, setState] = useState(vaultStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const changed = () => setState(vaultStatus());
    window.addEventListener("daymark:vault", changed);
    return () => window.removeEventListener("daymark:vault", changed);
  }, []);
  if (!encryptionSession()) return null;
  async function action(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setState(vaultStatus());
    }
  }
  return (
    <section className="account-section" aria-label={t("Encrypted data")}>
      <h2>{t("Encrypted data")}</h2>
      <p role="status">
        {t(
          state?.pending
            ? "Encrypted changes are saved locally. Sync is pending."
            : "Encrypted data",
        )}
      </p>
      <div className="d-flex flex-wrap gap-2">
        <button
          type="button"
          className="theme-button-outline"
          disabled={busy}
          onClick={() => action(syncVault)}
        >
          {t("Sync now")}
        </button>
        <button
          type="button"
          className="theme-button-outline"
          disabled={busy}
          onClick={lockEncryption}
        >
          {t("Lock data")}
        </button>
      </div>
      {(error || state?.error) && <p role="status">{t(error || state.error)}</p>}
      {!!state?.conflicts.length && (
        <div role="alert">
          <p>{t("These items changed on both devices")}</p>
          <p>{t("Choose a version for the conflicting items. Other changes will be merged.")}</p>
          <ul>
            {state.conflictItems?.map((item) => (
              <li key={item.key}>
                <p>
                  <strong>{t("Local")}: </strong>
                  {preview(item.local, t)}
                </p>
                <p>
                  <strong>{t("Server")}: </strong>
                  {preview(item.remote, t)}
                </p>
              </li>
            ))}
          </ul>
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="theme-button-outline"
              disabled={busy}
              onClick={() => action(() => resolveVault("local"))}
            >
              {t("Keep local versions")}
            </button>
            <button
              type="button"
              className="theme-button-outline"
              disabled={busy}
              onClick={() => action(() => resolveVault("remote"))}
            >
              {t("Keep server versions")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
