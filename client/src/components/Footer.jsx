import { React } from "react";
import "../styles/Footer.css";
import colors from "../color";

//ДОПИСАТЬ ПАЛОЧКУ !!!
const Footer = () => {
  return (
    <div
      className="containerFtr"
      style={{ background: colors.BgColorDark, color: colors.TextColorDark }}
    >
      <div className="Footer-line"></div>
      <div className="flex-containerFtr">
        <div className="flex-containerFtr-creator">
          Copyright ©2023 All rights reserved or not This site is made with by
          Domalega inc.
        </div>
        <div className="flex-containerFtr-logo">LOGO</div>
      </div>
    </div>
  );
};

export default Footer;
