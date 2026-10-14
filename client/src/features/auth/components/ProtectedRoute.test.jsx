import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { check } from "../api/authApi";

jest.mock("../api/authApi");
beforeEach(() => {
  localStorage.clear();
  jest.resetAllMocks();
});

function renderRoute() {
  render(
    <MemoryRouter initialEntries={["/calendar"]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <p>Protected calendar</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

test("a missing token redirects without making an auth request", async () => {
  renderRoute();
  expect(await screen.findByText("Login page")).toBeInTheDocument();
  expect(check).not.toHaveBeenCalled();
});

test("a server outage offers retry and preserves the existing session", async () => {
  localStorage.setItem("token", "existing-token");
  check
    .mockRejectedValueOnce(new Error("Network unavailable"))
    .mockResolvedValueOnce({ token: "refreshed-token" });
  renderRoute();
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to connect");
  expect(localStorage.getItem("token")).toBe("existing-token");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Protected calendar")).toBeInTheDocument();
  expect(localStorage.getItem("token")).toBe("refreshed-token");
});
