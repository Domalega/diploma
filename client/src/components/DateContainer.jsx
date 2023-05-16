import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import colors from "../utils/colors.js";
import { deleteDate } from "../api/api";

async function Delete({ date }) {
  try {
    const token = localStorage.getItem("token");
    const response = await deleteDate(token, date);
    console.log(response);
    if (response.ok) {
      window.location.reload();
      console.log("deleted");
    }
  } catch (error) {
    console.log(error);
  }
}

const DateContainer = ({ date, onDelete }) => {
  const [isHover, setIsHover] = useState(false);

  const styles = {
    containerStyle: {
      border: `1px solid ${colors.WrapperColorDark}`,
      padding: 5,
      margin: 5,
    },
    headingStyle: {
      fontSize: 20,
    },
    flexCont: {
      display: "flex",
      justifyContent: "space-between",
      borderBottom: `1px solid ${colors.WrapperColorDark}`,
    },
    btnOut: {
      cursor: "pointer",
      transform: isHover ? "scale(1.2)" : "scale(1)",
    },
  };

  const handleMouseEnter = () => {
    setIsHover(true);
  };

  const handleMouseLeave = () => {
    setIsHover(false);
  };

  return (
    <div style={styles.containerStyle}>
      <div style={styles.flexCont}>
        <h3 style={styles.headingStyle}>{date.date}</h3>
        <FaTimes
          onClick={() => Delete(date)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={styles.btnOut}
        />
      </div>
      <p>{date.comment}</p>
    </div>
  );
};

export default DateContainer;
