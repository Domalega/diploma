import { Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "../features/auth/pages/AuthPage";
import ProtectedRoute from "../features/auth/components/ProtectedRoute";
import CalendarPage from "../features/calendar/pages/CalendarPage";
import EncryptionGate from "../shared/encryption/EncryptionGate";
import {
  LOGIN_ROUTE,
  REGISTRATION_ROUTE,
  CALENDAR_ROUTE,
  FORGOT_PASSWORD_ROUTE,
  RESET_PASSWORD_ROUTE,
} from "../shared/config/routes";

export default function AppRouter() {
  return (
    <Routes>
      <Route path={LOGIN_ROUTE} element={<AuthPage key="login" />} />
      <Route path={REGISTRATION_ROUTE} element={<AuthPage key="registration" />} />
      <Route path={FORGOT_PASSWORD_ROUTE} element={<AuthPage key="forgot" />} />
      <Route path={RESET_PASSWORD_ROUTE} element={<AuthPage key="reset" />} />
      <Route
        path={CALENDAR_ROUTE}
        element={
          <ProtectedRoute>
            <EncryptionGate>
              <CalendarPage />
            </EncryptionGate>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={CALENDAR_ROUTE} replace />} />
    </Routes>
  );
}
