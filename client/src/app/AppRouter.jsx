import { Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "../features/auth/pages/AuthPage";
import ProtectedRoute from "../features/auth/components/ProtectedRoute";
import CalendarPage from "../features/calendar/pages/CalendarPage";
import { LOGIN_ROUTE, REGISTRATION_ROUTE, CALENDAR_ROUTE } from "../shared/config/routes";

export default function AppRouter() {
  return (
    <Routes>
      <Route path={LOGIN_ROUTE} element={<AuthPage />} />
      <Route path={REGISTRATION_ROUTE} element={<AuthPage />} />
      <Route
        path={CALENDAR_ROUTE}
        element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={LOGIN_ROUTE} replace />} />
    </Routes>
  );
}
