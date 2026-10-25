import { useEffect, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { useLanguage } from "../i18n/LanguageProvider";
import { encryptionSession } from "./session";
import { useEncryption } from "./EncryptionContext";
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
  const encryption = useEncryption();
  const [state, setState] = useState(vaultStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false),
    [link, setLink] = useState("");
  useEffect(() => {
    const changed = () => setState(vaultStatus());
    window.addEventListener("daymark:vault", changed);
    return () => window.removeEventListener("daymark:vault", changed);
  }, []);
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
      <h2>{t("End-to-end encryption")}</h2>
      {!encryptionSession() ? (
        <>
          <p>{t("Off. Your calendar works normally without encryption.")}</p>
          <p>
            {t(
              "Create an automatic key on this device. Connect other devices by approving their connection link. No phrase or extra password is needed.",
            )}
          </p>
          <p>
            {t(
              "Keep at least one connected device. Losing all device keys makes encrypted data inaccessible.",
            )}
          </p>
          <p>
            {t(
              "Older clients cannot sync after encryption is enabled. Update your other devices first.",
            )}
          </p>
          <p>
            {t(
              "Existing unencrypted server records will be retained. This preparation does not remove old copies.",
            )}
          </p>
          {encryption.error && <p role="alert">{t(encryption.error)}</p>}
          <Button className="theme-button" disabled={encryption.busy} onClick={encryption.enable}>
            {t("Enable encryption")}
          </Button>
        </>
      ) : (
        <>
          <p>
            {t(
              "On. This device opens encrypted data automatically. Approve connection links only from your own other devices.",
            )}
          </p>
          <p role="status">
            {t(
              state?.pending
                ? "Encrypted changes are saved locally. Sync is pending."
                : "Encrypted data",
            )}
          </p>
          <div className="d-flex flex-wrap gap-2">
            <Button
              variant="outline-secondary"
              className="theme-button-outline"
              disabled={busy}
              onClick={() => {
                setLink("");
                setError("");
                setConnecting(true);
              }}
            >
              {t("Connect another device")}
            </Button>
            <Button
              variant="outline-secondary"
              className="theme-button-outline"
              disabled={busy}
              onClick={() => action(syncVault)}
            >
              {t("Sync now")}
            </Button>
          </div>
          {(error || state?.error) && <p role="status">{t(error || state.error)}</p>}
          {!!state?.conflicts.length && (
            <div role="alert">
              <p>{t("These items changed on both devices")}</p>
              <p>
                {t("Choose a version for the conflicting items. Other changes will be merged.")}
              </p>
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
                <Button
                  variant="outline-secondary"
                  className="theme-button-outline"
                  disabled={busy}
                  onClick={() => action(() => resolveVault("local"))}
                >
                  {t("Keep local versions")}
                </Button>
                <Button
                  variant="outline-secondary"
                  className="theme-button-outline"
                  disabled={busy}
                  onClick={() => action(() => resolveVault("remote"))}
                >
                  {t("Keep server versions")}
                </Button>
              </div>
            </div>
          )}
          {state?.legacyRetained && (
            <p>{t("Old unencrypted server copies are retained. Full migration is pending.")}</p>
          )}
        </>
      )}
      <Modal
        show={connecting}
        onHide={() => setConnecting(false)}
        centered
        className="planner-modal"
        aria-labelledby="paste-connection-title"
      >
        <Modal.Header closeButton>
          <Modal.Title id="paste-connection-title">{t("Connect another device")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {t(
              "If the link opens in another browser, paste the automatically generated connection link here. You will confirm the device on the next screen.",
            )}
          </p>
          <Form.Label htmlFor="device-connection-url">
            {t("Connection link from your other device")}
          </Form.Label>
          <Form.Control
            id="device-connection-url"
            as="textarea"
            rows={3}
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          {error && <p role="alert">{t(error)}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            className="theme-button-outline"
            onClick={() => setConnecting(false)}
          >
            {t("Cancel")}
          </Button>
          <Button
            className="theme-button"
            disabled={!link.trim()}
            onClick={() => {
              try {
                encryption.connect(link.trim());
                setConnecting(false);
              } catch {
                setError("Invalid device connection");
              }
            }}
          >
            {t("Review connection")}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}
