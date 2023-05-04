import React, { useState } from "react";
import { Form, FormControl, Button } from "react-bootstrap";
import Modal from "react-modal";
import colors from "../utils/colors";
import "../styles/Modal.css";
import { createDate } from "../api/api";

const ModalWindow = (props) => {
  const customStyles = {
    content: {
      top: "50%",
      left: "50%",
      right: "auto",
      bottom: "auto",
      marginRight: "-50%",
      transform: "translate(-50%, -50%)",
      background: colors.BgColorDark,
      color: colors.TextColorDark,
      height: 400,
      width: 400,
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gridTemplateRows: "repeat(5, 1fr)",
      gridColumnGap: 0,
    },
    closeButton: {
      color: colors.TextColorDark,
      gridArea: "1 / 5 / 2 / 6",
    },
    form: {
      marginTop: 20,
      gridArea: "2 / 1 / 6 / 6",
    },
  };

  function closeModal() {
    props.setIsOpen(false);
  }

  const [isHovered, setIsHovered] = useState(false);

  const btnStyleSubmit = {
    background: isHovered ? colors.Success : colors.BtnColorDark,
    color: colors.TextColorDark,
    width: 200,
  };

  const [date, setDate] = useState("");
  const [comment, setComment] = useState("");

  async function handleSubmitDate(date, comment) {
    try {
      const token = localStorage.getItem("token");
      const response = await createDate(date, comment, token);
      if (response.ok) {
        closeModal();
      } else {
        const data = await response.json();
        alert(data.message);
      }
    } catch (error) {
      alert(error);
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSubmitDate(date, comment);
  };

  return (
    <div>
      <Modal
        isOpen={props.modalIsOpen}
        onRequestClose={closeModal}
        style={customStyles}
        contentLabel="Отправка даты"
      >
        <button
          className="btn"
          onClick={closeModal}
          style={customStyles.closeButton}
        >
          close
        </button>
        <div style={customStyles.form}>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="p-2">
              <Form.Label>Date</Form.Label>
              <FormControl
                type="date"
                placeholder="Enter date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="p-2">
              <Form.Label>Comment</Form.Label>
              <FormControl
                type="text"
                placeholder="Enter your text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </Form.Group>

            <Button
              className="m-2"
              style={btnStyleSubmit}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              type="submit"
            >
              Submit
            </Button>
          </Form>
        </div>
      </Modal>
    </div>
  );
};

export default ModalWindow;
