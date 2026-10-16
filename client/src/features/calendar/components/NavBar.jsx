import { useLanguage } from "../../../shared/i18n/LanguageProvider";
import { Link } from "react-router-dom";
import { FiSearch, FiX } from "react-icons/fi";
import ProfileSidebar from "./ProfileSidebar";
import BrandMark from "../../../shared/components/BrandMark";
import { CALENDAR_ROUTE } from "../../../shared/config/routes";
export default function NavBar({
  query = "",
  onQueryChange = () => {},
  notifications,
  medications,
  onMedicationConfigure,
  kanban,
  todos,
}) {
  const { t } = useLanguage();

  return (
    <header className="planner-header">
      <a className="skip-link" href="#planner-main">
        {t("Skip to calendar")}
      </a>
      <div className="planner-header-inner">
        <Link className="planner-brand" to={CALENDAR_ROUTE}>
          <span className="planner-brand-icon">
            <BrandMark />
          </span>
          <span>Daymark</span>
        </Link>
        <div className="planner-search" role="search">
          <FiSearch aria-hidden="true" />
          <label className="visually-hidden" htmlFor="note-search">
            {t("Search notes")}
          </label>
          <input
            id="note-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("Find a note…")}
          />
          {query && (
            <button
              type="button"
              className="icon-button"
              aria-label={t("Clear search")}
              onClick={() => onQueryChange("")}
            >
              <FiX aria-hidden="true" />
            </button>
          )}
        </div>
        <nav className="planner-account" aria-label={t("Account controls")}>
          <ProfileSidebar
            notifications={notifications}
            medications={medications}
            onMedicationConfigure={onMedicationConfigure}
            kanban={kanban}
            todos={todos}
          />
        </nav>
      </div>
    </header>
  );
}
