import { Link } from "react-router-dom";
import { FiCalendar, FiSearch, FiX } from "react-icons/fi";
import ProfileSidebar from "./ProfileSidebar";
import ThemeSwitcher from "../../../shared/theme/ThemeSwitcher";
import { CALENDAR_ROUTE } from "../../../shared/config/routes";
export default function NavBar({ query = "", onQueryChange = () => {}, notifications }) {
  return (
    <header className="planner-header">
      <a className="skip-link" href="#planner-main">
        Skip to calendar
      </a>
      <div className="planner-header-inner">
        <Link className="planner-brand" to={CALENDAR_ROUTE}>
          <span className="planner-brand-icon">
            <FiCalendar aria-hidden="true" />
          </span>
          <span>Online Calendar</span>
        </Link>
        <div className="planner-search" role="search">
          <FiSearch aria-hidden="true" />
          <label className="visually-hidden" htmlFor="note-search">
            Search notes
          </label>
          <input
            id="note-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Find a note…"
          />
          {query && (
            <button
              type="button"
              className="icon-button"
              aria-label="Clear search"
              onClick={() => onQueryChange("")}
            >
              <FiX aria-hidden="true" />
            </button>
          )}
        </div>
        <nav className="planner-account" aria-label="Account controls">
          <ThemeSwitcher />
          <ProfileSidebar notifications={notifications} />
        </nav>
      </div>
    </header>
  );
}
