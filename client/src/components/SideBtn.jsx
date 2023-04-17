import React, { useState } from "react";
import Button from "react-bootstrap/Button";
import Offcanvas from "react-bootstrap/Offcanvas";

const SideBtn = () => {
  const User = { name: "Ivan" };

  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <>
      <Button variant="light" onClick={handleShow} style={{ width: 100 }}>
        Profile
      </Button>

      <Offcanvas show={show} onHide={handleClose}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>{User.name}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>Some info</Offcanvas.Body>
      </Offcanvas>
    </>
  );
};

export default SideBtn;
