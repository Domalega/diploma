import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "moment/locale/ru";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../styles/MainCalendar.css";

moment.locale("ru");
const localizer = momentLocalizer(moment);

function CalendarToolbar({ label, onNavigate }) {
  return (
    <div className="containerBar">
      <div className="containerBar__label">{label}</div>
      <button
        onClick={() => onNavigate("PREV")}
        className="btn theme-button-outline containerBar__btn-prev"
      >
        Previous
      </button>
      <button
        onClick={() => onNavigate("NEXT")}
        className="btn theme-button-outline containerBar__btn-next"
      >
        Next
      </button>
    </div>
  );
}

export default function MainCalendar({ dates }) {
  const events = dates.map((item) => ({
    id: item.id,
    start: moment(item.date).toDate(),
    end: moment(item.date).toDate(),
    title: item.comment || "Note",
    allDay: true,
  }));
  return (
    <Calendar
      events={events}
      components={{ toolbar: CalendarToolbar }}
      views={["month"]}
      culture="ru"
      localizer={localizer}
      startAccessor="start"
      endAccessor="end"
      style={{ height: 500, width: "100%" }}
    />
  );
}
