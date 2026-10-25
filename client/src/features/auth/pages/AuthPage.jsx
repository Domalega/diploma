import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthForm from "../components/AuthForm";
import AuthLayout from "../components/AuthLayout";
import {
  login,
  register,
  forgotPassword,
  resetPassword,
  recoveryStatus,
  check,
} from "../api/authApi";
import { getToken, setToken, clearToken } from "../../../shared/api/tokenStorage";
import CalendarLoading from "../../../shared/components/CalendarLoading";
import { hasCachedCalendar } from "../../../shared/api/browserCache";
import {
  LOGIN_ROUTE,
  REGISTRATION_ROUTE,
  FORGOT_PASSWORD_ROUTE,
  CALENDAR_ROUTE,
} from "../../../shared/config/routes";

export default function AuthPage() {
  const { t } = useLanguage();

  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recoveryAvailable, setRecoveryAvailable] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const mode =
    location.pathname === LOGIN_ROUTE
      ? "login"
      : location.pathname === REGISTRATION_ROUTE
        ? "registration"
        : location.pathname === FORGOT_PASSWORD_ROUTE
          ? "forgot"
          : "reset";
  const [resetToken] = useState(() => new URLSearchParams(location.search).get("token") || "");
  const [restoring, setRestoring] = useState(
    () => ["login", "registration"].includes(mode) && !!getToken(),
  );
  const [restoreError, setRestoreError] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  useEffect(() => {
    if (!["login", "registration"].includes(mode)) return;
    const token = getToken();
    if (!token) {
      setRestoring(false);
      return;
    }
    if (hasCachedCalendar()) {
      navigate(CALENDAR_ROUTE, { replace: true });
      return;
    }
    const controller = new AbortController();
    setRestoring(true);
    setRestoreError(false);
    check(token, controller.signal)
      .then(({ token: refreshedToken }) => {
        if (controller.signal.aborted) return;
        if (getToken() !== token) {
          setRestoring(false);
          return;
        }
        setToken(refreshedToken);
        navigate(CALENDAR_ROUTE, { replace: true });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error.status === 401) {
          if (getToken() === token) clearToken();
        } else setRestoreError(true);
        setRestoring(false);
      });
    return () => controller.abort();
  }, [mode, navigate, restoreAttempt]);
  // Keep the recovery token in memory; remove it from the address and history.
  useEffect(() => {
    if (mode === "reset" && location.search) navigate(location.pathname, { replace: true });
  }, [mode, location.pathname, location.search, navigate]);
  useEffect(() => {
    if (mode !== "forgot") return;
    let active = true;
    recoveryStatus()
      .then(({ available }) => {
        if (active) setRecoveryAvailable(available);
      })
      .catch(() => {
        if (active) setRecoveryAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [mode]);
  async function handleSubmit(email, password) {
    setPending(true);
    setError("");
    try {
      if (mode === "forgot") {
        const result = await forgotPassword(email);
        if (!active.current) return;
        setSuccess(result.message);
        return;
      }
      if (mode === "reset") {
        const result = await resetPassword(resetToken, password);
        if (!active.current) return;
        clearToken();
        setSuccess(result.message);
        return;
      }
      const authenticate = location.pathname === LOGIN_ROUTE ? login : register;
      const { token } = await authenticate(email, password);
      if (!active.current) return;
      if (!token) throw new Error("The server did not return an access token");
      setToken(token);
      navigate(CALENDAR_ROUTE, { replace: true });
    } catch (error) {
      if (active.current) setError(error.message);
    } finally {
      if (active.current) setPending(false);
    }
  }
  if (restoring) return <CalendarLoading fullPage />;
  if (restoreError)
    return (
      <div className="p-4">
        <p role="alert">{t("Unable to connect to the server.")}</p>
        <button onClick={() => setRestoreAttempt((value) => value + 1)}>{t("Retry")}</button>
      </div>
    );
  return (
    <AuthLayout>
      <AuthForm
        mode={mode}
        onSubmit={handleSubmit}
        pending={pending}
        error={t(error)}
        success={t(success)}
        onRetry={() => {
          setSuccess("");
          setError("");
        }}
        invalidLink={mode === "reset" && !/^[a-f0-9]{64}$/.test(resetToken)}
        recoveryAvailable={recoveryAvailable}
      />
    </AuthLayout>
  );
}
