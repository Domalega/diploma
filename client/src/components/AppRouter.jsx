import React, { useContext } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Context } from "../";
import Auth from "../pages/Auth";
import Calendar from "../pages/Calendar";
import Date from "../pages/Date";

import {
  LOGIN_ROUTE,
  REGISTRATION_ROUTE,
  CALENDAR_ROUTE,
  DATE_ROUTE,
} from "../utils/const";

const AppRouter = () => {
  const { user } = useContext(Context);
  console.log(user);

  return (
    <Routes>
      <Route path={LOGIN_ROUTE} element={<Auth />} />
      <Route path={REGISTRATION_ROUTE} element={<Auth />} />
      <Route path={CALENDAR_ROUTE} element={<Calendar />} />

      {user.isAuth && <Route path={DATE_ROUTE} element={<Date />} />}

      <Route path="*" element={<Navigate to="/Calendar" replace />} />
    </Routes>
  );
};

export default AppRouter;
