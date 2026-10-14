import React from "react";
import { BrowserRouter, HashRouter } from "react-router-dom";
import AppRouter from "./app/AppRouter";
import { ThemeProvider } from "./shared/theme/ThemeProvider";

const App = () => {
  const Router = process.env.REACT_APP_ROUTER === "hash" ? HashRouter : BrowserRouter;
  return (
    <ThemeProvider>
      <Router>
        <AppRouter />
      </Router>
    </ThemeProvider>
  );
};

export default App;
