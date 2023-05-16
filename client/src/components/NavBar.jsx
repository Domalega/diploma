import Container from "react-bootstrap/Container";
import Navbar from "react-bootstrap/Navbar";
import SideBtn from "./SideBtn";
import colors from "../utils/colors";
import "../styles/NavBar.css";

const NavBar = () => {
  return (
    <Navbar style={{ background: colors.BgColorDark }}>
      <Container>
        <Navbar.Brand href="#">
          <SideBtn />
        </Navbar.Brand>
        <Navbar.Brand href="/Calendar">
          <img
            src="%PUBLIC_URL%/../logo.png"
            alt="Logo"
            style={{
              width: "60px",
              height: "60px",
              aspectRatio: "4/3",
              objectFit: "contain",
              mixBlendMode: "color-burn",
            }}
          />
        </Navbar.Brand>
      </Container>
    </Navbar>
  );
};

export default NavBar;
