import { useContext } from "react";
import { Context } from "..";
import Container from "react-bootstrap/Container";
import Navbar from "react-bootstrap/Navbar";
import SideBtn from "./SideBtn";

const NavBar = () => {
  const { user } = useContext(Context);
  return (
    <Navbar variant="dark" bg="dark">
      <Container>
        <Navbar.Brand href="#">
          <SideBtn>Hi</SideBtn>
        </Navbar.Brand>
        <Navbar.Brand href="/Calendar">Calendar</Navbar.Brand>
        <Navbar.Brand href="#">user</Navbar.Brand>
      </Container>
    </Navbar>
  );
};

export default NavBar;
