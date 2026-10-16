import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
