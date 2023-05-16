import React from "react";
import "../styles/Footer.css";
import colors from "../utils/colors";

const Footer = () => {
  return (
    <div
      className="containerFtr"
      style={{ background: colors.BgColorDark, color: colors.TextColorDark }}
    >
      <div className="Footer-line"></div>
      <div className="flex-containerFtr">
        <div className="flex-containerFtr-creator">
          This site is made with by Domalega inc.
        </div>
        <div className="flex-containerFtr-logo">
          <img
            src="%PUBLIC_URL%/../logo.png"
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
