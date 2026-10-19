import { useState } from "react";
import { Alert, Button, ProgressBar } from "react-bootstrap";
import { useLanguage } from "../i18n/LanguageProvider";
import { useAppUpdates } from "./AppUpdatesProvider";

function UpdateAction({ updates }) {
  const { t } = useLanguage();
  const { status, busy, error, run } = updates;
  if (!status) return null;
  return (
    <>
      {status.candidate && (
        <>
          <p>{t("Daymark {version} is available", { version: status.candidate.versionName })}</p>
          {status.candidate.notes && (
            <p style={{ whiteSpace: "pre-line" }}>{status.candidate.notes}</p>
          )}
          <p>
            {t(
              "Your saved data stays on this phone. Android will ask you to confirm installation.",
            )}
          </p>
          {status.downloading ? (
            <>
              <p role="status">
                {t("Downloading update… {progress}%", { progress: status.progress })}
              </p>
              <ProgressBar now={status.progress} aria-label={t("Update download")} />
            </>
          ) : (
            <Button className="theme-button" disabled={busy} onClick={() => run("install")}>
              {status.ready ? t("Install update") : t("Download and update")}
            </Button>
          )}
        </>
      )}
      {(error || status.error) && (
        <p className="form-error" role="alert">
          {t(error || status.error)}
        </p>
      )}
    </>
  );
}

export function AppUpdateSettings() {
  const updates = useAppUpdates();
  const { t, locale } = useLanguage();
  if (!updates.supported) return null;
  const { status, busy, run } = updates;
  return (
    <section className="account-section" aria-label={t("App updates")}>
      <h2>{t("App updates")}</h2>
      {status && <p>{t("Installed version: {version}", { version: status.installedVersion })}</p>}
      <p>
        {t(
          "New versions are checked automatically when you open the app and periodically in the background.",
        )}
      </p>
      <UpdateAction updates={updates} />
      {status?.checkedAt > 0 && !status.candidate && (
        <p role="status">{t("You have the latest version.")}</p>
      )}
      {status?.checkedAt > 0 && (
        <p>
          {t("Last checked: {time}", { time: new Date(status.checkedAt).toLocaleString(locale) })}
        </p>
      )}
      <Button
        className="theme-button-outline mt-3"
        variant="outline-secondary"
        disabled={busy || status?.downloading}
        onClick={() => run("check")}
      >
        {busy ? t("Please wait…") : t("Check for updates")}
      </Button>
      {status && !status.notifications && (
        <>
          <p className="mt-3">
            {t("Allow notifications to hear about new versions while the app is closed.")}
          </p>
          <Button
            className="theme-button-outline"
            variant="outline-secondary"
            disabled={busy}
            onClick={() => run("notifications")}
          >
            {t("Enable update notifications")}
          </Button>
        </>
      )}
      {status?.canImportLegacy && (
        <div className="mt-3">
          <p>{t("Moving from 0.2? Restore your exported backup before signing in.")}</p>
          <Button
            className="theme-button-outline"
            variant="outline-secondary"
            disabled={busy}
            onClick={() => run("restoreLegacy")}
          >
            {t("Restore a 0.2 backup")}
          </Button>
        </div>
      )}
      {status?.importMessage && <p role="status">{t(status.importMessage)}</p>}
    </section>
  );
}

export function AppUpdateBanner() {
  const updates = useAppUpdates();
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(null);
  const code = updates.status?.candidate?.versionCode;
  if (!updates.supported || !code || (dismissed === code && !updates.status.downloading))
    return null;
  return (
    <Alert variant="info" className="mx-3" role="region" aria-label={t("App updates")}>
      <UpdateAction updates={updates} />
      {!updates.status.downloading && (
        <Button
          className="theme-button-outline ms-2"
          variant="outline-secondary"
          onClick={() => setDismissed(code)}
        >
          {t("Later")}
        </Button>
      )}
    </Alert>
  );
}
