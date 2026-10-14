import React, { useState } from "react";
import { Alert, Button, Card, Container, Form, FormGroup } from "react-bootstrap";
import { NavLink, useLocation } from "react-router-dom";
import colors from "../../../shared/config/colors";
import { LOGIN_ROUTE, REGISTRATION_ROUTE } from "../../../shared/config/routes";

const AuthForm = ({ onSubmit, pending, error }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const location = useLocation();

  const isLogin = location.pathname === LOGIN_ROUTE;

  const styles = {
    container: { minHeight: "100vh" },
    card: {
      width: "100%",
      maxWidth: 700,
      background: colors.BgColorDark,
    },
    btnStyle: {
      background: isHovered ? colors.Success : colors.BtnColorDark,
      color: colors.TextColorDark,
    },
  };

  function handleSubmit(event) {
    event.preventDefault();
    if (!pending) onSubmit(email, password);
  }

  return (
    <div>
      <Container
        className="d-flex justify-content-center align-items-center p-4"
        style={styles.container}
      >
        <Card style={styles.card} className="p-4 p-sm-5 link-light">
          <h3 className="m-auto">{isLogin ? "Authorization" : "Registration"}</h3>
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}
          <Form onSubmit={handleSubmit}>
            <FormGroup controlId="auth-email">
              <Form.Label className="mt-5">Email address</Form.Label>
              <Form.Control
                placeholder="Enter your login"
                type="email"
                required
                maxLength={255}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormGroup>
            <FormGroup controlId="auth-password">
              <Form.Label className="mt-1">Password</Form.Label>

              <Form.Control
                placeholder="Enter your password"
                type="password"
                required
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Form.Text className="text-muted">Do not share your password</Form.Text>
            </FormGroup>

            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3">
              {isLogin ? (
                <div>
                  No account? <NavLink to={REGISTRATION_ROUTE}>Create an account</NavLink>
                </div>
              ) : (
                <div>
                  Already have login and password?
                  <NavLink to={LOGIN_ROUTE}>Sign in</NavLink>
                </div>
              )}

              <Button
                className="px-4"
                type="submit"
                disabled={pending}
                style={styles.btnStyle}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                {pending ? "Please wait..." : isLogin ? "Log in" : "Register"}
              </Button>
            </div>
          </Form>
        </Card>
      </Container>
    </div>
  );
};

export default AuthForm;
