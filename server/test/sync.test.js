const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");
Object.assign(process.env, {
  DB_DIALECT: "sqlite",
  SQLITE_STORAGE: ":memory:",
  SECRET_KEY: "offline-sync-test-only",
  PORT: "5000",
});
const app = require("../src/app");
const db = require("../src/config/database");
const { User, UserDate, SyncReceipt, KanbanEvent, KanbanTask } = require("../src/models");
const { generateToken } = require("../src/services/tokenService");
const { merge } = require("../src/services/syncMerge");
let server, url, alice, bob, owner;
before(async () => {
  await db.sync();
  const user = await User.create({ email: "sync-alice@example.com", password: "test-only" });
  owner = user.id;
  alice = generateToken(user);
  bob = generateToken(await User.create({ email: "sync-bob@example.com", password: "test-only" }));
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  url = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.close();
});
async function request(path, body, token = alice, method = body ? "POST" : "GET") {
  const response = await fetch(url + path, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
const read = async (token = alice) => (await request("/sync", undefined, token)).data;
const exchange = (base, local, operationId = randomUUID(), token = alice) =>
  request("/sync", { version: 1, base, local, operationId }, token);

test("matching intake marks converge despite different device timestamps", () => {
  const key = "intake/day/med/slot";
  const result = merge(
    {},
    { [key]: { takenAt: "2026-10-16T08:00:00Z" } },
    { [key]: { takenAt: "2026-10-16T08:00:01Z" } },
  );
  assert.deepEqual(result.conflicts, []);
});

test("offline schedules, intake history and board activity reach the ordinary web APIs", async () => {
  const base = (await read()).state,
    local = structuredClone(base),
    row = randomUUID(),
    slot = randomUUID(),
    task = randomUUID();
  local.board.enabled = true;
  local["task/" + task] = {
    columnId: "done",
    title: "Completed offline",
    description: "Kept",
    date: "2026-10-16",
    position: 0,
    startedAt: "2026-10-16T07:00:00.000Z",
    completedAt: "2026-10-16T08:00:00.000Z",
  };
  local.medications = {
    enabled: true,
    reminders: true,
    slots: [{ id: slot, time: "08:00", label: "Morning" }],
    rows: [
      {
        id: row,
        name: "Medicine",
        detail: "Dose",
        slotIds: [slot],
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        startDate: "2026-10-01",
        endDate: null,
      },
    ],
  };
  local[`intake/2026-10-16/${row}/${slot}`] = {
    date: "2026-10-16",
    medicationId: row,
    slotId: slot,
    takenAt: "2026-10-16T08:00:00.000Z",
    nameSnapshot: "Medicine",
    detailSnapshot: "Dose",
    timeSnapshot: "08:00",
    slotLabelSnapshot: "Morning",
  };
  const operation = randomUUID();
  assert.equal((await exchange(base, local, operation)).status, 200);
  const history = (await request(`/kanban/tasks/${task}/history`)).data;
  assert.equal(history.length, 1);
  assert.equal(history[0].details.source, "offline");
  assert.equal(
    (await request("/medications/intakes?date=2026-10-16")).data[0].nameSnapshot,
    "Medicine",
  );
  await exchange(base, local, operation);
  assert.equal((await request(`/kanban/tasks/${task}/history`)).data.length, 1);
});

test("combined WIP overflow reports the affected versions instead of overwriting remote work", async () => {
  const base = (await read()).state,
    local = structuredClone(base),
    web = structuredClone(base),
    a = randomUUID(),
    b = randomUUID();
  local.board.enabled = true;
  web.board.enabled = true;
  local.board.columns.find((c) => c.id === "doing").wipLimit = 1;
  web.board.columns.find((c) => c.id === "doing").wipLimit = 1;
  const value = {
    columnId: "doing",
    title: "Phone",
    description: "",
    date: null,
    position: 0,
    startedAt: "2026-10-16T08:00:00.000Z",
    completedAt: null,
  };
  local["task/" + a] = value;
  web["task/" + b] = { ...value, title: "Web" };
  assert.equal((await exchange(base, web)).status, 200);
  const response = await exchange(base, local);
  assert.equal(response.status, 409);
  assert(response.data.conflicts.includes("task/" + a));
  assert(response.data.conflicts.includes("task/" + b));
  assert.equal((await read()).state["task/" + a], undefined);
  assert.equal((await read()).state["task/" + b].title, "Web");
});

test("snapshots are authenticated, private and assign stable note identities without changing note IDs", async () => {
  assert.equal((await request("/sync", undefined, null)).status, 401);
  const note = await UserDate.create({ userId: owner, date: "2026-10-16", comment: "Existing" });
  const snapshot = await read(),
    again = await read();
  const key = Object.keys(snapshot.state).find((k) => k.startsWith("note/"));
  assert.equal(snapshot.state[key].comment, "Existing");
  assert.deepEqual(snapshot, again);
  assert.equal((await UserDate.findByPk(note.id)).comment, "Existing");
  assert.equal(Object.keys((await read(bob)).state).filter((k) => k.startsWith("note/")).length, 0);
});
test("independent phone and web edits merge; retried uploads never duplicate notes or history", async () => {
  const receiptsBefore = await SyncReceipt.count();
  const base = (await read()).state,
    local = structuredClone(base),
    key = "note/" + randomUUID(),
    id = randomUUID();
  local[key] = { date: "2026-10-17", comment: "Offline note", time: "09:30" };
  local.todos.enabled = true;
  local["todo/" + id] = { title: "Offline task", completed: false, position: 0 };
  await request("/userDate/create", { date: "2026-10-18", comment: "From web" });
  const operation = randomUUID();
  const first = await exchange(base, local, operation);
  assert.equal(first.status, 200);
  assert.equal(Object.keys(first.data.state).filter((k) => k.startsWith("note/")).length, 3);
  assert.equal(first.data.state[key].time, "09:30");
  assert.deepEqual((await exchange(base, local, operation)).data, first.data);
  assert.equal(await SyncReceipt.count(), receiptsBefore + 1);
  assert.equal((await request("/todos")).data.tasks[0].title, "Offline task");
  const tampered = structuredClone(local);
  tampered[key].comment = "Changed retry";
  assert.equal((await exchange(base, tampered, operation)).status, 400);
});
test("same-item edits and delete-versus-edit conflicts preserve both sides and write nothing", async () => {
  const base = (await read()).state,
    key = Object.keys(base).find((k) => k.startsWith("todo/"));
  const local = structuredClone(base);
  local[key].title = "Phone version";
  const list = (await request("/todos")).data;
  await request("/todos", {
    revision: list.revision,
    type: "edit",
    id: key.slice(5),
    title: "Web version",
  });
  const remote = await read();
  const result = await exchange(base, local);
  assert.equal(result.status, 409);
  assert.deepEqual(result.data.conflicts, [key]);
  assert.deepEqual(await read(), remote);
  delete local[key];
  assert.equal((await exchange(base, local)).status, 409);
  const resolved = merge(base, local, remote.state, "remote").state;
  assert.equal((await exchange(remote.state, resolved)).status, 200);
});
test("offline deletion propagates and delayed retries cannot resurrect a deleted note", async () => {
  const base = (await read()).state,
    key = Object.keys(base).find((k) => k.startsWith("note/")),
    local = structuredClone(base),
    operation = randomUUID();
  delete local[key];
  assert.equal((await exchange(base, local, operation)).status, 200);
  const newer = (await read()).state;
  const added = structuredClone(newer),
    newKey = "note/" + randomUUID();
  added[newKey] = { date: "2026-11-01", comment: "Later", time: null };
  await exchange(newer, added);
  const retry = await exchange(base, local, operation);
  assert.equal(retry.data.state[key], undefined);
  assert.equal(retry.data.state[newKey].comment, "Later");
});
test("malformed snapshots roll back and settings cannot change ownership", async () => {
  const base = (await read()).state;
  const bad = structuredClone(base);
  bad["todo/" + randomUUID()] = { title: "", completed: false, position: 0 };
  assert.equal((await exchange(base, bad)).status, 400);
  assert.deepEqual((await read()).state, base);
  const local = structuredClone(base);
  local.board.userId = 999;
  local.medications.userId = 999;
  assert.equal((await exchange(base, local)).status, 200);
  assert.deepEqual((await read(bob)).state.todos, { enabled: false });
});
test("simultaneous uploads and ordinary web writes do not lose unrelated tasks", async () => {
  const base = (await read()).state,
    a = structuredClone(base),
    b = structuredClone(base);
  const x = "note/" + randomUUID(),
    y = "note/" + randomUUID();
  a[x] = { date: "2026-11-02", comment: "Phone A", time: null };
  b[y] = { date: "2026-11-03", comment: "Phone B", time: null };
  const results = await Promise.all([
    exchange(base, a),
    exchange(base, b),
    request("/userDate/create", { date: "2026-11-04", comment: "Concurrent web" }),
  ]);
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200, 200],
  );
  const saved = (await read()).state;
  assert.equal(saved[x].comment, "Phone A");
  assert.equal(saved[y].comment, "Phone B");
  assert(Object.values(saved).some((v) => v.comment === "Concurrent web"));
});

