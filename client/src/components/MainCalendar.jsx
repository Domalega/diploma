import React, { useState, useEffect } from "react";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../styles/MainCalendar.css";
import colors from "../utils/colors";
import { getAllDates } from "../api/api";

const localizer = momentLocalizer(moment);
moment.locale("ru");

function CustomToolbar(props) {
  const styles = {
    btn: {
      background: colors.BgColorDark,
      color: colors.TextColorDark,
      margin: 10,
    },
  };

  return (
    <div>
      <div className={`containerBar`}>
        <div className={`containerBar__label`}>{props.label}</div>
        <button
          onClick={() => props.onNavigate("PREV")}
          className={`btn containerBar__btn-prev`}
          style={styles.btn}
        >
          Previous
        </button>
        <button
          onClick={() => props.onNavigate("NEXT")}
          className={`btn containerBar__btn-next`}
          style={styles.btn}
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
      />
    </div>
  );
};

export default MainCalendar;
