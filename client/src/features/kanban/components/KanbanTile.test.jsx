import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import KanbanTile from "./KanbanTile";
import useKanbanBoard from "../hooks/useKanbanBoard";
import * as api from "../api/kanbanApi";
import { ApiError } from "../../../shared/api/http";
jest.mock("../api/kanbanApi");
const columns = [
  { id: "todo", name: "", kind: "todo", hidden: false, wipLimit: null },
  { id: "doing", name: "", kind: "doing", hidden: false, wipLimit: 3 },
  { id: "done", name: "", kind: "done", hidden: false, wipLimit: null },
];
const task = {
  id: "task-a",
  title: "Plan the release",
  description: "Check the details",
  columnId: "todo",
  position: 0,
  date: "2026-10-15",
  startedAt: null,
  completedAt: null,
};
const initial = { enabled: true, revision: 0, columns, tasks: [task] };
const onDate = jest.fn();
async function click(element) {
  fireEvent.click(element);
  await act(async () => {
    await Promise.resolve();
  });
}
function Fixture() {
  const tracker = useKanbanBoard();
  return <KanbanTile tracker={tracker} selectedDate="2026-10-15" onSelectDate={onDate} />;
}
function mount() {
  return render(
    <MemoryRouter>
      <Fixture />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  jest.resetAllMocks();
  api.getBoard.mockResolvedValue(initial);
  api.getHistory.mockResolvedValue([]);
});
test("creating dated tasks, moving them, completing and reopening preserve the task and share calendar selection", async () => {
  mount();
  await screen.findByRole("button", { name: task.title });
  await click(screen.getByRole("button", { name: "New task" }));
  const editor = await screen.findByRole("dialog", { name: "New task" });
  fireEvent.change(within(editor).getByLabelText("Task title"), { target: { value: "Ship" } });
  await click(within(editor).getByRole("button", { name: "Use selected calendar day" }));
  const added = { ...task, id: "task-b", title: "Ship", description: "", position: 1 };
  api.changeBoard.mockResolvedValueOnce({ ...initial, revision: 1, tasks: [task, added] });
  await click(within(editor).getByRole("button", { name: "Save task" }));
  await screen.findByRole("button", { name: "Ship", exact: true });
  expect(api.changeBoard).toHaveBeenLastCalledWith(
    expect.objectContaining({
      revision: 0,
      type: "task.create",
      title: "Ship",
      date: "2026-10-15",
    }),
  );
  const moved = { ...added, columnId: "doing", position: 0, startedAt: "2026-10-15T10:00:00Z" };
  api.changeBoard.mockResolvedValueOnce({ ...initial, revision: 2, tasks: [task, moved] });
  fireEvent.change(screen.getByLabelText("Move task Ship"), { target: { value: "doing" } });
  await waitFor(() =>
    expect(
      within(screen.getByRole("region", { name: "In progress", exact: true })).getByRole("button", {
        name: "Ship",
        exact: true,
      }),
    ).toBeInTheDocument(),
  );
  const finished = { ...moved, columnId: "done", completedAt: "2026-10-15T11:00:00Z" };
  api.changeBoard.mockResolvedValueOnce({ ...initial, revision: 3, tasks: [task, finished] });
  await click(screen.getByRole("button", { name: "Complete task Ship" }));
  await screen.findByRole("button", { name: "Reopen task Ship" });
  await click(screen.getByRole("button", { name: "History", exact: true }));
  expect(screen.getByRole("button", { name: "Ship", exact: true })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: task.title, exact: true })).not.toBeInTheDocument();
  api.changeBoard.mockResolvedValueOnce({
    ...initial,
    revision: 4,
    tasks: [task, { ...moved, columnId: "todo" }],
  });
  await click(screen.getByRole("button", { name: "Reopen task Ship" }));
  await screen.findByText("No completed tasks yet.");
  await click(screen.getByRole("button", { name: "History", exact: true }));
  expect(screen.getByRole("button", { name: "Ship", exact: true })).toBeInTheDocument();
  const card = screen.getByRole("button", { name: "Ship", exact: true });
  await click(
    within(screen.getByRole("region", { name: "To do", exact: true })).getAllByRole("button", {
      name: /Thursday, October 15/,
    })[0],
  );
  expect(onDate).toHaveBeenCalledWith("2026-10-15");
  expect(card).toBeInTheDocument();
});
test("all hidden columns can be restored and custom stages created without deleting tasks", async () => {
  const hidden = { ...initial, columns: columns.map((column) => ({ ...column, hidden: true })) };
  api.getBoard.mockResolvedValue(hidden);
  mount();
  await screen.findByText("All columns are hidden.");
  await click(screen.getByRole("button", { name: "Show columns" }));
  const dialog = await screen.findByRole("dialog", { name: "Board columns" });
  const shown = {
    ...hidden,
    revision: 1,
    columns: hidden.columns.map((column) =>
      column.id === "todo" ? { ...column, hidden: false } : column,
    ),
  };
  api.changeBoard.mockResolvedValueOnce(shown);
  await click(within(dialog).getByRole("checkbox", { name: "Show column To do" }));
  await waitFor(() =>
    expect(api.changeBoard).toHaveBeenCalledWith({
      type: "column.update",
      columnId: "todo",
      hidden: false,
      revision: 0,
    }),
  );
  const custom = { id: "review", name: "Review", kind: "doing", hidden: false, wipLimit: null };
  api.changeBoard.mockResolvedValueOnce({
    ...shown,
    revision: 2,
    columns: [...shown.columns, custom],
  });
  await waitFor(() =>
    expect(within(dialog).getByRole("button", { name: "Add column" })).toBeDisabled(),
  );
  fireEvent.change(within(dialog).getByLabelText("New column"), { target: { value: "Review" } });
  await click(within(dialog).getByRole("button", { name: "Add column" }));
  await within(dialog).findByLabelText("Name of Review");
  await click(within(dialog).getByRole("button", { name: "Done", exact: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("region", { name: "Review", exact: true })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: task.title, exact: true })).toBeInTheDocument();
});
test("a stale write preserves the draft and allows reload and retry from inside the editor", async () => {
  api.getBoard.mockResolvedValueOnce(initial).mockResolvedValueOnce({ ...initial, revision: 7 });
  api.changeBoard.mockRejectedValueOnce(
    new ApiError("The board changed. Reload it before saving.", 409),
  );
  mount();
  await screen.findByRole("button", { name: task.title });
  await click(screen.getByRole("button", { name: "New task" }));
  const dialog = await screen.findByRole("dialog", { name: "New task" });
  fireEvent.change(within(dialog).getByLabelText("Task title"), {
    target: { value: "Keep my draft" },
  });
  await click(within(dialog).getByRole("button", { name: "Save task" }));
  await within(dialog).findByRole("alert");
  expect(within(dialog).getByLabelText("Task title")).toHaveValue("Keep my draft");
  expect(within(dialog).getByRole("button", { name: "Close" })).toBeEnabled();
  await click(within(dialog).getByRole("button", { name: "Reload board" }));
  await waitFor(() =>
    expect(within(dialog).getByRole("button", { name: "Save task" })).toBeEnabled(),
  );
  api.changeBoard.mockResolvedValueOnce({
    ...initial,
    revision: 8,
    tasks: [task, { ...task, id: "new", title: "Keep my draft" }],
  });
  await click(within(dialog).getByRole("button", { name: "Save task" }));
  await screen.findByRole("button", { name: "Keep my draft", exact: true });
  expect(api.changeBoard).toHaveBeenLastCalledWith(
    expect.objectContaining({ revision: 7, title: "Keep my draft" }),
  );
});
function pointer(element, type, values = {}) {
  const event = createEvent[type](element, { bubbles: true, cancelable: true });
  for (const [key, value] of Object.entries({
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 100,
    clientY: 100,
    pointerType: "touch",
    ...values,
  }))
    Object.defineProperty(event, key, { value });
  fireEvent(element, event);
}
test("pointer dragging uses the same saved move as the explicit stage selector", async () => {
  const original = document.elementFromPoint;
  mount();
  await screen.findByRole("button", { name: task.title });
  const target = screen.getByRole("region", { name: "In progress", exact: true });
  document.elementFromPoint = () => target;
  api.changeBoard.mockResolvedValueOnce({
    ...initial,
    revision: 1,
    tasks: [{ ...task, columnId: "doing" }],
  });
  try {
    const handle = screen.getByRole("button", { name: "Drag task " + task.title });
    await act(async () => {
      pointer(handle, "pointerDown");
      pointer(handle, "pointerMove", { clientX: 450 });
      pointer(handle, "pointerUp", { clientX: 450 });
    });
    await waitFor(() =>
      expect(api.changeBoard).toHaveBeenCalledWith({
        type: "task.move",
        taskId: task.id,
        columnId: "doing",
        beforeId: null,
        revision: 0,
      }),
    );
    await waitFor(() =>
      expect(within(target).getByRole("button", { name: task.title })).toBeInTheDocument(),
    );
  } finally {
    document.elementFromPoint = original;
  }
});

