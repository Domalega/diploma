const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
Object.assign(process.env, {
  DB_DIALECT: "sqlite",
  SQLITE_STORAGE: ":memory:",
  SECRET_KEY: "kanban-test-only-secret",
  PORT: "5000",
});
const app = require("../src/app");
const database = require("../src/config/database");
const { User, KanbanTask, KanbanEvent } = require("../src/models");
const { generateToken } = require("../src/services/tokenService");
let server, url, alice, bob;
before(async () => {
  await database.sync();
  alice = generateToken(
    await User.create({ email: "kanban-alice@example.com", password: "test-only" }),
  );
  bob = generateToken(
    await User.create({ email: "kanban-bob@example.com", password: "test-only" }),
  );
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  url = `http://127.0.0.1:${server.address().port}/api/kanban`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await database.close();
});
async function request(token = alice, command, path = "") {
  const response = await fetch(url + path, {
    method: command ? "POST" : "GET",
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(command ? { "Content-Type": "application/json" } : {}),
    },
    body: command ? JSON.stringify(command) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
async function read(token = alice) {
  return (await request(token)).data;
}
async function change(command, token = alice) {
  return request(token, { revision: (await read(token)).revision, ...command });
}
test("boards are opt-in, owner-scoped and reject invalid changes without advancing revision", async () => {
  assert.equal((await request(null)).status, 401);
  assert.equal((await read()).enabled, false);
  assert.deepEqual(
    (await read()).columns.map((column) => column.kind),
    ["todo", "doing", "done"],
  );
  assert.equal((await change({ type: "enabled", enabled: "true" })).status, 400);
  assert.equal((await read()).revision, 0);
  assert.equal(
    (await change({ type: "task.create", title: "Hidden", columnId: "todo" })).status,
    409,
  );
  assert.equal((await change({ type: "enabled", enabled: true })).status, 200);
  assert.equal((await read(bob)).enabled, false);
  for (const command of [
    { type: "task.create", title: " ", columnId: "todo" },
    { type: "task.create", title: "Bad date", columnId: "todo", date: "2026-02-30" },
    { type: "column.update", columnId: "doing", hidden: "false" },
    { type: "column.update", columnId: "doing", wipLimit: -1 },
    { type: "column.move", columnId: "todo", index: 9 },
    { type: "unknown" },
  ]) {
    const before = await read();
    assert.equal((await change(command)).status, 400);
    assert.deepEqual(await read(), before);
  }
});
test("dated tasks persist, cannot be accessed through another account, and stale updates cannot overwrite them", async () => {
  let saved = (
    await change({
      type: "task.create",
      title: "Plan",
      description: "Keep this text",
      date: "2026-10-15",
      columnId: "todo",
      userId: 999,
    })
  ).data;
  const task = saved.tasks[0];
  assert.equal(task.date, "2026-10-15");
  assert.equal(task.description, "Keep this text");
  assert.equal((await request(bob, undefined, "/tasks/" + task.id + "/history")).status, 404);
  await change({ type: "enabled", enabled: true }, bob);
  assert.equal(
    (await change({ type: "task.update", taskId: task.id, title: "Intrusion", date: null }, bob))
      .status,
    404,
  );
  const revision = saved.revision;
  saved = (
    await change({
      type: "task.update",
      taskId: task.id,
      title: "Updated",
      description: "Preserved",
      date: null,
    })
  ).data;
  assert.equal(
    (
      await request(alice, {
        type: "task.update",
        revision,
        taskId: task.id,
        title: "Stale",
        date: "2026-10-15",
      })
    ).status,
    409,
  );
  assert.equal((await read()).tasks[0].title, "Updated");
  assert.equal((await read()).tasks[0].date, null);
  assert.equal((await read(bob)).tasks.length, 0);
});
test("WIP limits are enforced, completion and reopening retain immutable history, and disabling loses nothing", async () => {
  let saved = (await change({ type: "task.create", title: "Second", columnId: "todo" })).data;
  const [a, b] = saved.tasks;
  await change({ type: "column.update", columnId: "doing", wipLimit: 1 });
  saved = (await change({ type: "task.move", taskId: a.id, columnId: "doing" })).data;
  assert.ok(saved.tasks.find((task) => task.id === a.id).startedAt);
  const before = await read();
  assert.equal((await change({ type: "task.move", taskId: b.id, columnId: "doing" })).status, 409);
  assert.deepEqual(await read(), before);
  saved = (await change({ type: "task.complete", taskId: a.id })).data;
  const completed = saved.tasks.find((task) => task.id === a.id);
  assert.equal(completed.columnId, "done");
  assert.ok(completed.completedAt);
  saved = (await change({ type: "task.complete", taskId: a.id })).data;
  assert.equal(saved.tasks.find((task) => task.id === a.id).completedAt, completed.completedAt);
  await change({ type: "column.update", columnId: "done", hidden: true });
  assert.equal((await read()).tasks.length, 2);
  saved = (await change({ type: "task.reopen", taskId: a.id })).data;
  assert.equal(saved.tasks.find((task) => task.id === a.id).completedAt, null);
  const events = (await request(alice, undefined, "/tasks/" + a.id + "/history")).data;
  assert.ok(events.some((event) => event.kind === "completed"));
  assert.ok(events.some((event) => event.kind === "reopened"));
  assert.ok(events.some((event) => event.kind === "edited"));
  await change({ type: "enabled", enabled: false });
  await change({ type: "enabled", enabled: true });
  assert.deepEqual((await read()).tasks, saved.tasks);
});
test("custom stages can be renamed, reordered or all hidden without losing tasks; insertion order is atomic", async () => {
  let saved = (await change({ type: "column.create", name: "Review" })).data;
  const custom = saved.columns.find((column) => column.name === "Review");
  saved = (await change({ type: "column.move", columnId: custom.id, index: 0 })).data;
  assert.equal(saved.columns[0].id, custom.id);
  await change({ type: "column.update", columnId: custom.id, name: "Waiting" });
  const tasks = (await read()).tasks;
  await change({ type: "task.move", taskId: tasks[0].id, columnId: custom.id });
  await change({
    type: "task.move",
    taskId: tasks[1].id,
    columnId: custom.id,
    beforeId: tasks[0].id,
  });
  saved = await read();
  assert.deepEqual(
    saved.tasks
      .filter((task) => task.columnId === custom.id)
      .sort((a, b) => a.position - b.position)
      .map((task) => task.id),
    [tasks[1].id, tasks[0].id],
  );
  const before = await read();
  assert.equal(
    (
      await change({
        type: "task.move",
        taskId: tasks[1].id,
        columnId: "todo",
        beforeId: tasks[0].id,
      })
    ).status,
    400,
  );
  assert.deepEqual(await read(), before);
  for (const column of saved.columns)
    await change({ type: "column.update", columnId: column.id, hidden: true });
  saved = await read();
  assert.ok(saved.columns.every((column) => column.hidden));
  assert.equal(saved.tasks.length, 2);
  assert.equal(saved.columns[0].name, "Waiting");
});

test("task deletion is private, revision-checked and removes its history", async () => {
  const created = (await change({ type: "task.create", title: "Delete me", columnId: "done" }))
    .data;
  const task = created.tasks.find((task) => task.title === "Delete me");
  assert.ok(await KanbanEvent.count({ where: { taskId: task.id } }));
  assert.equal((await change({ type: "task.delete", taskId: task.id }, bob)).status, 404);
  assert.equal(
    (await request(alice, { type: "task.delete", taskId: task.id, revision: created.revision - 1 }))
      .status,
    409,
  );
  assert.ok(await KanbanTask.findByPk(task.id));
  const saved = (await change({ type: "task.delete", taskId: task.id })).data;
  assert.ok(!saved.tasks.some((item) => item.id === task.id));
  assert.equal(await KanbanTask.findByPk(task.id), null);
  assert.equal(await KanbanEvent.count({ where: { taskId: task.id } }), 0);
  assert.equal(
    (await request(alice, undefined, "/tasks/" + task.id + "/history?limit=10")).status,
    404,
  );
  assert.equal((await change({ type: "task.delete", taskId: task.id })).status, 404);
});

test("activity pages use stable cursors and retain the legacy history response", async () => {
  const board = await read();
  const task = board.tasks[0];
  const recent = Array.from({ length: 6 }, (_, index) => ({
    userId: task.userId,
    taskId: task.id,
    kind: "edited",
    details: { title: "Edit " + index },
  }));
  await KanbanEvent.bulkCreate(recent);
  const path = "/tasks/" + task.id + "/history";
  const all = (await request(alice, undefined, path)).data;
  const first = (await request(alice, undefined, path + "?limit=3")).data;
  assert.deepEqual(first.events, all.slice(0, 3));
  await KanbanEvent.create({ ...recent[0], details: { title: "Added between pages" } });
  const second = (await request(alice, undefined, path + "?limit=3&before=" + first.nextCursor))
    .data;
  assert.deepEqual(second.events, all.slice(3, 6));
  for (const query of ["?limit=0", "?limit=101", "?before=-1", "?before=1.2", "?limit[]=3"])
    assert.equal((await request(alice, undefined, path + query)).status, 400);
});

test("reordering a long column updates positions in one batch and rolls back invalid moves", async () => {
  const board = (await change({ type: "column.create", name: "Batch positions" })).data;
  const column = board.columns.find((item) => item.name === "Batch positions");
  const owner = board.userId;
  const created = await KanbanTask.bulkCreate(
    Array.from({ length: 80 }, (_, position) => ({
      userId: owner,
      columnId: column.id,
      title: "Card " + position,
      position,
    })),
  );
  const sql = [];
  const previousLogging = database.options.logging;
  database.options.logging = (statement) => sql.push(statement);
  let saved;
  try {
    saved = await change({
      type: "task.move",
      taskId: created[79].id,
      columnId: column.id,
      beforeId: created[0].id,
    });
  } finally {
    database.options.logging = previousLogging;
  }
  assert.equal(saved.status, 200);
  const ordered = saved.data.tasks.filter((item) => item.columnId === column.id);
  assert.deepEqual(
    ordered.map((item) => item.position),
    Array.from({ length: 80 }, (_, index) => index),
  );
  assert.equal(ordered[0].id, created[79].id);
  assert.equal(sql.filter((statement) => /UPDATE.*kanbanTasks.*CASE/.test(statement)).length, 1);
  assert.equal(sql.filter((statement) => /UPDATE.*kanbanTasks/.test(statement)).length, 2);
  const before = await read();
  assert.equal(
    (
      await change({
        type: "task.move",
        taskId: created[0].id,
        columnId: "todo",
        beforeId: created[1].id,
      })
    ).status,
    400,
  );
  assert.deepEqual(await read(), before);
});

test("a failure in a later position batch rolls back the entire move", async (t) => {
  const board = (await change({ type: "column.create", name: "Rollback batch" })).data;
  const column = board.columns.find((item) => item.name === "Rollback batch");
  const created = await KanbanTask.bulkCreate(
    Array.from({ length: 520 }, (_, position) => ({
      userId: board.userId,
      columnId: column.id,
      title: "Batch card " + position,
      position,
    })),
  );
  const before = await read();
  const query = database.query;
  let batches = 0;
  const mocked = t.mock.method(database, "query", function (statement, options) {
    if (
      typeof statement === "string" &&
      /UPDATE.*kanbanTasks.*CASE/.test(statement) &&
      ++batches === 2
    )
      return Promise.reject(new Error("Simulated second-batch failure"));
    return query.call(this, statement, options);
  });
  t.mock.method(console, "error", () => {});
  const result = await change({
    type: "task.move",
    taskId: created[519].id,
    columnId: column.id,
    beforeId: created[0].id,
  });
  mocked.mock.restore();
  assert.equal(result.status, 500);
  assert.equal(batches, 2);
  assert.deepEqual(await read(), before);
});
