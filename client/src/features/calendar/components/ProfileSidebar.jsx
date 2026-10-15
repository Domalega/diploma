import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Offcanvas } from "react-bootstrap";
import { FiSettings, FiLogOut, FiBell, FiSun, FiZap } from "react-icons/fi";
import ThemeSwitcher from "../../../shared/theme/ThemeSwitcher";
import LanguageSwitcher from "../../../shared/i18n/LanguageSwitcher";
import { clearToken } from "../../../shared/api/tokenStorage";
import { LOGIN_ROUTE } from "../../../shared/config/routes";
export default function ProfileSidebar({
  notifications = { supported: false },
  medications,
  onMedicationConfigure,
}) {
  const { t } = useLanguage();

  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  const queued = useRef(null);
  const experimentalBusy = !medications || medications.loading || medications.pending;
  const { supported, permission, enabled, pending, error, setEnabled, requestPermission } =
    notifications;
  return (
    <>
      <Button
        aria-label={t("Settings")}
        variant="outline-secondary"
        className="theme-button-outline account-button"
        onClick={() => setShow(true)}
      >
        <FiSettings aria-hidden="true" />
        <span>{t("Settings")}</span>
      </Button>
      <Offcanvas
        show={show}
        onHide={() => setShow(false)}
        placement="end"
        aria-labelledby="account-title"
        className="planner-drawer"
        onExited={() => {
          const action = queued.current;
          queued.current = null;
          action?.();
        }}
      >
        <Offcanvas.Header closeButton closeLabel={t("Close")}>
          <Offcanvas.Title id="account-title">{t("Settings")}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <section className="account-section settings-appearance">
            <h2>
              <FiSun aria-hidden="true" />
              {" " + t("Appearance")}
            </h2>
            <ThemeSwitcher />
          </section>
          <section className="account-section">
            <LanguageSwitcher />
          </section>
          <section className="account-section">
            <h2>
              <FiBell aria-hidden="true" />
              {" " + t("Notifications")}
            </h2>
            <p>
              {t(
                "Timed notes remind you when their time arrives. All-day notes remind you when you open the calendar. Keep the calendar open to receive reminders.",
              )}
            </p>
            {!supported ? (
              <p>{t("Notifications are unavailable in this browser.")}</p>
            ) : permission === "granted" ? (
              <label className="notification-toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                />
                {t("Remind me about today's notes")}
              </label>
            ) : permission === "denied" ? (
              <p>
                {t(
                  "Blocked by your browser. You can allow notifications in this site's browser settings.",
                )}
              </p>
            ) : (
              <Button className="theme-button" disabled={pending} onClick={requestPermission}>
                {pending ? t("Waiting for permission…") : t("Enable notifications")}
              </Button>
            )}
            {error && (
              <p className="form-error" role="alert">
                {t(error)}
              </p>
            )}
          </section>
          <section className="account-section experimental-options">
            <h2>
              <FiZap aria-hidden="true" />
              {t("Experimental options")}
            </h2>
            <label className="notification-toggle">
              <input
                type="checkbox"
                checked={!!medications?.plan.enabled}
                disabled={experimentalBusy}
                onChange={(event) =>
                  medications.savePlan({ enabled: event.target.checked }).catch(() => {})
                }
              />
              <span>{t("Medication tracker")}</span>
            </label>
            <p>{t("A personal intake table with repeating weekdays and time-based columns.")}</p>
            {medications?.error && (
              <div className="form-error" role="alert">
                <p>{t(medications.error)}</p>
                <Button
                  variant="outline-secondary"
                  className="theme-button-outline"
                  disabled={medications.pending}
                  onClick={medications.reload}
                >
                  {t("Reload tracker")}
                </Button>
              </div>
            )}
            {medications?.plan.enabled && (
              <>
                <label className="notification-toggle">
                  <input
                    type="checkbox"
                    checked={medications.plan.reminders}
                    disabled={experimentalBusy || !supported}
                    onChange={(event) =>
                      medications.savePlan({ reminders: event.target.checked }).catch(() => {})
                    }
                  />
                  <span>{t("Medication reminders")}</span>
                </label>
                <p>
                  {t(
                    "Reminds you about unchecked items once their time arrives. Keep the calendar open to receive reminders.",
                  )}
                </p>
                {medications.plan.reminders && permission === "default" && (
                  <Button
                    className="theme-button-outline mb-3"
                    variant="outline-secondary"
                    disabled={pending}
                    onClick={() => requestPermission(false)}
                  >
                    {pending ? t("Waiting for permission…") : t("Allow browser reminders")}
                  </Button>
                )}
                {medications.plan.reminders && permission === "denied" && (
                  <p>
                    {t(
                      "Allow notifications for this site in your browser settings to receive reminders.",
                    )}
                  </p>
                )}
                <Button
                  className="theme-button-outline"
                  variant="outline-secondary"
                  disabled={experimentalBusy}
                  onClick={() => {
                    queued.current = () => onMedicationConfigure?.({ section: "medications" });
                    setShow(false);
                  }}
                >
                  {t("Configure medication tracker")}
                </Button>
              </>
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
            {t("Sign out")}
          </Button>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
