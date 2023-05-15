import React, { useState } from "react";
import NavBar from "../components/NavBar";
import MainCalendar from "../components/MainCalendar";
import Footer from "../components/Footer";
import "../styles/Calendar.css";
import colors from "../utils/colors";
import useMobileDetection from "../utils/resizeHook";
import ModalWindow from "../components/ModalChoseDate.jsx";

const Calendar = () => {
  const isMobile = useMobileDetection();
  const classes = isMobile ? "mobile-style" : "desktop-style";

  const [modalIsOpen, setIsOpen] = useState(false);

  function openModal() {
    setIsOpen(true);
  }
  //console.log(classes);
  return (
    <div className="wrapper">
      <header className={`header-${classes}`}>
        <NavBar />
      </header>

      <main
        className={`main-${classes}`}
        style={{ background: colors.WrapperColorDark }}
      >
        <button
          onClick={openModal}
          className={`btn containerBar__btn-add-${classes}`}
          style={{
            background: colors.BgColorDark,
            color: colors.TextColorDark,
            margin: 10,
            width: 250,
          }}
        >
          Добавить дату
        </button>

        <div
          className={`child modal-${modalIsOpen}`}
          style={{ color: colors.TextColorDark, zIndex: 1 }}
        >
          <MainCalendar />
        </div>

        <ModalWindow modalIsOpen={modalIsOpen} setIsOpen={setIsOpen} />
      </main>

      <footer className={`footer-${classes}`}>
        <Footer />
      </footer>
    </div>
  );
};

export default Calendar;
