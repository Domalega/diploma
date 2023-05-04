import React, { useState } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../styles/MainCalendar.css";
import colors from "../utils/colors";
import useMobileDetection from "../utils/resizeHook";

const localizer = momentLocalizer(moment);
moment.locale("ru");

function CustomToolbar(props) {
  const isMobile = useMobileDetection();
  const classes = isMobile ? "mobile-style" : "desktop-style";

  return (
    <div>
      <div className={`containerBar-${classes}`}>
        <div className={`containerBar__label-${classes}`}>{props.label}</div>
        <button
          onClick={() => props.onNavigate("PREV")}
          className={`btn containerBar__btn-prev-${classes}`}
          style={{
            background: colors.BgColorDark,
            color: colors.TextColorDark,
            margin: 10,
          }}
        >
          Предыдущий
        </button>
        <button
          onClick={() => props.onNavigate("NEXT")}
          className={`btn containerBar__btn-next-${classes}`}
          style={{
            background: colors.BgColorDark,
            color: colors.TextColorDark,
            margin: 10,
          }}
        >
          Следующий
        </button>
      </div>
    </div>
  );
}

const MainCalendar = (props) => {
  const components = {
    toolbar: CustomToolbar,
  };

  const events = [
    {
      start: moment("2023-04-18").toDate(),
      end: moment("2023-04-18").toDate(),
      title: "test",
    },
  ];

  return (
    <div>
      <Calendar
        events={events}
        components={components}
        views={["month"]}
        localizer={localizer}
        startAccessor="start"
        endAccessor="end"
        selectable="true"
        style={{ height: 500, zIndex: 2 }}
      />
    </div>
  );
};

export default MainCalendar;