test("compact sync omits history queries, preserves data and keeps upload retries idempotent", async (t) => {
  const legacy = await read();
  const findAll = t.mock.method(KanbanEvent, "findAll", async () => {
    throw new Error("Compact sync must not load activity");
  });
  const compact = await request("/sync?history=none");
  assert.equal(compact.status, 200);
  assert.deepEqual(compact.data.state, legacy.state);
  assert.equal(compact.data.history, undefined);
  const local = structuredClone(legacy.state);
  const key = "note/" + randomUUID();
  local[key] = { date: "2026-10-20", comment: "Compact upload", time: null };
  const body = {
    version: 1,
    operationId: randomUUID(),
    base: legacy.state,
    local,
    includeHistory: false,
  };
  const saved = await request("/sync", body);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.history, undefined);
  assert.equal(saved.data.state[key].comment, "Compact upload");
  assert.deepEqual((await request("/sync", body)).data, saved.data);
  assert.equal(findAll.mock.callCount(), 0);
  assert.equal((await request("/sync", { ...body, includeHistory: "false" })).status, 400);
});

test("offline task deletion conflicts with remote edits and cascades activity after resolution", async () => {
  const base = (await read()).state;
  const key = Object.keys(base).find((name) => name.startsWith("task/"));
  const id = key.slice(5);
  const local = structuredClone(base);
  delete local[key];
  const board = (await request("/kanban")).data;
  await request("/kanban", {
    revision: board.revision,
    type: "task.update",
    taskId: id,
    title: "Edited while phone was offline",
  });
  const conflict = await exchange(base, local);
  assert.equal(conflict.status, 409);
  assert.ok(conflict.data.conflicts.includes(key));
  assert.ok(await KanbanTask.findByPk(id));
  const resolved = merge(base, local, conflict.data.state, "local").state;
  assert.equal((await exchange(conflict.data.state, resolved)).status, 200);
  assert.equal(await KanbanTask.findByPk(id), null);
  assert.equal(await KanbanEvent.count({ where: { taskId: id } }), 0);
});
