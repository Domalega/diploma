import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "react-bootstrap/Button";
import Offcanvas from "react-bootstrap/Offcanvas";
import { getAllDates } from "../api/api";
import DateContainer from "./DateContainer";
import colors from "../utils/colors";

const SideBtn = () => {
  const [show, setShow] = useState(false);
  const [dates, setGetDates] = useState();

  const navigate = useNavigate();

  const handleClose = () => {
    setShow(false);
  };

  const handleShow = async () => {
    const token = localStorage.getItem("token");
    const response = await getAllDates(token);
    const data = await response.json();
    setGetDates(data);
    setShow(true);
  };

  const handleOut = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };
  const styles = {
    btnOpen: { width: 100 },
    btnOut: {
      position: "absolute",
      bottom: 0,
      left: 0,
      margin: 20,
      backgroundColor: colors.BtnColorDark,
    },
  };

  return (
    <div>
      <Button variant="light" onClick={handleShow} style={styles.btnOpen}>
        Profile
      </Button>

      <Offcanvas show={show} onHide={handleClose}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Welcome</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <p className="m-1 h5">Your`s date:</p>
          {dates &&
            dates.map((data) => <DateContainer key={data.id} date={data} />)}
          <Button style={styles.btnOut} onClick={handleOut}>
            Sign out
          </Button>
        </Offcanvas.Body>
      </Offcanvas>
    </div>
  );
};

export default SideBtn;
