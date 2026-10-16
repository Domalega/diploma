import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CalendarPage from "./CalendarPage";
import { ThemeProvider } from "../../../shared/theme/ThemeProvider";
import { LanguageProvider, LANGUAGE_KEY } from "../../../shared/i18n/LanguageProvider";
import * as datesApi from "../api/datesApi";
import * as offlineBridge from "../../../shared/offline/bridge";
import useMedicationTracker from "../../medications/hooks/useMedicationTracker";
import { emptyPlan } from "../../medications/utils/schedule";
import {
  todayKey,
  moveDays,
  moveMonths,
  monthStart,
  formatDay,
  formatMonth,
} from "../utils/calendarDates";
import useKanbanBoard, { emptyBoard } from "../../kanban/hooks/useKanbanBoard";
import useTodoList, { emptyList } from "../../todos/hooks/useTodoList";
jest.mock("../../todos/hooks/useTodoList", () => {
  const actual = jest.requireActual("../../todos/hooks/useTodoList");
  return { ...actual, __esModule: true, default: jest.fn() };
});
jest.mock("../../kanban/hooks/useKanbanBoard", () => {
  const actual = jest.requireActual("../../kanban/hooks/useKanbanBoard");
  return { ...actual, __esModule: true, default: jest.fn() };
});
jest.mock("../api/datesApi");
jest.mock("../../medications/hooks/useMedicationTracker");
const today = todayKey();
const note = { id: 1, date: today, comment: "Read a little" };
beforeEach(() => {
  jest.resetAllMocks();
  localStorage.clear();
  useTodoList.mockReturnValue({
    list: emptyList,
    loading: false,
    pending: false,
    error: "",
    conflict: false,
    reload: jest.fn(),
    send: jest.fn().mockResolvedValue({}),
  });
  useKanbanBoard.mockReturnValue({
    board: emptyBoard,
    loading: false,
    pending: false,
    error: "",
    conflict: false,
    reload: jest.fn(),
    send: jest.fn(),
  });
  datesApi.getAllDates.mockResolvedValue([]);
  useMedicationTracker.mockReturnValue({
    plan: emptyPlan,
    records: [],
    todayRecords: [],
    loading: false,
    pending: false,
    error: "",
    reload: jest.fn(),
    savePlan: jest.fn(),
    mark: jest.fn(),
  });
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
const panel = () => within(screen.getByRole("region", { name: "Notes", exact: true }));
const calendarReady = () => screen.findByRole("table", { name: "Monthly calendar" });

test("phone sync is at the bottom of settings while background refresh works with settings closed", async () => {
  let syncRevision = 1;
  jest.spyOn(offlineBridge, "isOfflineApp").mockReturnValue(true);
  const native = jest.spyOn(offlineBridge, "offlineNative").mockImplementation(async () => ({
    ready: true,
    pending: 0,
    syncRevision,
    conflicts: [],
  }));
  const changed = jest.fn();
  window.addEventListener("daymark:sync", changed);
  try {
    mount();
    await calendarReady();
    await waitFor(() => expect(native).toHaveBeenCalledWith("status"));
    expect(screen.queryByRole("button", { name: "Sync now" })).not.toBeInTheDocument();

    syncRevision = 2;
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Settings", exact: true }));
    const settings = await screen.findByRole("dialog", { name: "Settings" });
    const sync = within(settings).getByRole("region", { name: "Phone synchronization" });
    const signOut = within(settings).getByRole("button", { name: "Sign out" });
    const syncButton = within(sync).getByRole("button", { name: "Sync now" });
    expect(within(settings).getAllByRole("button").slice(-2)).toEqual([syncButton, signOut]);
    await act(async () => syncButton.click());
    await waitFor(() => expect(native).toHaveBeenCalledWith("sync", expect.any(Object)));
    await waitFor(() =>
      expect(within(sync).getByRole("button", { name: "Sync now" })).toBeEnabled(),
    );
    fireEvent.click(within(settings).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    syncRevision = 3;
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
  } finally {
    window.removeEventListener("daymark:sync", changed);
    jest.restoreAllMocks();
  }
});

test("the to-do list has an independent experimental toggle and dashboard tile", async () => {
  const tracker = { ...useTodoList(), list: { ...emptyList, enabled: true } };
  useTodoList.mockReturnValue(tracker);
  mount();
  await calendarReady();
  expect(screen.getByRole("region", { name: "To-do list", exact: true })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Settings", exact: true }));
  const settings = await screen.findByRole("dialog", { name: "Settings" });
  expect(within(settings).getByRole("checkbox", { name: "To-do list" })).toBeChecked();
  fireEvent.click(within(settings).getByRole("checkbox", { name: "To-do list" }));
  expect(tracker.send).toHaveBeenCalledWith({ type: "enabled", enabled: false });
});

test("experimental board dates appear in the calendar and selecting a task date opens that day", async () => {
  const taskDate = moveMonths(today, 1);
  const send = jest.fn().mockResolvedValue({});
  useKanbanBoard.mockReturnValue({
    board: {
      ...emptyBoard,
      enabled: true,
      columns: [{ id: "todo", name: "", kind: "todo", hidden: false, wipLimit: null }],
      tasks: [
        {
          id: "task-one",
          title: "Prepare a demo",
          description: "",
          date: taskDate,
          columnId: "todo",
          position: 0,
          completedAt: null,
        },
      ],
    },
    loading: false,
    pending: false,
    error: "",
    conflict: false,
    reload: jest.fn(),
    send,
  });
  mount();
  await calendarReady();
  const board = within(screen.getByRole("region", { name: "Task board", exact: true }));
  fireEvent.click(board.getByRole("button", { name: formatDay(taskDate) }));
  expect(screen.getByRole("heading", { name: formatMonth(taskDate) })).toBeInTheDocument();
  const day = screen.getByRole("button", { name: /Tasks: Prepare a demo/ });
  expect(day).toHaveAttribute("aria-pressed", "true");
  expect(within(day).getByText("Prepare a demo")).toBeInTheDocument();
  expect(
    screen.queryByText("Your calendar is a fresh page. Choose a day to leave your first note."),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Settings", exact: true }));
  const settings = await screen.findByRole("dialog", { name: "Settings" });
  expect(within(settings).getByRole("checkbox", { name: "Kanban board" })).toBeChecked();
  fireEvent.click(within(settings).getByRole("checkbox", { name: "Kanban board" }));
  await waitFor(() => expect(send).toHaveBeenCalledWith({ type: "enabled", enabled: false }));
});

test("Russian settings translate calendar dates and labels while preserving user notes and loaded data", async () => {
  localStorage.setItem(LANGUAGE_KEY, "ru");
  datesApi.getAllDates.mockResolvedValue([{ ...note, comment: "Settings" }]);
  render(
    <LanguageProvider>
      <ThemeProvider>
        <MemoryRouter>
          <CalendarPage />
        </MemoryRouter>
      </ThemeProvider>
    </LanguageProvider>,
  );
  await screen.findByRole("table", { name: "Календарь на месяц" });
  expect(screen.getByRole("heading", { name: formatMonth(today, "ru") })).toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Заметки", exact: true })).getByText("Settings"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Настройки", exact: true }));
  const dialog = await screen.findByRole("dialog", { name: "Настройки" });
  fireEvent.click(within(dialog).getByRole("radio", { name: "English" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("table", { name: "Monthly calendar" })).toBeInTheDocument();
  expect(panel().getByText("Settings")).toBeInTheDocument();
  expect(datesApi.getAllDates).toHaveBeenCalledTimes(1);
});

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

test("on compact screens a selected day focuses the independent notes tile and the editor restores visible focus", async () => {
  const original = window.matchMedia;
  window.matchMedia = (query) => ({ ...original(query), matches: query === "(max-width: 1000px)" });
  try {
    mount();
    await calendarReady();
    const tomorrow = moveDays(today, 1);
    fireEvent.click(screen.getByRole("button", { name: formatDay(tomorrow), exact: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Selected day notes")).toHaveFocus();
    fireEvent.click(panel().getByRole("button", { name: "Add a note" }));
    const editor = await screen.findByRole("dialog", { name: "A note for your day" });
    expect(within(editor).getByLabelText("Date")).toHaveValue(tomorrow);
    expect(within(editor).getByLabelText("Your note")).toHaveFocus();
    fireEvent.click(within(editor).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "New note" })).toHaveFocus());
  } finally {
    window.matchMedia = original;
  }
});

test("medications, notes and today's date are independent tiles that share the selected calendar day", async () => {
  const tracker = useMedicationTracker.mock.results[0]?.value || {
    plan: emptyPlan,
    records: [],
    todayRecords: [],
    loading: false,
    pending: false,
  };
  useMedicationTracker.mockReturnValue({ ...tracker, plan: { ...emptyPlan, enabled: true } });
  mount();
  await calendarReady();
  const medications = screen.getByRole("region", { name: "Medication tracker", exact: true });
  expect(
    within(medications).getByRole("region", { name: "Medication intakes" }),
  ).toBeInTheDocument();
  expect(panel().queryByRole("region", { name: "Medication intakes" })).not.toBeInTheDocument();
  const tomorrow = moveDays(today, 1);
  fireEvent.click(screen.getByRole("button", { name: formatDay(tomorrow), exact: true }));
  expect(medications).toHaveTextContent(formatDay(tomorrow));
  expect(screen.getByRole("region", { name: "Today", exact: true })).toHaveTextContent(
    new Date(today + "T12:00:00").getDate().toString(),
  );
  const dateTile = screen.getByRole("region", { name: "Today", exact: true });
  expect(within(dateTile).queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Today", exact: true })).toBeInTheDocument();
  expect(panel().getByRole("heading", { name: formatDay(tomorrow) })).toBeInTheDocument();
});

test("tracker view is chosen only while arranging, persists after reopening, and experimental labels stay in Settings", async () => {
  localStorage.setItem("daymark.medication-view.v1", "unknown");
  useMedicationTracker.mockReturnValue({
    plan: {
      ...emptyPlan,
      enabled: true,
      slots: [{ id: "morning", time: "08:00", label: "Morning" }],
      rows: [
        {
          id: "a",
          name: "Example A",
          detail: "",
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          startDate: today,
          slotIds: ["morning"],
        },
      ],
    },
    records: [],
    todayRecords: [],
    loading: false,
    pending: false,
    error: "",
    reload: jest.fn(),
    savePlan: jest.fn(),
    mark: jest.fn(),
  });
  let view = mount();
  await calendarReady();
  const tile = () =>
    within(screen.getByRole("region", { name: "Medication tracker", exact: true }));
  expect(screen.queryByRole("group", { name: "Medication tracker view" })).not.toBeInTheDocument();
  expect(tile().queryByText("Experimental")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Arrange panels" }));
  const controls = within(screen.getByRole("group", { name: "Medication tracker view" }));
  expect(controls.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(controls.getByRole("button", { name: "Buttons" }));
  expect(tile().getByRole("list", { name: "Intake times" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Done arranging" }));
  expect(screen.queryByRole("group", { name: "Medication tracker view" })).not.toBeInTheDocument();
  view.unmount();
  view = mount();
  await calendarReady();
  expect(tile().getByRole("list", { name: "Intake times" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Arrange panels" }));
  fireEvent.click(
    within(screen.getByRole("group", { name: "Medication tracker view" })).getByRole("button", {
      name: "Table",
    }),
  );
  expect(tile().getByRole("table")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Done arranging" }));
  view.unmount();
  mount();
  await calendarReady();
  expect(tile().getByRole("table")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Manage medication schedule" }));
  const manager = await screen.findByRole("dialog", { name: "Medication schedule" });
  expect(within(manager).queryByText("Experimental")).not.toBeInTheDocument();
  fireEvent.click(within(manager).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Settings", exact: true }));
  expect(await screen.findByRole("heading", { name: "Experimental options" })).toBeInTheDocument();
});

/* eslint-disable testing-library/no-node-access -- These layout checks inspect the containers that hide headings and style completed tasks. */
test("dated checklist tasks appear on the calendar and can be completed from the selected day", async () => {
  const tracker = {
    ...useTodoList(),
    list: {
      ...emptyList,
      enabled: true,
      tasks: [{ id: "dated-todo", title: "Checklist appointment", date: today, completed: true }],
    },
  };
  useTodoList.mockReturnValue(tracker);
  mount();
  await calendarReady();
  const day = screen.getByRole("button", { name: /Tasks: Checklist appointment · Completed/ });
  expect(within(day).getByText("Checklist appointment").closest(".day-task")).toHaveClass(
    "is-completed",
  );
  fireEvent.click(day);
  const tasks = within(screen.getByRole("region", { name: "To-do list for selected day" }));
  fireEvent.click(tasks.getByRole("checkbox", { name: "Reopen task Checklist appointment" }));
  expect(tracker.send).toHaveBeenCalledWith({
    type: "complete",
    id: "dated-todo",
    completed: false,
  });
  expect(
    screen.queryByText("Your calendar is a fresh page. Choose a day to leave your first note."),
  ).not.toBeInTheDocument();
});

test("hide headings is an ordinary appearance setting and survives reopening the calendar", async () => {
  const view = mount();
  await calendarReady();
  fireEvent.click(screen.getByRole("button", { name: "Settings", exact: true }));
  const toggle = await screen.findByRole("checkbox", { name: "Hide tile headings" });
  expect(
    within(toggle.closest("section")).getByRole("heading", { name: "Appearance" }),
  ).toBeInTheDocument();
  fireEvent.click(toggle);
  expect(
    screen.getByRole("region", { name: "Calendar", exact: true }).querySelector("header"),
  ).toHaveClass("is-title-hidden");
  view.unmount();
  mount();
  await calendarReady();
  expect(
    screen.getByRole("region", { name: "Calendar", exact: true }).querySelector("header"),
  ).toHaveClass("is-title-hidden");
  fireEvent.click(screen.getByRole("button", { name: "Arrange panels" }));
  expect(
    screen.getByRole("region", { name: "Calendar", exact: true }).querySelector("header"),
  ).not.toHaveClass("is-title-hidden");
  fireEvent.click(screen.getByRole("button", { name: "Done arranging" }));
  expect(
    screen.getByRole("region", { name: "Calendar", exact: true }).querySelector("header"),
  ).toHaveClass("is-title-hidden");
});
