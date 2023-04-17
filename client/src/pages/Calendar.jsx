import React from "react";
import NavBar from "../components/NavBar";
import MainCalendar from "../components/MainCalendar";
import Footer from "../components/Footer";
import "../styles/Calendar.css";
import colors from "../utils/colors";
import useMobileDetection from "../utils/resizeHook";
import DatePickerM from "../components/DatePicker";

const Calendar = () => {
  const isMobile = useMobileDetection();
  const classes = isMobile ? "mobile-style" : "desktop-style";

  console.log(classes);
  return (
    <div className="wrapper">
      <header className={`header-${classes}`}>
        <NavBar />
      </header>

      <main
        className={`main-${classes}`}
        style={{ background: colors.WrapperColorDark }}
      >
        <div className="child">
          <DatePickerM />
        </div>

        <div className="child" style={{ color: colors.TextColorDark }}>
          <MainCalendar />
        </div>
      </main>

      <footer className={`footer-${classes}`}>
        <Footer />
      </footer>
    </div>
  );
};

export default Calendar;
