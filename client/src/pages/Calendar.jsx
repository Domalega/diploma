import { React, useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import MainCalendar from "../components/MainCalendar";
import DatePicker from "../components/DatePicker";
import Footer from "../components/Footer";
import "../styles/Calendar.css";
import colors from "../color";

const Calendar = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const classes = isMobile ? "mobile-style" : "desktop-style";

  return (
    <div className="wrapper">
      <header className={`header ${classes}`}>
        <NavBar />
      </header>

      <main className="main" style={{ background: colors.WrapperColorDark }}>
        <div className="child" style={{ background: "#900000" }}>
          <DatePicker />
        </div>
        <div className="child" style={{ color: colors.TextColorDark }}>
          <MainCalendar />
        </div>
      </main>
      <footer className="footer">
        <Footer />
      </footer>
    </div>
  );
};

export default Calendar;
