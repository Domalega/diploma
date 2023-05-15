import React from "react";
import colors from "../utils/colors.js";

const styles = {
  container: {
    border: `1px solid ${colors.WrapperColorDark}`,
    padding: 5,
    margin: 5,
  },
  heading: {
    fontSize: 20,
    borderBottom: `1px solid ${colors.WrapperColorDark}`,
  },
};

const DateContainer = ({ date }) => {
  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>{date.date}</h3>
      <p>{date.comment}</p>
    </div>
  );
};

export default DateContainer;
