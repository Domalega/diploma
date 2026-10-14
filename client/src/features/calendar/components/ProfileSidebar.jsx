import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Offcanvas } from "react-bootstrap";
import DateItem from "./DateItem";
import { clearToken } from "../../../shared/api/tokenStorage";
import { LOGIN_ROUTE } from "../../../shared/config/routes";
import ThemeSwitcher from "../../../shared/theme/ThemeSwitcher";

export default function ProfileSidebar({ dates, onDelete }) {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();
  function logout() {
    clearToken();
    navigate(LOGIN_ROUTE, { replace: true });
  }
  return (
    <>
      <Button
        variant="outline-secondary"
        className="theme-button-outline"
        onClick={() => setShow(true)}
      >
        Profile
      </Button>
      <Offcanvas show={show} onHide={() => setShow(false)}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Welcome</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <div className="profile-theme">
            <ThemeSwitcher />
          </div>
          <p className="m-1 h5">Your notes:</p>
          {dates.length === 0 && <p>No notes yet.</p>}
          {dates.map((date) => (
            <DateItem key={date.id} date={date} onDelete={onDelete} />
          ))}
          <Button className="m-3 theme-button" onClick={logout}>
            Sign out
          </Button>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}
