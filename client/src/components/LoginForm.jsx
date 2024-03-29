import React, { useState } from "react";
import { Button, Container, Form, FormGroup, Row } from "react-bootstrap";
import Card from "react-bootstrap/esm/Card";
import { NavLink, useLocation } from "react-router-dom";
import colors from "../utils/colors";
import { LOGIN_ROUTE, REGISTRATION_ROUTE } from "../utils/const";

const LoginForm = (props) => {
  const [isHovered, setIsHovered] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const location = useLocation();

  const isLogin = location.pathname === LOGIN_ROUTE;

  const styles = {
    container: { height: window.innerHeight - 100 },
    card: {
      width: 700,
      boxShadow: "5px black",
      background: colors.BgColorDark,
    },
    btnStyle: {
      background: isHovered ? colors.Success : colors.BtnColorDark,
      color: colors.TextColorDark,
    },
  };

  function handleSubmit(event) {
    event.preventDefault();
    props.onSubmit(email, password);
  }

  return (
    <div>
      <Container
        className="d-flex justify-content-center align-items-center p-4"
        style={styles.container}
      >
        <Card style={styles.card} className="p-5 link-light">
          <h3 className="m-auto">
            {isLogin ? "Authorization" : "Registration"}
          </h3>
          <Form onSubmit={handleSubmit}>
            <FormGroup>
              <Form.Label className="mt-5">Email address</Form.Label>
              <Form.Control
                placeholder="Enter your login"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormGroup>
            <FormGroup>
              <Form.Label className="mt-1">Password</Form.Label>

              <Form.Control
                placeholder="Enter your password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Form.Text className="text-muted">
                Don`t share your email or password
              </Form.Text>
            </FormGroup>

            <Row className="m-auto justify-content-between">
              {isLogin ? (
                <div className="align-self-center w-50">
                  Haven`t account?{" "}
                  <NavLink to={REGISTRATION_ROUTE}>Create an account</NavLink>
                </div>
              ) : (
                <div className="align-self-center w-75">
                  Already have login and password?
                  <NavLink to={LOGIN_ROUTE}>Sign in</NavLink>
                </div>
              )}

              <Button
                className="mt-3 w-25"
                type="submit"
                style={styles.btnStyle}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                {isLogin ? "Log in" : "Sign in"}
              </Button>
            </Row>
          </Form>
        </Card>
      </Container>
    </div>
  );
};

export default LoginForm;
