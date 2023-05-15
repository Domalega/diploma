import React, { useState } from "react";
import LoginForm from "../components/LoginForm";
import { login, register } from "../api/api";
import { Navigate, useLocation } from "react-router-dom";
import { CALENDAR_ROUTE } from "../utils/const";

const Auth = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [registerIn, setRegisterIn] = useState(false);

  const location = useLocation();

  async function handleLogin(email, password) {
    if (location.pathname === "/login") {
      try {
        const response = await login(email, password);
        const data = await response.json();
        localStorage.setItem("token", data.token);
        console.log(data.token);
        if (response.ok) {
          setLoggedIn(true);
        } else alert(data.message);
      } catch (error) {
        console.error(error);
        alert("error response");
      }
    } else if (location.pathname === "/registration") {
      try {
        const response = await register(email, password);
        const data = await response.json();
        localStorage.setItem("token", data.token);
        if (response.ok) {
          setRegisterIn(true);
        } else alert(data.message);
      } catch (error) {
        console.error(error);
        alert("error response");
      }
    }
  }

  if (registerIn || loggedIn) return <Navigate to={CALENDAR_ROUTE} />;

  return <LoginForm onSubmit={handleLogin} />;
};

export default Auth;
