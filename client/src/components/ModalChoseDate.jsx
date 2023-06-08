import React, { useState } from "react";
import { Form, FormControl, Button } from "react-bootstrap";
import Modal from "react-modal";
import colors from "../utils/colors";
import { createDate } from "../api/api";
import { FaTimes } from "react-icons/fa";

const ModalWindow = (props) => {
  const [date, setDate] = useState("");
  const [comment, setComment] = useState("");
  const [isHoverBtnClose, setIsHoverBtnClose] = useState(false);
  const [isHoverBtnSubmit, setIsHoverBtnSubmit] = useState(false);

  const styles = {
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
      justifySelf: "end",
      cursor: "pointer",
      transform: isHoverBtnClose ? "scale(1.2)" : "scale(1)",
    },
    form: {
      gridArea: "2 / 1 / 6 / 6",
    },
    btnStyleSubmit: {
      background: isHoverBtnSubmit ? colors.Success : colors.BtnColorDark,
      color: colors.TextColorDark,
      width: 200,
    },
  };

  async function handleSubmitDate(date, comment) {
    try {
      const token = localStorage.getItem("token");
      const response = await createDate(date, comment, token);
      const data = await response.json();
      if (response.ok && data.message === "ok") {
        props.setIsOpen(false);
        window.location.reload();
      } else {
        alert("Date is already created");
      }
    } catch (error) {
      alert(error);
    }
  }

  return (
    <div>
      <Modal
        isOpen={props.modalIsOpen}
        onRequestClose={() => props.setIsOpen(false)}
        style={styles}
        contentLabel="Send data"
      >
        <FaTimes
          onClick={() => props.setIsOpen(false)}
          onMouseEnter={() => setIsHoverBtnClose(true)}
          onMouseLeave={() => setIsHoverBtnClose(false)}
          style={styles.closeButton}
        />
        <div style={styles.form}>
          <Form onSubmit={() => handleSubmitDate(date, comment)}>
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
              className="m-2 mt-4"
              style={styles.btnStyleSubmit}
              onMouseEnter={() => setIsHoverBtnSubmit(true)}
              onMouseLeave={() => setIsHoverBtnSubmit(false)}
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
