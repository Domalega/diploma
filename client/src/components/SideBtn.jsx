import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "react-bootstrap/Button";
import Offcanvas from "react-bootstrap/Offcanvas";

const SideBtn = () => {
  const User = { name: "Ivan" };

  const navigate = useNavigate();

  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const handleOut = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <>
      <Button variant="light" onClick={handleShow} style={{ width: 100 }}>
        Profile
      </Button>

      <Offcanvas show={show} onHide={handleClose}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>{User.name}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Button
            style={{ position: "absolute", bottom: 0, left: 0, margin: 20 }}
            onClick={handleOut}
          >
            Выйти
          </Button>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
};

export default SideBtn;
