import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { check } from "../api/authApi";
import { clearToken, getToken, setToken } from "../../../shared/api/tokenStorage";
import { LOGIN_ROUTE } from "../../../shared/config/routes";
import CalendarLoading from "../../../shared/components/CalendarLoading";
import { hasCachedCalendar, tokenOwner } from "../../../shared/api/browserCache";
import { isOfflineApp } from "../../../shared/offline/bridge";

export default function ProtectedRoute({ children }) {
  const { t } = useLanguage();

  const [status, setStatus] = useState(() => (hasCachedCalendar() ? "authorized" : "loading"));
  const [backgroundError, setBackgroundError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setStatus("unauthorized");
      return;
    }
    const controller = new AbortController();
    const cached = hasCachedCalendar();
    setStatus(cached ? "authorized" : "loading");
    setBackgroundError(false);
    check(token, controller.signal)
      .then(({ token: refreshedToken }) => {
        if (controller.signal.aborted) return;
        if (getToken() !== token) {
          setStatus("unauthorized");
          return;
        }
        setToken(refreshedToken);
        setStatus("authorized");
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          if (error.status === 401 && getToken() === token) clearToken();
          if (error.status === 401 || getToken() !== token) setStatus("unauthorized");
          else if (cached) setBackgroundError(true);
          else setStatus("error");
        }
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    if (isOfflineApp()) return;
    const refresh = () => setAttempt((value) => value + 1);
    const sessionChanged = (event) => {
      if (event.key !== "token" && event.key !== null) return;
      if (!getToken()) setStatus("unauthorized");
      else if (tokenOwner(event.oldValue) !== tokenOwner(getToken())) {
        setStatus("loading");
        refresh();
      }
    };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", sessionChanged);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", sessionChanged);
    };
  }, []);

  if (status === "loading") return <CalendarLoading fullPage />;
  if (status === "error")
    return (
      <div className="p-4">
        <p role="alert">{t("Unable to connect to the server.")}</p>
        <button onClick={() => setAttempt((value) => value + 1)}>{t("Retry")}</button>
      </div>
    );
  if (status === "unauthorized") return <Navigate to={LOGIN_ROUTE} replace />;
  return (
    <>
      {backgroundError && (
        <div className="p-2 text-center" role="status">
          {t("Showing saved data. Unable to refresh from the server.")}{" "}
          <button onClick={() => setAttempt((value) => value + 1)}>{t("Retry")}</button>
        </div>
      )}
      {children}
    </>
  );
}
