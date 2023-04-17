import React, { useState } from "react";
import { Button, Container, Form, FormGroup, Row } from "react-bootstrap";
import Card from "react-bootstrap/esm/Card";
import { NavLink, useLocation } from "react-router-dom";
import colors from "../utils/colors";
import { LOGIN_ROUTE, REGISTRATION_ROUTE } from "../utils/const";

const Auth = () => {
  const [isHovered, setIsHovered] = useState(false);
  const location = useLocation();

  const isLogin = location.pathname === LOGIN_ROUTE;

  const btnStyle = {
    background: isHovered ? colors.Success : colors.BtnColorDark,
    color: colors.TextColorDark,
    width: 200,
  };

  return (
    <div>
      <Container
        className="d-flex justify-content-center align-items-center p-4"
        style={{ height: window.innerHeight - 100 }}
      >
        <Card
          style={{
            width: 700,
            boxShadow: "5px black",
            background: colors.BgColorDark,
          }}
          className="p-5 link-light"
        >
          <h3 className="m-auto">
            {isLogin ? "Authorization" : "Registration"}{" "}
          </h3>
          <Form>
            <FormGroup>
              <Form.Label className="mt-5">Email address</Form.Label>
              <Form.Control placeholder="Enter your login" />
            </FormGroup>
            <FormGroup>
              <Form.Label className="mt-1">Password</Form.Label>

              <Form.Control placeholder="Enter your password" type="password" />
              <Form.Text className="text-muted">
                Don`t share your email or password
              </Form.Text>
            </FormGroup>

            <Row className="m-auto justify-content-between">
              {isLogin ? (
                <div className="align-self-center" style={{ width: 350 }}>
                  Already have login and password?{" "}
                  <NavLink to={REGISTRATION_ROUTE}>Sign in</NavLink>
                </div>
              ) : (
                <div className="align-self-center" style={{ width: 350 }}>
                  Haven`t account? <NavLink to={LOGIN_ROUTE}>Log in</NavLink>
                </div>
              )}

              <Button
                className="mt-3"
                //variant="outline"
                style={btnStyle}
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

export default Auth;
