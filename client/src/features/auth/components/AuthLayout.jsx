import { Link } from "react-router-dom";
import { FiArrowUpRight } from "react-icons/fi";
import { LOGIN_ROUTE } from "../../../shared/config/routes";
import ThemeSwitcher from "../../../shared/theme/ThemeSwitcher";
import InteractivePhrase from "../../../shared/components/InteractivePhrase";
import BrandMark from "../../../shared/components/BrandMark";
import "../styles/Auth.css";

export default function AuthLayout({ children }) {
  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="Daymark">
        <Link className="auth-brand" to={LOGIN_ROUTE}>
          <span className="auth-brand-icon">
            <BrandMark />
          </span>
          <span>
            Daymark<span className="auth-brand-caption">Your personal calendar</span>
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
          <a
            className="creator-link"
            href="https://github.com/Domalega"
            target="_blank"
            rel="noopener noreferrer"
          >
            Made by Domalega <FiArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </section>
      <section className="auth-main" aria-label="Account access">
        <div className="auth-theme-bar">
          <ThemeSwitcher />
        </div>
        <div className="auth-form-wrap">{children}</div>
        <div className="auth-main-footer">
          <InteractivePhrase />
        </div>
      </section>
    </main>
  );
}
