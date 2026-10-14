import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AuthPage from "./AuthPage";
import * as authApi from "../api/authApi";

jest.mock("../api/authApi");
beforeEach(() => {
  localStorage.clear();
  jest.resetAllMocks();
});

function renderPage(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/registration" element={<AuthPage />} />
        <Route path="/calendar" element={<p>Calendar opened</p>} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "user@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
}

test("registration stores the returned token and opens the calendar", async () => {
  authApi.register.mockResolvedValue({ token: "registered-token" });
  renderPage("/registration");
  fireEvent.click(screen.getByRole("button", { name: "Register" }));
  expect(await screen.findByText("Calendar opened")).toBeInTheDocument();
  expect(localStorage.getItem("token")).toBe("registered-token");
});

test("failed login displays the error without saving a token", async () => {
  authApi.login.mockRejectedValue(new Error("Email or password is incorrect"));
  renderPage("/login");
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect");
  expect(localStorage.getItem("token")).toBeNull();
  await waitFor(() => expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled());
});
