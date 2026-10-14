import React from "react";
import { BrowserRouter, HashRouter } from "react-router-dom";
import AppRouter from "./app/AppRouter";

const App = () => {
  const Router = process.env.REACT_APP_ROUTER === "hash" ? HashRouter : BrowserRouter;
  return (
    <Router>
      <AppRouter />
    </Router>
  );
};

export default App;
