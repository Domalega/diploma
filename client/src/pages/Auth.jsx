import React, { useState } from "react";
import LoginForm from "../components/LognForm";
import { login, register } from "../api/api";
import { Navigate, useLocation } from "react-router-dom";
import { CALENDAR_ROUTE, LOGIN_ROUTE } from "../utils/const";

const Auth = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [registerIn, setRegisterIn] = useState(false);

  const location = useLocation();

  async function handleLogin(email, password) {
    //console.log(email, password, location.pathname);
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
          console.log("ss");
          setRegisterIn(true);
        } else alert(data.message);
      } catch (error) {
        console.error(error);
        alert("error response");
      }
    }
  }
  if (registerIn || loggedIn) return <Navigate to={CALENDAR_ROUTE} />;

  return (
    <div>
      <LoginForm onSubmit={handleLogin} />
    </div>
  );
};

export default Auth;
