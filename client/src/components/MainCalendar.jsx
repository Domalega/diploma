import React from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../styles/MainCalendar.css";
import colors from "../color";

const localizer = momentLocalizer(moment);
moment.locale("ru");

function CustomToolbar({ label, onView, onNavigate }) {
  return (
    <div className="containerBar">
      <div className="containerBar-label">{label}</div>
      <button
        onClick={() => onNavigate("PREV")}
        className="btn containerBar-btn_prev"
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
        className="btn containerBar-btn_next"
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
