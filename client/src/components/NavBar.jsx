import Container from "react-bootstrap/Container";
import Navbar from "react-bootstrap/Navbar";
import SideBtn from "./SideBtn";
import colors from "../utils/colors";
import "../styles/NavBar.css";

const NavBar = () => {
  return (
    <Navbar
      className="navBar"
      variant="dark"
      style={{ background: colors.BgColorDark }}
    >
      <Container>
        <Navbar.Brand href="#">
          <SideBtn />
        </Navbar.Brand>
        <Navbar.Brand href="/Calendar" className="NavBar__logo">
          <img src="../pic/1.png" alt="Logo" />
        </Navbar.Brand>
      </Container>
    </Navbar>
  );
};

export default NavBar;
