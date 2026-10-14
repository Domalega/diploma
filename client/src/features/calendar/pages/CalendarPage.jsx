import { useEffect, useRef, useState } from "react";
import { Alert, Button, Offcanvas } from "react-bootstrap";
import {
  FiArrowLeft,
  FiArrowRight,
  FiPlus,
  FiEdit3,
  FiCalendar,
  FiList,
  FiCheck,
} from "react-icons/fi";
import NavBar from "../components/NavBar";
import MainCalendar from "../components/MainCalendar";
import NoteDetails from "../components/NoteDetails";
import NoteEditor from "../components/NoteEditor";
import DeleteNoteDialog from "../components/DeleteNoteDialog";
import NotesList from "../components/NotesList";
import useDates from "../hooks/useDates";
import useDateNotifications from "../hooks/useDateNotifications";
import useNotificationSettings from "../hooks/useNotificationSettings";
import useToday from "../hooks/useToday";
import InteractivePhrase from "../../../shared/components/InteractivePhrase";
import CalendarLoading from "../../../shared/components/CalendarLoading";
import { formatDay, formatMonth, monthStart, moveMonths, todayKey } from "../utils/calendarDates";
import "../styles/Calendar.css";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [month, setMonth] = useState(() => monthStart(todayKey()));
  const [view, setView] = useState("month");
  const [query, setQuery] = useState("");
  const [mobileDay, setMobileDay] = useState(false);
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState("");
  const newNoteButton = useRef(null);
  const queuedDialog = useRef(null);
  const dialogWasOpen = useRef(false);
  const today = useToday();
  useEffect(() => {
    const open = !!editor || !!deleting;
    if (!open && dialogWasOpen.current) newNoteButton.current?.focus();
    dialogWasOpen.current = open;
  }, [editor, deleting]);
  const { dates, loading, error, reload, create, update, remove } = useDates();
  const notifications = useNotificationSettings();
  useDateNotifications(dates, notifications.enabled, notifications.permission);
  const selectedNote = dates.find((note) => note.date === selectedDate);
  const ready = !loading && !error;
  const search = query.trim().toLocaleLowerCase();
  const filtered = dates
    .filter((note) =>
      search
        ? [note.comment || "", note.date, formatDay(note.date)].some((text) =>
            text.toLocaleLowerCase().includes(search),
          )
        : note.date.slice(0, 7) === month.slice(0, 7),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  function selectDay(date) {
    setSelectedDate(date);
    setMonth(monthStart(date));
    setMessage("");
    if (window.matchMedia("(max-width: 1000px)").matches) setMobileDay(true);
  }
  function editSelected() {
    openDialog(() => setEditor({ date: selectedDate, note: selectedNote }));
  }
  function openDialog(action) {
    if (mobileDay) {
      queuedDialog.current = action;
      setMobileDay(false);
    } else action();
  }
  const detailsProps = {
    date: selectedDate,
    note: selectedNote,
    ready,
    onEdit: editSelected,
    onDelete: () => {
      openDialog(() => setDeleting(selectedDate));
    },
  };
  const searching = !!search;
  return (
    <div className="planner">
      <NavBar query={query} onQueryChange={setQuery} notifications={notifications} />
      <main id="planner-main" tabIndex={-1} className="planner-main">
        <div className="planner-intro">
          <div>
            <h1>
              Your <em>calendar.</em>
            </h1>
          </div>
          <Button
            ref={newNoteButton}
            className="theme-button new-note-button"
            disabled={!ready}
            onClick={editSelected}
          >
            {selectedNote ? <FiEdit3 aria-hidden="true" /> : <FiPlus aria-hidden="true" />}
            {selectedNote ? "Edit note" : "New note"}
          </Button>
        </div>
        <div className="planner-feedback" role="status" aria-live="polite">
          {message && (
            <>
              <FiCheck aria-hidden="true" />
              {message}
            </>
          )}
        </div>
        {error && (
          <Alert variant="danger" role="alert" className="planner-error">
            {error}
            <Button
              className="theme-button-outline ms-3"
              variant="outline-secondary"
              onClick={() => reload()}
            >
              Try again
            </Button>
          </Alert>
        )}
        <div className="planner-layout">
          <section className="calendar-card" aria-label="Your calendar" aria-busy={loading}>
            <div className="calendar-toolbar">
              <div className="month-navigation">
                <h2 aria-live="polite" aria-atomic="true">
                  {searching ? "Find your notes" : formatMonth(month)}
                </h2>
                {!searching && (
                  <div className="month-buttons">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Previous month"
                      onClick={() => setMonth(moveMonths(month, -1))}
                    >
                      <FiArrowLeft aria-hidden="true" />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Next month"
                      onClick={() => setMonth(moveMonths(month, 1))}
                    >
                      <FiArrowRight aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
              <div className="calendar-view-actions">
                <Button
                  variant="outline-secondary"
                  className="theme-button-outline today-button"
                  onClick={() => {
                    setMonth(monthStart(todayKey()));
                    setSelectedDate(todayKey());
                    setQuery("");
                  }}
                >
                  Today
                </Button>
                <div className="view-switch" role="group" aria-label="Calendar view">
                  <button
                    type="button"
                    aria-pressed={!searching && view === "month"}
                    onClick={() => {
                      setView("month");
                      setQuery("");
                    }}
                  >
                    <FiCalendar aria-hidden="true" />
                    Month
                  </button>
                  <button
                    type="button"
                    aria-pressed={searching || view === "list"}
                    onClick={() => setView("list")}
                  >
                    <FiList aria-hidden="true" />
                    List
                  </button>
                </div>
              </div>
            </div>
            {loading && !dates.length ? (
              <CalendarLoading label="Bringing your notes together…" />
            ) : searching || view === "list" ? (
              <NotesList
                notes={filtered}
                selectedDate={selectedDate}
                onSelect={selectDay}
                query={searching ? query.trim() : ""}
                month={month}
                today={today}
              />
            ) : (
              <MainCalendar
                today={today}
                month={month}
                selectedDate={selectedDate}
                dates={dates}
                onSelect={selectDay}
                onMonthChange={(date) => setMonth(monthStart(date))}
              />
            )}
            {!loading && !error && !dates.length && !searching && view === "month" && (
              <p className="calendar-empty-hint">
                Your calendar is a fresh page. Choose a day to leave your first note.
              </p>
            )}
          </section>
          <aside className="desktop-day-panel" aria-label="Selected day">
            <NoteDetails {...detailsProps} />
          </aside>
        </div>
        <footer className="planner-footer">
          <InteractivePhrase />
          <span>Made by Domalega</span>
        </footer>
      </main>
      <Offcanvas
        show={mobileDay}
        onHide={() => setMobileDay(false)}
        onExited={() => {
          const action = queuedDialog.current;
          queuedDialog.current = null;
          action?.();
        }}
        placement="end"
        aria-labelledby="mobile-day-title"
        className="planner-drawer mobile-day-drawer"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title id="mobile-day-title">Your selected day</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <NoteDetails {...detailsProps} />
        </Offcanvas.Body>
      </Offcanvas>
      {editor && (
        <NoteEditor
          {...editor}
          onCreate={create}
          onUpdate={update}
          onClose={() => setEditor(null)}
          onSaved={(date) => {
            setEditor(null);
            setSelectedDate(date);
            setMonth(monthStart(date));
            setMessage("Note saved.");
          }}
        />
      )}
      {deleting && (
        <DeleteNoteDialog
          date={deleting}
          onDelete={remove}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            setMessage("Note deleted.");
          }}
        />
      )}
    </div>
  );
}
