import { Fragment, useCallback, useEffect, useState } from "react";
import { Button, Form, Alert, Modal } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageProvider";
import { clearToken } from "../api/tokenStorage";
import CalendarLoading from "../components/CalendarLoading";
import { encryptionSession, lockEncryption } from "./session";
import { syncVault, disableVault, isCurrentVaultKey } from "./vault";
import {
  initializeDeviceAccess,
  restoreDeviceAccess,
  enableDeviceEncryption,
  approveDeviceConnection,
  parseConnection,
  rememberLegacyDevice,
} from "./deviceFlow";
import { EncryptionContext } from "./EncryptionContext";

export default function EncryptionGate({ children }) {
  const { t } = useLanguage(),
    location = useLocation(),
    navigate = useNavigate();
  const [access, setAccess] = useState({ mode: encryptionSession() ? "ready" : "loading" });
  const [attempt, setAttempt] = useState(0),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [legacyPhrase, setLegacyPhrase] = useState("");
  const [copied, setCopied] = useState(false);
  const retry = useCallback(() => {
    setError("");
    setAttempt((v) => v + 1);
  }, []);
  useEffect(() => {
    let active = true;
    let restored = false;
    async function initialize() {
      // A missing key or damaged copy still goes through the normal server recovery flow.
      const local = await restoreDeviceAccess().catch(() => null);
      if (!active) return;
      if (local) {
        restored = true;
        setAccess(local);
        if (local.mode === "ready") return;
      }
      return initializeDeviceAccess();
    }
    initialize()
      .then((value) => {
        if (active && value) {
          setAccess(value);
          setError("");
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          if (!restored || e.status === 401) setAccess((v) => ({ ...v, mode: "error" }));
        }
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    const locked = () => {
      setAccess({ mode: "loading" });
      setLegacyPhrase("");
      retry();
    };
    window.addEventListener("daymark:lock", locked);
    return () => {
      window.removeEventListener("daymark:lock", locked);
    };
  }, [retry]);
  useEffect(() => {
    if (!["waiting", "legacy"].includes(access.mode)) return;
    const timer = setInterval(() => {
      if (!document.hidden) retry();
    }, 5000);
    return () => clearInterval(timer);
  }, [access.mode, retry]);
  useEffect(() => {
    if (access.mode !== "ready") return;
    const sync = () => {
      if (!document.hidden) syncVault().catch(() => {});
    };
    const changed = (event) => {
      if (
        event.key === "token" ||
        event.key === null ||
        (isCurrentVaultKey(event.key) && event.newValue === null)
      )
        lockEncryption();
      else if (isCurrentVaultKey(event.key)) {
        window.dispatchEvent(new Event("daymark:sync"));
        sync();
      }
    };
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("storage", changed);
    const timer = setInterval(sync, 60000);
    sync();
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", changed);
    };
  }, [access.mode]);
  async function enable() {
    setBusy(true);
    setError("");
    setAccess((v) => ({ ...v, mode: "enabling" }));
    try {
      setAccess(await enableDeviceEncryption());
    } catch (e) {
      setError(e.message);
      try {
        setAccess(await initializeDeviceAccess());
      } catch {
        setAccess({ mode: "error" });
      }
    } finally {
      setBusy(false);
    }
  }
  async function legacy(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setAccess(await rememberLegacyDevice(legacyPhrase, access.status));
      setLegacyPhrase("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    setError("");
    try {
      await disableVault();
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(access.link);
      setCopied(true);
    } catch {
      setError("The connection link could not be copied.");
    }
  }
  const request = parseConnection(location.search);
  const hasRequest = new URLSearchParams(location.search).has("connect");
  const dismiss = () => navigate(location.pathname, { replace: true });
  function connect(link) {
    const url = new URL(link);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid device connection");
    const search = url.hash.includes("?") ? url.hash.slice(url.hash.indexOf("?")) : url.search;
    if (!parseConnection(search)) throw new Error("Invalid device connection");
    navigate(location.pathname + search);
  }
  async function approve() {
    setBusy(true);
    setError("");
    try {
      await approveDeviceConnection(request);
      dismiss();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (["loading", "enabling"].includes(access.mode)) return <CalendarLoading fullPage />;
  if (!["plain", "ready"].includes(access.mode))
    return (
      <main className="container py-5" style={{ maxWidth: 600 }}>
        <h1>{t("Connect this device")}</h1>
        {["waiting", "legacy"].includes(access.mode) && (
          <>
            <p>
              {t(
                "Open this connection link on a device that already has access, then approve this device there. No encryption phrase is needed.",
              )}
            </p>
            <p>{t("Device code: {code}", { code: access.code })}</p>
            <Form.Control
              as="textarea"
              rows={3}
              readOnly
              aria-label={t("Device connection link")}
              value={access.link || ""}
            />
            <Button
              variant="outline-secondary"
              className="theme-button-outline mt-3"
              onClick={copy}
            >
              {t(copied ? "Link copied" : "Copy connection link")}
            </Button>
            <p className="mt-3">{t("Waiting for confirmation on your connected device…")}</p>
          </>
        )}
        {access.mode === "legacy" && (
          <details className="mt-3">
            <summary>{t("Access from the previous version")}</summary>
            <p>
              {t(
                "This account used a phrase in an older version. Enter it once to save access on this device. New encryption uses automatic device keys.",
              )}
            </p>
            <Form onSubmit={legacy}>
              <Form.Group controlId="legacy-encryption-phrase">
                <Form.Label>{t("Previous encryption phrase")}</Form.Label>
                <Form.Control
                  type="password"
                  autoComplete="off"
                  required
                  value={legacyPhrase}
                  onChange={(e) => setLegacyPhrase(e.target.value)}
                />
              </Form.Group>
              <Button type="submit" className="theme-button mt-3" disabled={busy}>
                {t("Restore device access")}
              </Button>
            </Form>
          </details>
        )}
        {error && (
          <Alert variant="danger" className="mt-3">
            {t(error)}
          </Alert>
        )}
        <div className="d-flex gap-3 mt-3">
          <Button
            variant="outline-secondary"
            className="theme-button-outline"
            disabled={busy}
            onClick={retry}
          >
            {t("Retry")}
          </Button>
          <Button
            variant="outline-secondary"
            className="theme-button-outline"
            disabled={busy}
            onClick={() => {
              clearToken();
              navigate("/login", { replace: true });
            }}
          >
            {t("Sign out")}
          </Button>
        </div>
      </main>
    );
  return (
    <EncryptionContext.Provider
      value={{ mode: access.mode, enable, disable, connect, retry, busy, error }}
    >
      <Fragment key={access.mode}>{children}</Fragment>
      <Modal
        show={hasRequest}
        onHide={busy ? undefined : dismiss}
        centered
        className="planner-modal"
        aria-labelledby="device-approval-title"
      >
        <Modal.Header closeButton={!busy}>
          <Modal.Title id="device-approval-title">{t("Approve another device")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {t(
              "Approve only a connection link opened from your own other device. It will be able to read your encrypted account data.",
            )}
          </p>
          {request && <p>{t("Device code: {code}", { code: request.id.slice(0, 8) })}</p>}
          {(!request || access.mode !== "ready") && (
            <Alert variant="warning">{t("Open this link on an already connected device.")}</Alert>
          )}
          {error && <Alert variant="danger">{t(error)}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            className="theme-button-outline"
            disabled={busy}
            onClick={dismiss}
          >
            {t("Cancel")}
          </Button>
          <Button
            className="theme-button"
            disabled={busy || !request || access.mode !== "ready"}
            onClick={approve}
          >
            {t("Approve device")}
          </Button>
        </Modal.Footer>
      </Modal>
    </EncryptionContext.Provider>
  );
}
