import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import { clearToken } from "../api/tokenStorage";
import { encryptionSession, lockEncryption } from "./session";
import { inspectVault, unlockVault, syncVault, vaultStatus } from "./vault";

export default function EncryptionGate({ children }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState(null);
  const [unlocked, setUnlocked] = useState(!!encryptionSession());
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [state, setState] = useState(vaultStatus);
  async function load() {
    setError("");
    try {
      setStatus(await inspectVault());
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    const locked = () => {
      setUnlocked(false);
      setStatus(null);
      setPassword("");
      setConfirmation("");
    };
    const changed = () => setState(vaultStatus());
    window.addEventListener("daymark:lock", locked);
    window.addEventListener("daymark:vault", changed);
    return () => {
      window.removeEventListener("daymark:lock", locked);
      window.removeEventListener("daymark:vault", changed);
    };
  }, []);
  useEffect(() => {
    if (unlocked) return;
    let active = true;
    inspectVault()
      .then((v) => {
        if (active) setStatus(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [unlocked]);
  useEffect(() => {
    if (!unlocked) return;
    const sync = () => {
      if (!document.hidden) syncVault().catch(() => {});
    };
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    const timer = setInterval(sync, 60000);
    const changed = (event) => {
      if (event.key === "token" || event.key === null) lockEncryption();
    };
    window.addEventListener("storage", changed);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", changed);
    };
  }, [unlocked]);
  async function submit(event) {
    event.preventDefault();
    if (!status.encrypted && password !== confirmation) {
      setError("Encryption passphrases do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await unlockVault(password, status);
      setPassword("");
      setConfirmation("");
      setUnlocked(true);
      setState(vaultStatus());
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!unlocked)
    return (
      <main className="container py-5" style={{ maxWidth: 600 }}>
        <h1>{t("Encrypted data")}</h1>
        {!status ? (
          <p role="status">{t("Loading encrypted data…")}</p>
        ) : (
          <form onSubmit={submit}>
            <p>
              {t(
                status.encrypted
                  ? "Enter your encryption passphrase. It is never sent to the server."
                  : "Create a separate encryption passphrase. Use the same phrase on all your devices.",
              )}
            </p>
            {!status.encrypted && (
              <>
                <p>
                  {t(
                    "Account password recovery cannot recover this phrase. If you lose it, encrypted data cannot be restored.",
                  )}
                </p>
                <p>
                  {t(
                    "Existing unencrypted server records will be retained. This preparation does not remove old copies.",
                  )}
                </p>
                <p>
                  {t(
                    "Older clients cannot sync after encryption is enabled. Update your other devices first.",
                  )}
                </p>
              </>
            )}
            <label className="d-block mb-3">
              {t("Encryption passphrase")}
              <input
                className="form-control"
                type="password"
                autoComplete="off"
                required
                minLength={status.encrypted ? undefined : 12}
                maxLength={1024}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </label>
            {!status.encrypted && (
              <>
                <label className="d-block mb-3">
                  {t("Confirm encryption passphrase")}
                  <input
                    className="form-control"
                    type="password"
                    autoComplete="off"
                    required
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="d-block mb-3">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    required
                  />{" "}
                  {t("I have saved my phrase and understand the recovery limits.")}
                </label>
              </>
            )}
            <button
              className="theme-button"
              disabled={busy || (!status.encrypted && !acknowledged)}
            >
              {t(busy ? "Please wait…" : status.encrypted ? "Unlock data" : "Prepare encryption")}
            </button>
          </form>
        )}
        {error && (
          <p className="mt-3" role="alert">
            {t(error)}
          </p>
        )}
        <div className="d-flex gap-3 mt-3">
          <button type="button" disabled={busy} onClick={load}>
            {t("Retry")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              clearToken();
              window.location.reload();
            }}
          >
            {t("Sign out")}
          </button>
        </div>
      </main>
    );
  return (
    <>
      {(state?.legacyRetained || state?.pending || state?.error || !!state?.conflicts.length) && (
        <div className="p-2 text-center border-bottom" aria-label={t("Encrypted data")}>
          {state?.pending && (
            <p className="mb-0" role="status">
              {t("Encrypted changes are saved locally. Sync is pending.")}
            </p>
          )}
          {state?.legacyRetained && (
            <p className="mb-0" role="status">
              {t("Old unencrypted server copies are retained. Full migration is pending.")}
            </p>
          )}
          {state?.error && (
            <p className="mb-0" role="status">
              {t(state.error)}
            </p>
          )}
          {!!state?.conflicts.length && (
            <div role="alert">
              <p>{t("These items changed on both devices")}</p>
              <p>{t("Open Settings to synchronize or resolve conflicts.")}</p>
            </div>
          )}
        </div>
      )}
      {children}
    </>
  );
}
