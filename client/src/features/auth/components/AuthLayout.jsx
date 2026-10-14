import { Link } from "react-router-dom";
import { FiCalendar, FiArrowUpRight } from "react-icons/fi";
import { LOGIN_ROUTE } from "../../../shared/config/routes";
import "../styles/Auth.css";

export default function AuthLayout({ children }) {
  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="Online Calendar">
        <Link className="auth-brand" to={LOGIN_ROUTE}>
          <span className="auth-brand-icon">
            <FiCalendar aria-hidden="true" />
          </span>
          <span>
            Online Calendar<span className="auth-brand-caption">A little more organised.</span>
          </span>
        </Link>
        <div className="auth-story-content">
          <span className="auth-eyebrow">
            <span /> ROOM FOR WHAT MATTERS
          </span>
          <h1>
            A little space
            <br />
            for your <em>plans.</em>
          </h1>
          <p>
            Keep your dates and notes in one place.
            <br />
            Start with today. Make it your own.
          </p>
          <div className="auth-preview" aria-hidden="true">
            <div className="auth-preview-heading">
              <span>Your week, at a glance</span>
              <FiArrowUpRight />
            </div>
            <div className="auth-preview-days">
              {[
                ["M", 12],
                ["T", 13],
                ["W", 14],
                ["T", 15],
                ["F", 16],
                ["S", 17],
                ["S", 18],
              ].map(([day, date]) => (
                <div key={date} className={date === 14 ? "is-today" : ""}>
                  <span>{day}</span>
                  <strong>{date}</strong>
                  <i />
                </div>
              ))}
            </div>
            <div className="auth-preview-note">
              <span className="auth-note-mark" />
              <div>
                <strong>Make time for yourself.</strong>
                <span>A note to keep close.</span>
              </div>
              <span className="auth-note-date">14 OCT</span>
            </div>
          </div>
        </div>
        <div className="auth-story-footer">
          <span>One day at a time.</span>
          <span>
            Made by Domalega <FiArrowUpRight aria-hidden="true" />
          </span>
        </div>
      </section>
      <section className="auth-main" aria-label="Account access">
        <div className="auth-form-wrap">{children}</div>
        <p className="auth-main-footer">Your plans. Your pace.</p>
      </section>
    </main>
  );
}
