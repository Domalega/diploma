import React, { useState, useEffect } from "react";
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
  try {
    const response = await check(token);
    return response.ok;
  } catch (error) {
    console.log(error);
  }
}

function PrivateRoute(props) {
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    CheckAuth(token).then((auth) => {
      setAuth(auth);
    });
  }, []);

  if (auth === null)
    return (
      <div class="d-flex justify-content-center align-items-center">
        <p>Loading...</p>
      </div>
    );

  const ComponentToRender = auth
    ? props.component
    : () => <Navigate to={LOGIN_ROUTE} replace />;

  return <ComponentToRender />;
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
      <Route path="*" element={<Navigate to={LOGIN_ROUTE} replace />} />
    </Routes>
  );
};

export default AppRouter;
