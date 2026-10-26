import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TodoTile from "./TodoTile";
import { formatDay, todayKey } from "../../calendar/utils/calendarDates";

const task = { id: "one", title: "Buy milk", completed: false };
function tracker(overrides = {}) {
  return {
    list: { enabled: true, revision: 1, tasks: [task] },
    loading: false,
    pending: false,
    conflict: false,
    error: "",
    send: jest.fn().mockResolvedValue({}),
    reload: jest.fn(),
    ...overrides,
  };
}
test("Enter adds a task, clears the draft and keeps focus for the next task", async () => {
  const state = tracker();
  render(<TodoTile tracker={state} />);
  const input = screen.getByRole("textbox", { name: "New to-do tasks" });
  input.focus();
  fireEvent.change(input, { target: { value: " Plan the day " } });
  fireEvent.keyDown(input, { key: "Enter" });
  await waitFor(() => expect(input).toHaveValue(""));
  expect(state.send).toHaveBeenCalledWith({
    type: "add",
    titles: ["Plan the day"],
    date: todayKey(),
  });
  expect(input).toHaveFocus();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(state.send).toHaveBeenCalledTimes(1);
});
test("pasting multiple lines creates one task per nonempty line", async () => {
  const state = tracker();
  render(<TodoTile tracker={state} />);
  const input = screen.getByRole("textbox", { name: "New to-do tasks" });
  fireEvent.change(input, { target: { value: "First\n\n Second\nThird" } });
  await waitFor(() => expect(input).toHaveValue(""));
  expect(state.send).toHaveBeenCalledWith({
    type: "add",
    titles: ["First", "Second", "Third"],
    date: todayKey(),
  });
});
test("checking a task strikes it through and a second click reopens it", () => {
  const state = tracker();
  const view = render(<TodoTile tracker={state} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Complete task Buy milk" }));
  expect(state.send).toHaveBeenCalledWith({ type: "complete", id: "one", completed: true });
  view.rerender(
    <TodoTile
      tracker={{ ...state, list: { ...state.list, tasks: [{ ...task, completed: true }] } }}
    />,
  );
  expect(screen.getByText("Buy milk").tagName).toBe("S");
  expect(screen.getByRole("status")).toHaveTextContent("1 of 1 completed");
  fireEvent.click(screen.getByRole("checkbox", { name: "Reopen task Buy milk" }));
  expect(state.send).toHaveBeenCalledWith({ type: "complete", id: "one", completed: false });
});
test("failed additions preserve all lines; in-flight additions cannot be duplicated", async () => {
  const state = tracker({ send: jest.fn().mockRejectedValue(new Error("Offline")) });
  render(<TodoTile tracker={state} />);
  const input = screen.getByRole("textbox", { name: "New to-do tasks" });
  fireEvent.change(input, { target: { value: "Keep\nBoth" } });
  fireEvent.click(screen.getByRole("button", { name: "Add tasks" }));
  expect(state.send).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(input).toHaveValue("Keep\nBoth"));
});
test("edit, cancel and delete operate on the chosen task", async () => {
  const state = tracker();
  render(<TodoTile tracker={state} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit to-do Buy milk" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Task title" }), {
    target: { value: "Buy bread" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument(),
  );
  expect(state.send).toHaveBeenCalledWith({
    type: "edit",
    id: "one",
    title: "Buy bread",
    date: todayKey(),
  });
  fireEvent.click(screen.getByRole("button", { name: "Delete to-do Buy milk" }));
  expect(state.send).toHaveBeenCalledWith({ type: "remove", id: "one" });
});
test("a conflict keeps drafts and editing locked until reload", () => {
  const state = tracker({
    conflict: true,
    error: "The to-do list changed. Reload it before saving.",
  });
  render(<TodoTile tracker={state} />);
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(screen.getByRole("textbox", { name: "New to-do tasks" })).toHaveAttribute("readonly");
  fireEvent.click(screen.getByRole("button", { name: "Reload to-do list" }));
  expect(state.reload).toHaveBeenCalledTimes(1);
});

test("an explicit date is sent for every pasted task; the bottom instruction is removed", async () => {
  const state = tracker();
  render(<TodoTile tracker={state} />);
  fireEvent.change(screen.getByLabelText("Task date (today if empty)"), {
    target: { value: "2028-02-29" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "New to-do tasks" }), {
    target: { value: "First\nSecond" },
  });
  await waitFor(() =>
    expect(state.send).toHaveBeenCalledWith({
      type: "add",
      titles: ["First", "Second"],
      date: "2028-02-29",
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "New to-do tasks" })).toHaveValue(""),
  );
  expect(
    screen.queryByText("Enter adds a task. Paste several lines to add several tasks."),
  ).not.toBeInTheDocument();
});

