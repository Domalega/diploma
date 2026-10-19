import React from "react";
import { BrowserRouter, HashRouter } from "react-router-dom";
import AppRouter from "./app/AppRouter";
import { ThemeProvider } from "./shared/theme/ThemeProvider";
import { LanguageProvider } from "./shared/i18n/LanguageProvider";
import { AppUpdatesProvider } from "./shared/updates/AppUpdatesProvider";

const App = () => {
  const Router = process.env.REACT_APP_ROUTER === "hash" ? HashRouter : BrowserRouter;
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AppUpdatesProvider>
          <Router>
            <AppRouter />
          </Router>
        </AppUpdatesProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
};

export default App;
