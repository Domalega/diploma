import React, { useState } from "react";
import NavBar from "../components/NavBar";
import MainCalendar from "../components/MainCalendar";
import Footer from "../components/Footer";
import "../styles/Calendar.css";
import colors from "../utils/colors";

import ModalWindow from "../components/ModalChoseDate.jsx";

const Calendar = () => {
  const [modalIsOpen, setIsOpen] = useState(false);

  function openModal() {
    setIsOpen(true);
  }
  const style = {
    btnAddStyle: {
      background: colors.BgColorDark,
      color: colors.TextColorDark,
      margin: 10,
      width: 250,
    },
    mainWrapperStyle: { background: colors.WrapperColorDark },
    mainCalendarStyle: {
      color: colors.TextColorDark,
    },
  };
  return (
    <div className="wrapper">
      <header className="header">
        <NavBar />
      </header>

      <main className="main" style={style.mainWrapperStyle}>
        <button
          onClick={openModal}
          className="btn containerBar__btn-add"
          style={style.btnAddStyle}
        >
          Add date
        </button>

        <div
          className={`child modal-${modalIsOpen}`}
          style={style.mainCalendarStyle}
        >
          <MainCalendar />
        </div>

        <ModalWindow modalIsOpen={modalIsOpen} setIsOpen={setIsOpen} />
      </main>

      <footer className="footer">
        <Footer />
      </footer>
    </div>
  );
};

export default Calendar;
