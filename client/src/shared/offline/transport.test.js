import { offlineRequest } from "./transport";
import { offlineNative } from "./bridge";
jest.mock("./bridge");
const taskId = "10000000-0000-4000-8000-000000000001";
beforeEach(() => {
  jest.resetAllMocks();
  Object.defineProperty(window, "crypto", {
    configurable: true,
    value: { randomUUID: () => taskId },
  });
});

test("ordinary reads ask native storage only for their section", async () => {
  offlineNative.mockResolvedValue({
    owner: "1",
    generation: 4,
    state: {
      todos: { enabled: true },
      ["todo/" + taskId]: { title: "Small read", completed: false, position: 0 },
    },
  });
  const result = await offlineRequest("/todos", { token: "session" });
  expect(offlineNative).toHaveBeenCalledWith("read", { token: "session", path: "/todos" });
  expect(result.tasks[0].title).toBe("Small read");
});

test("history pages do not hold the queue for local calendar edits", async () => {
  let finish;
  offlineNative.mockImplementation(async (action) => {
    if (action === "history")
      return new Promise((resolve) => {
        finish = resolve;
      });
    if (action === "read") return { owner: "1", generation: 4, state: {} };
    return { generation: 5 };
  });
  const history = offlineRequest("/kanban/tasks/" + taskId + "/history?limit=50&before=70", {
    token: "session",
  });
  await offlineRequest("/userDate/create", {
    token: "session",
    method: "POST",
    body: { date: "2026-10-19", comment: "While history loads" },
  });
  expect(offlineNative).toHaveBeenCalledWith("history", {
    token: "session",
    taskId,
    limit: 50,
    before: 70,
  });
  expect(offlineNative).toHaveBeenCalledWith("read", { token: "session", path: "/state" });
  expect(offlineNative).toHaveBeenCalledWith("write", expect.objectContaining({ generation: 4 }));
  finish({ events: [], nextCursor: null });
  await expect(history).resolves.toEqual({ events: [], nextCursor: null });
});

test("aborted local reads never write and late history replies are discarded", async () => {
  const abort = new AbortController();
  abort.abort();
  await expect(offlineRequest("/todos", { signal: abort.signal })).rejects.toHaveProperty(
    "name",
    "AbortError",
  );
  expect(offlineNative).not.toHaveBeenCalled();
  let finish;
  offlineNative.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const historyAbort = new AbortController();
  const request = offlineRequest("/kanban/tasks/" + taskId + "/history?limit=50", {
    signal: historyAbort.signal,
  });
  historyAbort.abort();
  finish({ events: [] });
  await expect(request).rejects.toHaveProperty("name", "AbortError");
});
