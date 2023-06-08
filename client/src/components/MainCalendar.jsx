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
    function checkPermission() {
      let granted = false;
      if (Notification.permission === "granted") {
        granted = true;
      } else if (Notification.permission !== "denied") {
        let permission = Notification.requestPermission();
        granted = permission === "granted" ? true : false;
      }
      return granted;
    }

    function ShowNotification(comment) {
      try {
        var notification = new Notification("Today", {
          body: `${comment}`,
          icon: "%PUBLIC_URL%/../logo.png",
        });
        notification.onclick = function () {
          window.focus();
          this.close();
        };
      } catch (error) {
        console.log(error);
      }
    }

    function ShowError() {
      alert("You block notification!");
    }

    async function getData() {
      try {
        const token = localStorage.getItem("token");
        const response = await getAllDates(token);
        const data = await response.json();

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        const formattedDate = `${year}-${month}-${day}`;

        data.forEach((item) => {
          console.log(item);
          if (item.date === formattedDate) {
            const granted = checkPermission();
            granted ? ShowNotification(item.comment) : ShowError();
          }
        });

        const tempEvents = data.map((item) => ({
          start: moment(item.date).toDate(),
          end: moment(item.date).toDate(),
          title: item.comment,
        }));
        setEvents(tempEvents);
      } catch (error) {
        alert("Can`t get you`r dates");
        console.log(error);
      }
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
        style={{ height: 500, maxWidth: 580 }}
        eventPropGetter={eventStyleGetter}
      />
    </div>
  );
};

export default MainCalendar;
