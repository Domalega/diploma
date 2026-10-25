import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppRouter from "./AppRouter";
import { check } from "../features/auth/api/authApi";
import { ThemeProvider } from "../shared/theme/ThemeProvider";

jest.mock("../features/auth/api/authApi");
jest.mock("../features/calendar/pages/CalendarPage", () => () => <p>Calendar opened</p>);
jest.mock(
  "../shared/encryption/EncryptionGate",
  () =>
    ({ children }) =>
      children,
);

beforeEach(() => {
  localStorage.clear();
  jest.resetAllMocks();
});

test("the site root resumes a saved session", async () => {
  localStorage.setItem("token", "saved-session");
  check.mockResolvedValue({ token: "renewed-session" });
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/"]}>
        <AppRouter />
      </MemoryRouter>
    </ThemeProvider>,
  );
  expect(await screen.findByText("Calendar opened")).toBeInTheDocument();
  expect(localStorage.getItem("token")).toBe("renewed-session");
});

test("the site root shows sign-in when no session is saved", async () => {
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/"]}>
        <AppRouter />
      </MemoryRouter>
    </ThemeProvider>,
  );
  expect(await screen.findByLabelText("Email address")).toBeInTheDocument();
  expect(check).not.toHaveBeenCalled();
});
