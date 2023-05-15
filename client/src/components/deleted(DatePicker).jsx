import React from "react";
import { DatePicker } from "antd";
import "moment/locale/ru";
import moment from "moment";

const DatePickerM = () => {
  function onChange(date, dateString) {
    console.log(date, dateString);
  }

  return <DatePicker onChange={onChange} format="DD.MM.YYYY" />;
};

export default DatePickerM;