test("selecting a date filters tasks and the date badge opens that calendar day", () => {
  const state = tracker({
    list: {
      enabled: true,
      revision: 1,
      tasks: [
        { ...task, date: "2028-02-29" },
        { id: "two", title: "Another day", date: "2028-03-01", completed: false },
      ],
    },
  });
  const select = jest.fn();
  const view = render(<TodoTile tracker={state} selectedDate="2028-02-29" onSelectDate={select} />);
  fireEvent.click(screen.getByRole("button", { name: "Selected day" }));
  expect(screen.getByText("Buy milk")).toBeInTheDocument();
  expect(screen.queryByText("Another day")).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Show " + formatDay("2028-02-29") + " in calendar" }),
  );
  expect(select).toHaveBeenCalledWith("2028-02-29");
  view.rerender(<TodoTile tracker={state} selectedDate="2028-03-01" onSelectDate={select} />);
  expect(screen.getByText("Another day")).toBeInTheDocument();
  expect(screen.queryByText("Buy milk")).not.toBeInTheDocument();
});

describe("completed tasks in the tile", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("a checked task stays struck through briefly, then moves to the tile's completed view", () => {
    const state = tracker();
    const view = render(<TodoTile tracker={state} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Complete task Buy milk" }));
    view.rerender(
      <TodoTile
        tracker={{ ...state, list: { ...state.list, tasks: [{ ...task, completed: true }] } }}
      />,
    );
    act(() => jest.advanceTimersByTime(1499));
    expect(screen.getByText("Buy milk").tagName).toBe("S");
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByText("Buy milk")).not.toBeInTheDocument();
    expect(screen.getByText("No active tasks.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Completed tasks (1)" }));
    expect(screen.getByRole("checkbox", { name: "Reopen task Buy milk" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Reopen task Buy milk" }));
    expect(state.send).toHaveBeenLastCalledWith({ type: "complete", id: "one", completed: false });
    view.rerender(<TodoTile tracker={state} />);
    expect(screen.getByText("No completed tasks yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Completed tasks (0)" }));
    expect(screen.getByRole("checkbox", { name: "Complete task Buy milk" })).not.toBeChecked();
  });

  test("reopening during the delay cancels removal and completing again gets a fresh delay", () => {
    const state = tracker();
    const view = render(<TodoTile tracker={state} />);
    const complete = () =>
      view.rerender(
        <TodoTile
          tracker={{ ...state, list: { ...state.list, tasks: [{ ...task, completed: true }] } }}
        />,
      );
    complete();
    act(() => jest.advanceTimersByTime(1000));
    view.rerender(<TodoTile tracker={state} />);
    act(() => jest.advanceTimersByTime(100));
    complete();
    act(() => jest.advanceTimersByTime(400));
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(1100));
    expect(screen.queryByText("Buy milk")).not.toBeInTheDocument();
  });

  test("each completed task has its own delay even when another task changes", () => {
    const second = { ...task, id: "two", title: "Buy bread" };
    const state = tracker({ list: { enabled: true, revision: 1, tasks: [task, second] } });
    const view = render(<TodoTile tracker={state} />);
    view.rerender(
      <TodoTile
        tracker={{
          ...state,
          list: { ...state.list, tasks: [{ ...task, completed: true }, second] },
        }}
      />,
    );
    act(() => jest.advanceTimersByTime(1000));
    view.rerender(
      <TodoTile
        tracker={{
          ...state,
          list: {
            ...state.list,
            tasks: [
              { ...task, completed: true },
              { ...second, completed: true },
            ],
          },
        }}
      />,
    );
    act(() => jest.advanceTimersByTime(500));
    expect(screen.queryByText("Buy milk")).not.toBeInTheDocument();
    expect(screen.getByText("Buy bread")).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.queryByText("Buy bread")).not.toBeInTheDocument();
  });

  test("previously completed tasks stay hidden on load and respect the selected day", () => {
    const state = tracker({ loading: true, list: { enabled: true, revision: 0, tasks: [] } });
    const view = render(<TodoTile tracker={state} selectedDate="2028-02-29" />);
    view.rerender(
      <TodoTile
        selectedDate="2028-02-29"
        tracker={{
          ...state,
          loading: false,
          list: {
            ...state.list,
            tasks: [
              { ...task, completed: true, date: "2028-02-29" },
              { ...task, id: "two", title: "Other day", completed: true, date: "2028-03-01" },
            ],
          },
        }}
      />,
    );
    expect(screen.queryByText("Buy milk")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Completed tasks (2)" }));
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByText("Other day")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Selected day" }));
    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(screen.queryByText("Other day")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Completed tasks (1)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("failed completion leaves the task in the active list", () => {
    const state = tracker({ send: jest.fn().mockRejectedValue(new Error("Offline")) });
    render(<TodoTile tracker={state} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Complete task Buy milk" }));
    act(() => jest.advanceTimersByTime(2000));
    expect(screen.getByRole("checkbox", { name: "Complete task Buy milk" })).not.toBeChecked();
  });
});
