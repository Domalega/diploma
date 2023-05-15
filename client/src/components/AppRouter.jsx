import React, { useContext, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Auth from "../pages/Auth";
import Calendar from "../pages/Calendar";
import { check } from "../api/api";
import {
  LOGIN_ROUTE,
  REGISTRATION_ROUTE,
  CALENDAR_ROUTE,
} from "../utils/const";

async function CheckAuth(token) {
  const response = await check(token);
  return response.ok;
}

function PrivateRoute(props) {
  const [component, setComponent] = useState(null);

  const token = localStorage.getItem("token");
  CheckAuth(token).then((auth) => {
    const ComponentToRender = auth
      ? props.component
      : () => <Navigate to="/login" replace />;
    setComponent(<ComponentToRender />);
  });

  return component;
}

const AppRouter = () => {
  return (
    <Routes>
      <Route path={LOGIN_ROUTE} element={<Auth />} />
      <Route path={REGISTRATION_ROUTE} element={<Auth />} />
      <Route
        path={CALENDAR_ROUTE}
        element={<PrivateRoute component={Calendar} />}
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRouter;
