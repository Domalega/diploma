import Auth from "./pages/Auth";
import Calendar from "./pages/Calendar";
import Date from "./pages/Date";
import {
  LOGIN_ROUTE,
  REGISTRATION_ROUTE,
  CALENDAR_ROUTE,
  DATE_ROUTE,
} from "./utils/const";

export const authRoutes = [
  {
    path: LOGIN_ROUTE,
    Component: Auth,
  },
  {
    path: REGISTRATION_ROUTE,
    Component: Auth,
  },
  {
    path: CALENDAR_ROUTE,
    Component: Calendar,
  },
  {
    path: DATE_ROUTE + "/:id",
    Component: Date,
  },
];

export const publicRoutes = [
  {
    path: LOGIN_ROUTE,
    Component: Auth,
  },
  {
    path: REGISTRATION_ROUTE,
    Component: Auth,
  },
  {
    path: CALENDAR_ROUTE,
    Component: Calendar,
  },
];
