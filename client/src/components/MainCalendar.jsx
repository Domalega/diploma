import React, { useState, useEffect } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../styles/MainCalendar.css";
import colors from "../utils/colors";
import useMobileDetection from "../utils/resizeHook";
import { getAllDates } from "../api/api";

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
          Previous
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
          Next
        </button>
      </div>
    </div>
  );
}

const MainCalendar = (props) => {
  const components = {
    toolbar: CustomToolbar,
  };

  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    async function getData() {
      const token = localStorage.getItem("token");
      const response = await getAllDates(token);
      const data = await response.json();
      const tempEvents = data.map((item) => ({
        start: moment(item.date).toDate(),
        end: moment(item.date).toDate(),
        title: item.comment,
      }));
      setEvents(tempEvents);
    }
    getData();
  }, []);

  const eventStyleGetter = () => {
    return {
      style: {
        height: "150px",
      },
    };
  };

  const handleSelectSlot = ({ start }) => {
    console.log(start);
    setSelectedDate(start);
  };

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
        eventPropGetter={eventStyleGetter}
        onSelectEvent={handleSelectSlot}
      />
    </div>
  );
};

export default MainCalendar;
