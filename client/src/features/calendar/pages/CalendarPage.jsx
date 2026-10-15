import { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import {
  FiArrowLeft,
  FiArrowRight,
  FiPlus,
  FiCalendar,
  FiList,
  FiCheck,
  FiClock,
  FiFileText,
  FiGrid,
  FiMaximize2,
  FiSettings,
} from "react-icons/fi";
import DashboardBoard from "../components/DashboardBoard";
import CurrentDateTile from "../components/CurrentDateTile";
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
import { compareNotes } from "../utils/noteTimes";
import useMedicationTracker from "../../medications/hooks/useMedicationTracker";
import useMedicationReminders from "../../medications/hooks/useMedicationReminders";
import MedicationManager from "../../medications/components/MedicationManager";
import MedicationMatrix from "../../medications/components/MedicationMatrix";
import "../styles/Calendar.css";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [month, setMonth] = useState(() => monthStart(todayKey()));
  const [view, setView] = useState("month");
  const [query, setQuery] = useState("");
  const notesPanel = useRef(null);
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState("");
  const [medicationManager, setMedicationManager] = useState(null);
  const [medicationExpanded, setMedicationExpanded] = useState(false);
  const newNoteButton = useRef(null);
  const queuedDialog = useRef(null);
  const dialogWasOpen = useRef(false);
  const today = useToday();
  useEffect(() => {
    const open = !!editor || !!deleting || !!medicationManager || medicationExpanded;
    if (!open && dialogWasOpen.current) newNoteButton.current?.focus();
    dialogWasOpen.current = open;
  }, [editor, deleting, medicationManager, medicationExpanded]);
  const { dates, loading, error, reload, create, update, remove } = useDates();
  const notifications = useNotificationSettings();
  useDateNotifications(dates, notifications.enabled, notifications.permission);
  const medications = useMedicationTracker(selectedDate, today);
  useMedicationReminders(
    medications.plan,
    medications.todayRecords,
    notifications.permission,
    !medications.loading && !medications.pending && !medications.error,
    today,
  );
  const selectedNotes = dates.filter((note) => note.date === selectedDate).sort(compareNotes);
  const ready = !loading && !error;
  const search = query.trim().toLocaleLowerCase();
  const filtered = dates
    .filter((note) =>
      search
        ? [note.comment || "", note.date, note.time || "All day", formatDay(note.date)].some(
            (text) => text.toLocaleLowerCase().includes(search),
          )
        : note.date.slice(0, 7) === month.slice(0, 7),
    )
    .sort(compareNotes);
  function selectDay(date, noteId = null) {
    setSelectedDate(date);
    setSelectedNoteId(noteId);
    setMonth(monthStart(date));
    setMessage("");
    if (window.matchMedia("(max-width: 1000px)").matches) {
      notesPanel.current?.focus({ preventScroll: true });
      notesPanel.current?.scrollIntoView?.({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
  }
  function addNote() {
    setEditor({ date: selectedDate });
  }
  function configureMedications(intent) {
    if (medicationExpanded) {
      queuedDialog.current = () => setMedicationManager(intent);
      setMedicationExpanded(false);
    } else setMedicationManager(intent);
  }
  const detailsProps = {
    date: selectedDate,
    notes: selectedNotes,
    selectedNoteId,
    ready,
    onAdd: addNote,
    onEdit: (note) => setEditor({ date: note.date, note }),
    onDelete: setDeleting,
  };
  const searching = !!search;
  const calendarPanel = (
    <div className="calendar-card" aria-busy={loading}>
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
              setSelectedNoteId(null);
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
          selectedNoteId={selectedNoteId}
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
    </div>
  );
  return (
    <div className="planner">
      <NavBar
        query={query}
        onQueryChange={setQuery}
        notifications={notifications}
        medications={medications}
        onMedicationConfigure={configureMedications}
      />
      <main id="planner-main" tabIndex={-1} className="planner-main">
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
        <DashboardBoard
          heading={
            <h1>
              Your <em>calendar.</em>
            </h1>
          }
          primaryAction={
            <Button
              ref={newNoteButton}
              className="theme-button new-note-button"
              disabled={!ready}
              onClick={addNote}
            >
              <FiPlus aria-hidden="true" />
              New note
            </Button>
          }
          panels={{
            calendar: { title: "Calendar", icon: <FiCalendar />, content: calendarPanel },
            today: {
              title: "Today",
              icon: <FiClock />,
              content: (
                <CurrentDateTile
                  today={today}
                  onToday={() => {
                    setMonth(monthStart(today));
                    setSelectedDate(today);
                    setSelectedNoteId(null);
                    setQuery("");
                  }}
                />
              ),
            },
            notes: {
              title: "Notes",
              icon: <FiFileText />,
              subtitle: formatDay(selectedDate),
              content: (
                <div
                  ref={notesPanel}
                  className="notes-panel-content"
                  tabIndex={-1}
                  aria-label="Selected day notes"
                >
                  <NoteDetails {...detailsProps} />
                </div>
              ),
            },
            medications: medications.plan.enabled
              ? {
                  title: "Medication tracker",
                  icon: <FiGrid />,
                  subtitle: formatDay(selectedDate),
                  actions: (
                    <>
                      <span className="experimental-badge">Experimental</span>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Expand medication tracker"
                        onClick={() => setMedicationExpanded(true)}
                      >
                        <FiMaximize2 aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Manage medication schedule"
                        onClick={() => configureMedications({ section: "medications" })}
                      >
                        <FiSettings aria-hidden="true" />
                      </button>
                    </>
                  ),
                  content: (
                    <MedicationMatrix
                      tracker={medications}
                      date={selectedDate}
                      onConfigure={configureMedications}
                      standalone
                    />
                  ),
                }
              : null,
          }}
        />
        <footer className="planner-footer">
          <InteractivePhrase />
          <a
            className="creator-link"
            href="https://github.com/Domalega"
            target="_blank"
            rel="noopener noreferrer"
          >
            Made by Domalega
          </a>
        </footer>
      </main>
      {editor && (
        <NoteEditor
          {...editor}
          onCreate={create}
          onUpdate={update}
          onClose={() => setEditor(null)}
          onSaved={(date) => {
            setEditor(null);
            setSelectedDate(date);
            setSelectedNoteId(editor.note?.id || null);
            setMonth(monthStart(date));
            setMessage("Note saved.");
          }}
        />
      )}
      {deleting && (
        <DeleteNoteDialog
          note={deleting}
          onDelete={remove}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            setSelectedNoteId(null);
            setMessage("Note deleted.");
          }}
        />
      )}
      {medicationManager && (
        <MedicationManager
          tracker={medications}
          intent={medicationManager}
          onClose={() => setMedicationManager(null)}
        />
      )}
      <Modal
        show={medicationExpanded}
        onHide={() => setMedicationExpanded(false)}
        onExited={() => {
          const action = queuedDialog.current;
          queuedDialog.current = null;
          action?.();
        }}
        fullscreen="sm-down"
        centered
        restoreFocus={false}
        aria-labelledby="medication-expanded-title"
        className="planner-modal medication-expanded-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title id="medication-expanded-title">
            Medication tracker · {formatDay(selectedDate)}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <MedicationMatrix
            tracker={medications}
            date={selectedDate}
            onConfigure={configureMedications}
            expanded
          />
        </Modal.Body>
      </Modal>
    </div>
  );
}
