import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { check } from "../api/authApi";
import { getToken, setToken } from "../../../shared/api/tokenStorage";
import { LOGIN_ROUTE } from "../../../shared/config/routes";
import CalendarLoading from "../../../shared/components/CalendarLoading";

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setStatus("unauthorized");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    check(token, controller.signal)
      .then(({ token: refreshedToken }) => {
        if (controller.signal.aborted) return;
        setToken(refreshedToken);
        setStatus("authorized");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setStatus(error.status === 401 ? "unauthorized" : "error");
      });
    return () => controller.abort();
  }, [attempt]);

  if (status === "loading") return <CalendarLoading fullPage />;
  if (status === "error")
    return (
      <div className="p-4">
        <p role="alert">Unable to connect to the server.</p>
        <button onClick={() => setAttempt((value) => value + 1)}>Retry</button>
      </div>
    );
  if (status === "unauthorized") return <Navigate to={LOGIN_ROUTE} replace />;
  return children;
}
