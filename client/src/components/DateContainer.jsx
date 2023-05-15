import React from "react";
import colors from "../utils/colors.js";

const DateContainer = ({ date }) => {
  return (
    <div
      style={{
        border: `1px solid ${colors.WrapperColorDark}`,
        padding: 5,
        margin: 5,
      }}
    >
      <h3
        style={{
          fontSize: 20,
          borderBottom: `1px solid ${colors.WrapperColorDark}`,
        }}
      >
        {date.date}
      </h3>
      <p>{date.comment}</p> 
    </div>
  );
};

export default DateContainer;
