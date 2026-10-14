import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Offcanvas } from "react-bootstrap";
import { FiSettings, FiLogOut, FiBell, FiSun } from "react-icons/fi";
import ThemeSwitcher from "../../../shared/theme/ThemeSwitcher";
import { clearToken } from "../../../shared/api/tokenStorage";
import { LOGIN_ROUTE } from "../../../shared/config/routes";
export default function ProfileSidebar({ notifications = { supported: false } }) {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const { supported, permission, enabled, pending, error, setEnabled, requestPermission } =
    notifications;
  return (
    <>
      <Button
        aria-label="Settings"
        variant="outline-secondary"
        className="theme-button-outline account-button"
        onClick={() => setShow(true)}
      >
        <FiSettings aria-hidden="true" />
        <span>Settings</span>
      </Button>
      <Offcanvas
        show={show}
        onHide={() => setShow(false)}
        placement="end"
        aria-labelledby="account-title"
        className="planner-drawer"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title id="account-title">Settings</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <section className="account-section settings-appearance">
            <h2>
              <FiSun aria-hidden="true" /> Appearance
            </h2>
            <ThemeSwitcher />
          </section>
          <section className="account-section">
            <h2>
              <FiBell aria-hidden="true" /> Notifications
            </h2>
            <p>
              Timed notes remind you when their time arrives. All-day notes remind you when you open
              the calendar. Keep the calendar open to receive reminders.
            </p>
            {!supported ? (
              <p>Notifications are unavailable in this browser.</p>
            ) : permission === "granted" ? (
              <label className="notification-toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                />
                Remind me about today's notes
              </label>
            ) : permission === "denied" ? (
              <p>
                Blocked by your browser. You can allow notifications in this site's browser
                settings.
              </p>
            ) : (
              <Button className="theme-button" disabled={pending} onClick={requestPermission}>
                {pending ? "Waiting for permission…" : "Enable notifications"}
              </Button>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </section>
          <Button
            variant="outline-secondary"
            className="theme-button-outline sign-out-button"
            onClick={() => {
              clearToken();
              navigate(LOGIN_ROUTE, { replace: true });
            }}
          >
            <FiLogOut aria-hidden="true" />
            Sign out
          </Button>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
