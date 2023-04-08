import React from "react";
import { BrowserRouter, Route } from "react-router-dom";
import AppRouter from "./components/AppRouter";
import NavBar from "./components/NavBar";
import "./styles/App.css";

// не видет юрл
console.log(process.env.REACT_APP_API_URL);

const App = () => {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
};

export default App;
