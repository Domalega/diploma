import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("./app/AppRouter", () => {
  const { useLocation } = require("react-router-dom");
  return function TestRouter() {
    const location = useLocation();
    return <p>{location.pathname}</p>;
  };
});

test("GitHub Pages loads a route from the hash under the repository path", () => {
  process.env.REACT_APP_ROUTER = "hash";
  window.history.replaceState({}, "", "/diploma/#/calendar");
  render(<App />);
  expect(screen.getByText("/calendar")).toBeInTheDocument();
  delete process.env.REACT_APP_ROUTER;
  window.history.replaceState({}, "", "/");
});
