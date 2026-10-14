import { Container, Navbar } from "react-bootstrap";
import { Link } from "react-router-dom";
import ProfileSidebar from "./ProfileSidebar";
import ThemeSwitcher from "../../../shared/theme/ThemeSwitcher";
import { CALENDAR_ROUTE } from "../../../shared/config/routes";
import "../styles/NavBar.css";

export default function NavBar({ dates, onDelete }) {
  return (
    <Navbar className="calendar-navbar">
      <Container>
        <ProfileSidebar dates={dates} onDelete={onDelete} />
        <div className="calendar-nav-actions">
          <ThemeSwitcher />
          <Navbar.Brand as={Link} to={CALENDAR_ROUTE}>
            <img
              className="navbar-logo"
              src={`${process.env.PUBLIC_URL}/logo.png`}
              alt="Calendar"
            />
          </Navbar.Brand>
        </div>
      </Container>
    </Navbar>
  );
}
