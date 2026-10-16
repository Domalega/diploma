import { localApi } from "./localApi";
const taskId = "10000000-0000-4000-8000-000000000001";
const rowId = "10000000-0000-4000-8000-000000000002";
const slotId = "10000000-0000-4000-8000-000000000003";
const uuid = "10000000-0000-4000-8000-000000000004";
const source = () => ({
  owner: "7",
  generation: 3,
  history: {},
  state: {
    todos: { enabled: true },
    board: {
      enabled: true,
      columns: [
        { id: "todo", kind: "todo", name: "", hidden: false, wipLimit: null },
        { id: "doing", kind: "doing", name: "", hidden: false, wipLimit: 1 },
        { id: "done", kind: "done", name: "", hidden: false, wipLimit: null },
      ],
    },
    medications: {
      enabled: true,
      reminders: true,
      rows: [
        {
          id: rowId,
          name: "A",
          detail: "",
          startDate: "2026-10-01",
          endDate: null,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          slotIds: [slotId],
        },
      ],
      slots: [{ id: slotId, time: "08:00", label: "" }],
    },
    ["todo/" + taskId]: { title: "Local task", completed: false, position: 0 },
  },
});
beforeEach(() => {
  Object.defineProperty(window, "crypto", {
    configurable: true,
    value: { randomUUID: jest.fn().mockReturnValue(uuid) },
  });
});
test("notes can be created, edited, moved and deleted without changing the source snapshot", () => {
  let doc = source();
  const initial = JSON.stringify(doc);
  const created = localApi(doc, "/userDate/create", "POST", {
    date: "2026-10-16",
    comment: "Offline",
  });
  expect(created.result.note.id).toBe(uuid);
  expect(JSON.stringify(doc)).toBe(initial);
  doc = { ...doc, state: created.state };
  const edited = localApi(doc, "/userDate/update", "PATCH", {
    id: uuid,
    date: "2026-10-17",
    comment: "Revised",
    time: "10:00",
  });
  expect(edited.state["note/" + uuid]).toEqual({
    date: "2026-10-17",
    comment: "Revised",
    time: "10:00",
  });
  const removed = localApi({ ...doc, state: edited.state }, "/userDate/delete", "DELETE", {
    id: uuid,
  });
  expect(removed.state["note/" + uuid]).toBeUndefined();
});
test("to-do completion, editing and deletion are durable snapshot changes", () => {
  const doc = source();
  let next = localApi(doc, "/todos", "POST", { type: "complete", id: taskId, completed: true });
  expect(next.result.tasks[0].completed).toBe(true);
  expect(next.result.revision).toBe(4);
  next = localApi({ ...doc, state: next.state }, "/todos", "POST", {
    type: "edit",
    id: taskId,
    title: "Changed",
  });
  expect(next.result.tasks[0].title).toBe("Changed");
  next = localApi({ ...doc, state: next.state }, "/todos", "POST", { type: "remove", id: taskId });
  expect(next.result.tasks).toEqual([]);
});
test("board moves preserve capacity limits and completion can be reopened", () => {
  const doc = source();
  let next = localApi(doc, "/kanban", "POST", {
    type: "task.create",
    columnId: "doing",
    title: "First",
  });
  expect(next.result.tasks[0].startedAt).toBeTruthy();
  expect(() =>
    localApi({ ...doc, state: next.state }, "/kanban", "POST", {
      type: "task.create",
      columnId: "doing",
      title: "Second",
    }),
  ).toThrow(/limit/);
  next = localApi({ ...doc, state: next.state }, "/kanban", "POST", {
    type: "task.complete",
    taskId: uuid,
  });
  expect(next.result.tasks[0].completedAt).toBeTruthy();
  next = localApi({ ...doc, state: next.state }, "/kanban", "POST", {
    type: "task.reopen",
    taskId: uuid,
  });
  expect(next.result.tasks[0].columnId).toBe("todo");
  expect(next.result.tasks[0].completedAt).toBeNull();
});
test("medication marks retain their historical labels after the plan changes", () => {
  const doc = source();
  const values = { date: "2026-10-16", medicationId: rowId, slotId, taken: true };
  const next = localApi(doc, "/medications/intakes", "PUT", values);
  expect(next.result.records).toHaveLength(1);
  expect(next.result.records[0].nameSnapshot).toBe("A");
  const unmarked = localApi({ ...doc, state: next.state }, "/medications/intakes", "PUT", {
    ...values,
    taken: false,
  });
  expect(unmarked.result.records).toEqual([]);
});