test("deleting a card requires confirmation, preserves failed attempts and removes it after saving", async () => {
  mount();
  const remove = await screen.findByRole("button", { name: "Delete task " + task.title });
  await click(remove);
  let dialog = await screen.findByRole("dialog", { name: "Delete this task?" });
  expect(api.changeBoard).not.toHaveBeenCalled();
  await click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await click(remove);
  dialog = await screen.findByRole("dialog", { name: "Delete this task?" });
  api.changeBoard.mockRejectedValueOnce(new Error("Could not delete"));
  await click(within(dialog).getByRole("button", { name: "Delete task", exact: true }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent("Could not delete");
  expect(screen.getByRole("button", { name: task.title, exact: true })).toBeInTheDocument();
  api.changeBoard.mockResolvedValueOnce({ ...initial, revision: 1, tasks: [] });
  await click(within(dialog).getByRole("button", { name: "Delete task", exact: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(api.changeBoard).toHaveBeenLastCalledWith({
    type: "task.delete",
    taskId: task.id,
    revision: 0,
  });
  expect(screen.queryByRole("button", { name: task.title, exact: true })).not.toBeInTheDocument();
});

test("completed cards can be deleted from the task editor without loading hidden activity", async () => {
  api.getBoard.mockResolvedValue({
    ...initial,
    tasks: [{ ...task, columnId: "done", completedAt: "2026-10-19T08:00:00Z" }],
  });
  mount();
  await click(await screen.findByRole("button", { name: task.title, exact: true }));
  const editor = await screen.findByRole("dialog", { name: "Edit task" });
  expect(api.getHistory).not.toHaveBeenCalled();
  await click(within(editor).getByRole("button", { name: "Delete task", exact: true }));
  const dialog = await screen.findByRole("dialog", { name: "Delete this task?" });
  api.changeBoard.mockResolvedValueOnce({ ...initial, revision: 1, tasks: [] });
  await click(within(dialog).getByRole("button", { name: "Delete task", exact: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
