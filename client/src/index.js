import React, { createContext } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CUserStore from "./store/userStore";

export const Context = createContext(null);
console.log(Context);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <Context.Provider
    value={{
      user: new CUserStore(),
    }}
  >
    <App />
  </Context.Provider>
);
