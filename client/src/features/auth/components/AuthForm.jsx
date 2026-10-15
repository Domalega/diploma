import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { FiArrowRight, FiArrowLeft, FiCheck, FiMail, FiLock } from "react-icons/fi";
import PasswordField from "./PasswordField";
import {
  LOGIN_ROUTE,
  REGISTRATION_ROUTE,
  FORGOT_PASSWORD_ROUTE,
} from "../../../shared/config/routes";

const copy = {
  login: {
    heading: "Welcome back.",
    description: "A fresh day. Your plans, right where you left them.",
    button: "Log in",
  },
  registration: {
    heading: "Make room for your plans.",
    description: "Create an account and start with your first note.",
    button: "Create account",
  },
  forgot: {
    heading: "Forgot your password?",
    description: "It happens. Enter your email and we’ll send you a reset link.",
    button: "Send reset link",
  },
  reset: {
    heading: "A fresh start.",
    description: "Choose a new password to get back to your calendar.",
    button: "Update password",
  },
};

export default function AuthForm({
  mode,
  onSubmit,
  pending,
  error,
  success,
  invalidLink,
  onRetry,
  recoveryAvailable,
}) {
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [validationError, setValidationError] = useState("");
  const isNew = mode === "registration" || mode === "reset";
  const isRecovery = mode === "forgot" || mode === "reset";
  const text = copy[mode];
  function submit(event) {
    event.preventDefault();
    if (pending) return;
    setValidationError("");
    if (mode !== "forgot" && new Blob([password]).size > 72)
      return setValidationError("This password is too long. Try a shorter phrase.");
    if (isNew && password !== confirmation)
      return setValidationError("The passwords do not match.");
    onSubmit(email.trim(), password);
  }
  if (success) {
    return (
      <div className="auth-result" role="status" aria-label={t("Account status")}>
        <span className="auth-result-icon">
          {mode === "forgot" ? <FiMail aria-hidden="true" /> : <FiCheck aria-hidden="true" />}
        </span>
        <span className="auth-eyebrow">
          {mode === "forgot" ? t("CHECK YOUR INBOX") : t("ALL SET")}
        </span>
        <h2>
          {mode === "forgot" ? t("Your next step is in your inbox.") : t("Password updated.")}
        </h2>
        <p>{t(success)}</p>
        {mode === "forgot" && (
          <p className="auth-hint">
            {t("Check your spam folder too. The link expires in 15 minutes.")}
          </p>
        )}
        <Link className="auth-primary" to={LOGIN_ROUTE}>
          {t("Back to log in") + " "}
          <FiArrowRight aria-hidden="true" />
        </Link>
        {mode === "forgot" && (
          <button className="auth-text-link" type="button" onClick={onRetry}>
            {t("Use another email")}
          </button>
        )}
      </div>
    );
  }
  return (
    <>
      {!isRecovery ? (
        <nav className="auth-tabs" aria-label={t("Account options")}>
          <NavLink to={LOGIN_ROUTE} onClick={(e) => pending && e.preventDefault()}>
            {t("Log in")}
          </NavLink>
          <NavLink to={REGISTRATION_ROUTE} onClick={(e) => pending && e.preventDefault()}>
            {t("Create account")}
          </NavLink>
        </nav>
      ) : (
        <Link className="auth-back" to={LOGIN_ROUTE}>
          <FiArrowLeft aria-hidden="true" />
          {" " + t("Back to log in")}
        </Link>
      )}
      <header className="auth-form-header">
        <span className="auth-eyebrow">
          {mode === "login"
            ? t("GOOD TO SEE YOU AGAIN")
            : mode === "registration"
              ? t("YOUR NEXT CHAPTER")
              : t("ACCOUNT RECOVERY")}
        </span>
        <h2>{t(text.heading)}</h2>
        <p>{t(text.description)}</p>
      </header>
      {(validationError || error) && (
        <div className="auth-alert" role="alert">
          {t(validationError || error)}
        </div>
      )}
      {mode === "forgot" && recoveryAvailable !== true ? (
        <div className="auth-recovery-status" role="status">
          {recoveryAvailable === null
            ? t("Checking password recovery…")
            : t("Password recovery is currently unavailable. Please try again later.")}
        </div>
      ) : invalidLink ? (
        <div className="auth-result">
          <p role="alert">
            {t("This reset link is missing or invalid. Request a new link to continue.")}
          </p>
          <Link className="auth-primary" to={FORGOT_PASSWORD_ROUTE}>
            {t("Request a new link") + " "}
            <FiArrowRight aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} aria-busy={pending}>
          {mode !== "reset" && (
            <div className="auth-field">
              <label htmlFor="auth-email">{t("Email address")}</label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                maxLength={255}
                placeholder="you@example.com"
                spellCheck="false"
                autoCapitalize="none"
              />
            </div>
          )}
          {mode !== "forgot" && (
            <PasswordField
              id="auth-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              newPassword={isNew}
              hint={isNew ? t("At least 12 characters. A memorable phrase works well.") : undefined}
            />
          )}
          {isNew && (
            <PasswordField
              id="auth-confirmation"
              label={t("Confirm password")}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              newPassword
            />
          )}
          {mode === "login" && (
            <div className="auth-forgot">
              <Link to={FORGOT_PASSWORD_ROUTE}>{t("Forgot password?")}</Link>
            </div>
          )}
          <button className="auth-primary" type="submit" disabled={pending}>
            {pending ? (
              <>
                <span className="auth-spinner" />{" "}
                {mode === "forgot"
                  ? t("Sending…")
                  : mode === "reset"
                    ? t("Updating…")
                    : t("Please wait…")}
              </>
            ) : (
              <>
                {t(text.button)} <FiArrowRight aria-hidden="true" />
              </>
            )}
          </button>
          {mode === "reset" && error && (
            <Link className="auth-text-link" to={FORGOT_PASSWORD_ROUTE}>
              {t("Request a new reset link")}
            </Link>
          )}
        </form>
      )}
      <p className="auth-footnote">
        <FiLock aria-hidden="true" />{" "}
        {mode === "reset"
          ? t("Your other sessions will be signed out.")
          : t("Your calendar is only visible to you.")}
      </p>
    </>
  );
}
