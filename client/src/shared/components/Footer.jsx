import React from "react";
import "../styles/Footer.css";

const Footer = () => {
  return (
    <div className="containerFtr">
      <div className="Footer-line"></div>
      <div className="flex-containerFtr">
        <div className="flex-containerFtr-creator">Made by Domalega</div>
        <div className="flex-containerFtr-logo">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Logo" className="footer-logo" />
        </div>
      </div>
    </div>
  );
};

export default Footer;
