import Auth from "./pages/Auth";
import Calendar from "./pages/Calendar";
import Date from "./pages/Date";
import { LOGIN_ROUTE, REGISTRATION_ROUTE, CALENDAR_ROUTE, DATE_ROUTE } from "./utils/const";

export const authRoutes =[
    {
        path: LOGIN_ROUTE,
        Comment: Auth
    },
    {
        path: REGISTRATION_ROUTE,
        Comment: Auth
    },
    {
        path: CALENDAR_ROUTE,
        Comment: Calendar
    },
    {
        path: DATE_ROUTE +'/:id',
        Comment: Date
    },
]