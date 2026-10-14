import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Offcanvas } from "react-bootstrap";
import { FiUser, FiLogOut, FiBell } from "react-icons/fi";
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
        aria-label="Account"
        variant="outline-secondary"
        className="theme-button-outline account-button"
        onClick={() => setShow(true)}
      >
        <FiUser aria-hidden="true" />
        <span>Account</span>
      </Button>
      <Offcanvas
        show={show}
        onHide={() => setShow(false)}
        placement="end"
        aria-labelledby="account-title"
        className="planner-drawer"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title id="account-title">Your account</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <section className="account-section">
            <h2>
              <FiBell aria-hidden="true" /> Notifications
            </h2>
            <p>Reminders for today's note appear while this calendar is open.</p>
            {!supported ? (
              <p>Notifications are unavailable in this browser.</p>
            ) : permission === "granted" ? (
              <label className="notification-toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                />
                Remind me about today's note
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
