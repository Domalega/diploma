import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CalendarPage from "./CalendarPage";
import { ThemeProvider } from "../../../shared/theme/ThemeProvider";
import * as datesApi from "../api/datesApi";

jest.mock("../api/datesApi");
beforeEach(() => {
  jest.resetAllMocks();
});

test("adding and deleting a note updates both calendar and profile without reloading", async () => {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const note = { id: 1, date, comment: "Test meeting" };
  datesApi.getAllDates.mockResolvedValueOnce([]).mockResolvedValueOnce([note]);
  datesApi.createDate.mockResolvedValue({ message: "ok" });
  datesApi.deleteDate.mockResolvedValue({ message: "ok" });
  render(
    <ThemeProvider>
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Add date" }));
  fireEvent.change(screen.getByLabelText("Date"), { target: { value: date } });
  fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Test meeting" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(await screen.findByText("Test meeting")).toBeInTheDocument();
  expect(datesApi.createDate).toHaveBeenCalledWith(date, "Test meeting");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Profile" }));
  expect(await screen.findAllByText("Test meeting")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: `Delete note for ${date}` }));
  await waitFor(() => expect(screen.queryByText("Test meeting")).not.toBeInTheDocument());
  expect(datesApi.deleteDate).toHaveBeenCalledWith(date);
});
