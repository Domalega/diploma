import React from "react";
import "../styles/Footer.css";
import colors from "../config/colors";

const Footer = () => {
  return (
    <div
      className="containerFtr"
      style={{ background: colors.BgColorDark, color: colors.TextColorDark }}
    >
      <div className="Footer-line"></div>
      <div className="flex-containerFtr">
        <div className="flex-containerFtr-creator">Made by Domalega</div>
        <div className="flex-containerFtr-logo">
          <img
            src={`${process.env.PUBLIC_URL}/logo.png`}
            alt="Logo"
            style={{
              width: "40px",
              height: "40px",
              aspectRatio: "4/3",
              objectFit: "contain",
              mixBlendMode: "color-burn",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Footer;
