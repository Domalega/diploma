import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AuthPage from "./AuthPage";
import { useLocation } from "react-router-dom";
import { ThemeProvider } from "../../../shared/theme/ThemeProvider";
import * as authApi from "../api/authApi";

jest.mock("../api/authApi");
beforeEach(() => {
  localStorage.clear();
  jest.resetAllMocks();
});

function renderPage(path) {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/registration" element={<AuthPage />} />
          <Route path="/calendar" element={<p>Calendar opened</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "user@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secure-password" } });
  if (path === "/registration")
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "secure-password" },
    });
}

test("registration stores the returned token and opens the calendar", async () => {
  authApi.register.mockResolvedValue({ token: "registered-token" });
  renderPage("/registration");
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
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

test("password visibility can be toggled without losing the entered value", () => {
  renderPage("/login");
  const password = screen.getByLabelText("Password");
  expect(password).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Show password", exact: true }));
  expect(password).toHaveAttribute("type", "text");
  expect(password).toHaveValue("secure-password");
  fireEvent.click(screen.getByRole("button", { name: "Hide password", exact: true }));
  expect(password).toHaveAttribute("type", "password");
});

test("registration requires matching passwords before calling the API", () => {
  renderPage("/registration");
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "different-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(screen.getByRole("alert")).toHaveTextContent("The passwords do not match");
  expect(authApi.register).not.toHaveBeenCalled();
});

function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">
      {location.pathname}
      {location.search}
    </span>
  );
}
function renderRecovery(path) {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          {["/login", "/forgot-password", "/reset-password"].map((route) => (
            <Route key={route} path={route} element={<AuthPage key={route} />} />
          ))}
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

test("recovery only requests email when mail delivery is available", async () => {
  authApi.recoveryStatus.mockResolvedValue({ available: true });
  authApi.forgotPassword.mockResolvedValue({
    message: "If an account exists, you will receive a reset link.",
  });
  renderRecovery("/forgot-password");
  fireEvent.change(await screen.findByLabelText("Email address"), {
    target: { value: "user@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  expect(await screen.findByRole("status", { name: "Account status" })).toHaveTextContent(
    "If an account exists",
  );
  expect(authApi.forgotPassword).toHaveBeenCalledWith("user@example.com");
  fireEvent.click(screen.getByRole("button", { name: "Use another email" }));
  expect(screen.getByLabelText("Email address")).toBeInTheDocument();
});

test("unconfigured recovery does not falsely claim that mail was sent", async () => {
  authApi.recoveryStatus.mockResolvedValue({ available: false });
  renderRecovery("/forgot-password");
  expect(
    await screen.findByText("Password recovery is currently unavailable. Please try again later."),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Send reset link" })).not.toBeInTheDocument();
});

test("reset removes the link token from the URL and returns to login without auto-sign-in", async () => {
  const token = "a".repeat(64);
  authApi.resetPassword.mockResolvedValue({ message: "Your password has been updated." });
  localStorage.setItem("token", "old-session");
  renderRecovery(`/reset-password?token=${token}`);
  await waitFor(() =>
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/reset-password$/),
  );
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "replacement-password" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "replacement-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
  expect(await screen.findByRole("status", { name: "Account status" })).toHaveTextContent(
    "Password updated",
  );
  expect(authApi.resetPassword).toHaveBeenCalledWith(token, "replacement-password");
  expect(localStorage.getItem("token")).toBeNull();
});

test("missing recovery tokens offer a new link instead of a broken password form", () => {
  renderRecovery("/reset-password");
  expect(screen.getByRole("alert")).toHaveTextContent("missing or invalid");
  expect(screen.queryByRole("button", { name: "Update password" })).not.toBeInTheDocument();
});
