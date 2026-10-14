import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CalendarPage from "./CalendarPage";
import { ThemeProvider } from "../../../shared/theme/ThemeProvider";
import * as datesApi from "../api/datesApi";
import {
  todayKey,
  moveDays,
  moveMonths,
  monthStart,
  formatDay,
  formatMonth,
} from "../utils/calendarDates";
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
  expect(datesApi.createDate).toHaveBeenCalledWith(today, note.comment, null);
  expect(panel().getByText(note.comment)).toBeInTheDocument();
  fireEvent.click(panel().getByRole("button", { name: "Edit note" }));
  expect(screen.getByLabelText("Date")).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Your note"), { target: { value: "An updated thought" } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(datesApi.updateDate).toHaveBeenCalledWith(note.id, {
    date: today,
    comment: "An updated thought",
    time: null,
  });
  expect(panel().getByText("An updated thought")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Note: An updated thought/ })).toBeInTheDocument();
  fireEvent.click(panel().getByRole("button", { name: "Delete", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Keep note" }));
  expect(datesApi.deleteDate).not.toHaveBeenCalled();
  fireEvent.click(panel().getByRole("button", { name: "Delete", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Delete note", exact: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(datesApi.deleteDate).toHaveBeenCalledWith(note.id);
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

test("same-day notes are sorted by time and editing or deleting one preserves its neighbours", async () => {
  const day = [
    { id: 10, date: today, time: "16:00", comment: "Afternoon meeting" },
    { id: 11, date: today, time: null, comment: "All-day reminder" },
    { id: 12, date: today, time: "09:30", comment: "Morning meeting" },
  ];
  datesApi.getAllDates.mockResolvedValue(day);
  datesApi.updateDate.mockResolvedValue({});
  datesApi.deleteDate.mockResolvedValue({});
  mount();
  await calendarReady();
  expect(
    panel()
      .getAllByRole("article")
      .map((article) => article.getAttribute("aria-label")),
  ).toEqual(["All day — All-day reminder", "09:30 — Morning meeting", "16:00 — Afternoon meeting"]);
  fireEvent.click(screen.getByRole("button", { name: "New note" }));
  fireEvent.input(screen.getByLabelText(/Time/), { target: { value: "11:45" } });
  fireEvent.change(screen.getByLabelText("Your note"), { target: { value: "Another note" } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(datesApi.createDate).toHaveBeenCalledWith(today, "Another note", "11:45");
  const morning = panel().getByRole("article", { name: "09:30 — Morning meeting" });
  fireEvent.click(within(morning).getByRole("button", { name: "Edit note" }));
  const tomorrow = moveDays(today, 1);
  fireEvent.input(screen.getByLabelText("Date"), { target: { value: tomorrow } });
  fireEvent.input(screen.getByLabelText(/Time/), { target: { value: "10:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(datesApi.updateDate).toHaveBeenCalledWith(12, {
    date: tomorrow,
    comment: "Morning meeting",
    time: "10:00",
  });
  expect(panel().getAllByRole("article")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(formatDay(today) + ".*2 notes") }));
  expect(panel().getAllByRole("article")).toHaveLength(2);
  const afternoon = panel().getByRole("article", { name: "16:00 — Afternoon meeting" });
  fireEvent.click(within(afternoon).getByRole("button", { name: "Delete", exact: true }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Afternoon meeting");
  fireEvent.click(screen.getByRole("button", { name: "Delete note", exact: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(datesApi.deleteDate).toHaveBeenCalledWith(10);
  expect(panel().getByText("All-day reminder")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search notes" }), {
    target: { value: "10:00" },
  });
  expect(screen.getByRole("region", { name: "Search results" })).toHaveTextContent(
    "Morning meeting",
  );
});
test("search spans all dates while the agenda and grid share the same month and selected day", async () => {
  const past = { id: 2, date: moveMonths(monthStart(today), -1), comment: "Old journal" };
  const future = { id: 3, date: monthStart(today), comment: "Walk in the park" };
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
  expect(screen.queryByLabelText("Notes to show")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
  expect(screen.getByText("Old journal")).toBeInTheDocument();
  expect(screen.queryByText("Walk in the park")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: formatMonth(past.date) })).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: formatDay(past.date) + ", Old journal", exact: true }),
  );
  expect(panel().getByText("Old journal")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Month", exact: true }));
  expect(
    screen.getByRole("button", { name: formatDay(past.date) + ", Note: Old journal", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
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
