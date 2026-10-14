import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CalendarPage from "./CalendarPage";
import { ThemeProvider } from "../../../shared/theme/ThemeProvider";
import * as datesApi from "../api/datesApi";
import { todayKey, moveDays, formatDay } from "../utils/calendarDates";
jest.mock("../api/datesApi");
const today = todayKey();
const note = { id: 1, date: today, comment: "Read a little" };
beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  datesApi.getAllDates.mockResolvedValue([]);
});
function mount() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}
const panel = () => within(screen.getByRole("complementary", { name: "Selected day" }));
const calendarReady = () => screen.findByRole("table", { name: "Monthly calendar" });

test("creating, editing and confirmed deletion keep the calendar and selected day in sync", async () => {
  datesApi.getAllDates.mockResolvedValueOnce([]).mockResolvedValueOnce([note]);
  datesApi.createDate.mockResolvedValue({});
  datesApi.updateDate.mockResolvedValue({});
  datesApi.deleteDate.mockResolvedValue({});
  mount();
  await calendarReady();
  fireEvent.click(screen.getByRole("button", { name: "New note" }));
  expect(screen.getByLabelText("Date")).toHaveValue(today);
  fireEvent.change(screen.getByLabelText("Your note"), { target: { value: note.comment } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(datesApi.createDate).toHaveBeenCalledWith(today, note.comment);
  expect(panel().getByText(note.comment)).toBeInTheDocument();
  fireEvent.click(panel().getByRole("button", { name: "Edit note" }));
  expect(screen.getByLabelText("Date")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Your note"), { target: { value: "An updated thought" } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(datesApi.updateDate).toHaveBeenCalledWith(today, "An updated thought");
  expect(panel().getByText("An updated thought")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Note: An updated thought/ })).toBeInTheDocument();
  fireEvent.click(panel().getByRole("button", { name: "Delete", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Keep note" }));
  expect(datesApi.deleteDate).not.toHaveBeenCalled();
  fireEvent.click(panel().getByRole("button", { name: "Delete", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Delete note", exact: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(datesApi.deleteDate).toHaveBeenCalledWith(today);
  expect(panel().getByRole("button", { name: "Add a note" })).toBeInTheDocument();
  expect(screen.queryByText("An updated thought")).not.toBeInTheDocument();
});
test("selecting an empty day prefills its date without creating any data", async () => {
  mount();
  await calendarReady();
  const tomorrow = moveDays(today, 1);
  fireEvent.click(screen.getByRole("button", { name: formatDay(tomorrow), exact: true }));
  expect(panel().getByRole("heading", { name: formatDay(tomorrow) })).toBeInTheDocument();
  fireEvent.click(panel().getByRole("button", { name: "Add a note" }));
  expect(screen.getByLabelText("Date")).toHaveValue(tomorrow);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(datesApi.createDate).not.toHaveBeenCalled();
});
test("search finds past notes, clear restores the month, and List separates upcoming from all dates", async () => {
  const past = { id: 2, date: moveDays(today, -2), comment: "Old journal" };
  const future = { id: 3, date: moveDays(today, 2), comment: "Walk in the park" };
  datesApi.getAllDates.mockResolvedValue([past, future]);
  mount();
  await calendarReady();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search notes" }), {
    target: { value: " JOURNAL " },
  });
  expect(screen.getByRole("region", { name: "Search results" })).toHaveTextContent("Old journal");
  expect(screen.queryByText("Walk in the park")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect(screen.getByRole("table", { name: "Monthly calendar" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "List", exact: true }));
  expect(screen.getByRole("region", { name: "Notes list" })).toHaveTextContent("Walk in the park");
  expect(screen.queryByText("Old journal")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Notes to show"), { target: { value: "all" } });
  expect(screen.getByText("Old journal")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search notes" }), {
    target: { value: "no match" },
  });
  expect(screen.getByText("No matching notes.")).toBeInTheDocument();
});
test("failed edits and deletions preserve the existing note and allow retry", async () => {
  datesApi.getAllDates.mockResolvedValue([note]);
  datesApi.updateDate.mockRejectedValueOnce(new Error("Could not save")).mockResolvedValue({});
  datesApi.deleteDate.mockRejectedValue(new Error("Could not delete"));
  mount();
  await calendarReady();
  fireEvent.click(panel().getByRole("button", { name: "Edit note" }));
  fireEvent.change(screen.getByLabelText("Your note"), { target: { value: "Keep this draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
  expect(screen.getByLabelText("Your note")).toHaveValue("Keep this draft");
  expect(panel().getByText(note.comment)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(panel().getByRole("button", { name: "Delete", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Delete note", exact: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not delete");
  expect(panel().getByText("Keep this draft")).toBeInTheDocument();
});
test("loading errors offer retry and keep note creation disabled until data is known", async () => {
  datesApi.getAllDates.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue([]);
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
  expect(screen.getByRole("button", { name: "New note" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await calendarReady();
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "New note" })).toBeEnabled();
});

test("on compact screens a selected day opens a labelled drawer and the editor restores visible focus", async () => {
  const original = window.matchMedia;
  window.matchMedia = (query) => ({ ...original(query), matches: query === "(max-width: 1000px)" });
  try {
    mount();
    await calendarReady();
    const tomorrow = moveDays(today, 1);
    fireEvent.click(screen.getByRole("button", { name: formatDay(tomorrow), exact: true }));
    const drawer = await screen.findByRole("dialog", { name: "Your selected day" });
    fireEvent.click(within(drawer).getByRole("button", { name: "Add a note" }));
    const editor = await screen.findByRole("dialog", { name: "A note for your day" });
    expect(within(editor).getByLabelText("Date")).toHaveValue(tomorrow);
    expect(within(editor).getByLabelText("Your note")).toHaveFocus();
    fireEvent.click(within(editor).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "New note" })).toHaveFocus());
  } finally {
    window.matchMedia = original;
  }
});
