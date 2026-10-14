import { Container, Navbar } from "react-bootstrap";
import { Link } from "react-router-dom";
import ProfileSidebar from "./ProfileSidebar";
import colors from "../../../shared/config/colors";
import { CALENDAR_ROUTE } from "../../../shared/config/routes";
import "../styles/NavBar.css";

export default function NavBar({ dates, onDelete }) {
  return (
    <Navbar style={{ background: colors.BgColorDark }}>
      <Container>
        <ProfileSidebar dates={dates} onDelete={onDelete} />
        <Navbar.Brand as={Link} to={CALENDAR_ROUTE}>
          <img
            className="navbar-logo"
            src={`${process.env.PUBLIC_URL}/logo.png`}
            alt="Calendar"
            style={{ width: 60, height: 60, objectFit: "contain", mixBlendMode: "color-burn" }}
          />
        </Navbar.Brand>
      </Container>
    </Navbar>
  );
}
