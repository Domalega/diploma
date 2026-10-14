import { useState } from "react";
import { Alert, Button } from "react-bootstrap";
import NavBar from "../components/NavBar";
import MainCalendar from "../components/MainCalendar";
import AddDateModal from "../components/AddDateModal";
import Footer from "../../../shared/components/Footer";
import colors from "../../../shared/config/colors";
import useDates from "../hooks/useDates";
import useDateNotifications from "../hooks/useDateNotifications";
import "../styles/Calendar.css";

export default function CalendarPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [notificationVersion, setNotificationVersion] = useState(0);
  const { dates, loading, error, reload, create, remove } = useDates();
  useDateNotifications(dates, notificationVersion);
  async function enableNotifications() {
    try {
      const permission = await Notification.requestPermission();
      setNotificationError(
        permission === "granted" ? "" : "Notifications are blocked in your browser.",
      );
      setNotificationVersion((value) => value + 1);
    } catch {
      setNotificationError("Notifications are unavailable in this browser.");
    }
  }
  return (
    <div className="wrapper">
      <header className="header">
        <NavBar dates={dates} onDelete={remove} />
      </header>
      <main className="main" style={{ background: colors.WrapperColorDark }}>
        <div className="d-flex flex-wrap justify-content-center gap-2">
          <Button onClick={() => setModalOpen(true)} style={{ background: colors.BgColorDark }}>
            Add date
          </Button>
          {"Notification" in window && (
            <Button onClick={enableNotifications} variant="outline-light">
              Enable notifications
            </Button>
          )}
        </div>
        {notificationError && (
          <Alert className="mt-3" variant="warning">
            {notificationError}
          </Alert>
        )}
        {error && (
          <Alert className="mt-3" variant="danger" role="alert">
            {error}{" "}
            <Button size="sm" onClick={() => reload()}>
              Retry
            </Button>
          </Alert>
        )}
        {loading && (
          <p role="status" className="text-light">
            Loading...
          </p>
        )}
        <div className="calendar-container" style={{ color: colors.TextColorDark }}>
          <MainCalendar dates={dates} />
        </div>
        {modalOpen && <AddDateModal open onClose={() => setModalOpen(false)} onCreate={create} />}
      </main>
      <footer className="footer">
        <Footer />
      </footer>
    </div>
  );
}
