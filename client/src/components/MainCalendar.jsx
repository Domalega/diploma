import React from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../styles/MainCalendar.css";
import colors from "../utils/colors";
import useMobileDetection from "../utils/resizeHook";
const localizer = momentLocalizer(moment);
moment.locale("ru");

function CustomToolbar({ label, onView, onNavigate }) {
  const isMobile = useMobileDetection();
  const classes = isMobile ? "mobile-style" : "desktop-style";

  return (
    <div className={`containerBar-${classes}`}>
      <div className={`containerBar__label-${classes}`}>{label}</div>
      <button
        onClick={() => onNavigate("PREV")}
        className={`btn containerBar__btn-prev-${classes}`}
        style={{
          background: colors.BgColorDark,
          color: colors.TextColorDark,
          margin: 10,
        }}
      >
        Previous
      </button>
      <button
        onClick={() => onNavigate("NEXT")}
        className={`btn containerBar__btn-next-${classes}`}
        style={{
          background: colors.BgColorDark,
          color: colors.TextColorDark,
          margin: 10,
        }}
      >
        Next
      </button>
    </div>
  );
}

const MainCalendar = () => {
  const components = {
    toolbar: CustomToolbar,
  };

  return (
    <div>
      <Calendar
        components={components}
        views={["month"]}
        localizer={localizer}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 500 }}
      />
    </div>
  );
};

export default MainCalendar;
