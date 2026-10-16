const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
Object.assign(process.env, {
  DB_DIALECT: "sqlite",
  SQLITE_STORAGE: ":memory:",
  SECRET_KEY: "todos-test-only-secret",
  PORT: "5000",
});
const app = require("../src/app");
const database = require("../src/config/database");
const { User } = require("../src/models");
const { generateToken } = require("../src/services/tokenService");
let server, url, alice, bob;
before(async () => {
  await database.sync();
  alice = generateToken(
    await User.create({ email: "todo-alice@example.com", password: "test-only" }),
  );
  bob = generateToken(await User.create({ email: "todo-bob@example.com", password: "test-only" }));
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  url = `http://127.0.0.1:${server.address().port}/api/todos`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await database.close();
});
async function request(command, token = alice) {
  const response = await fetch(url, {
    method: command ? "POST" : "GET",
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      "Content-Type": "application/json",
    },
    body: command ? JSON.stringify(command) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
async function read(token = alice) {
  return (await request(undefined, token)).data;
}
async function change(command, token = alice) {
  return request({ revision: (await read(token)).revision, ...command }, token);
}
test("lists are opt-in and require authentication", async () => {
  assert.equal((await request(undefined, null)).status, 401);
  assert.equal((await read()).enabled, false);
  assert.equal((await change({ type: "add", titles: ["First"] })).status, 409);
  assert.equal((await change({ type: "enabled", enabled: true })).status, 200);
});
test("batch lines persist, completion is reversible and disabling preserves every task", async () => {
  let saved = (await change({ type: "add", titles: [" First ", "Second"] })).data;
  assert.deepEqual(
    saved.tasks.map((task) => task.title),
    ["First", "Second"],
  );
  const id = saved.tasks[0].id;
  saved = (await change({ type: "complete", id, completed: true })).data;
  assert.equal(saved.tasks[0].completed, true);
  assert.deepEqual((await read()).tasks, saved.tasks);
  await change({ type: "enabled", enabled: false });
  await change({ type: "enabled", enabled: true });
  assert.deepEqual((await read()).tasks, saved.tasks);
  await change({ type: "complete", id, completed: false });
  saved = (await change({ type: "edit", id, title: "Revised" })).data;
  assert.deepEqual(saved.tasks[0], { id, title: "Revised", completed: false });
});
test("other accounts and stale revisions cannot overwrite a list", async () => {
  const saved = await read();
  const id = saved.tasks[0].id;
  await change({ type: "enabled", enabled: true }, bob);
  assert.equal((await change({ type: "edit", id, title: "Intrusion" }, bob)).status, 404);
  assert.deepEqual((await read(bob)).tasks, []);
  await change({ type: "complete", id, completed: true });
  assert.equal((await request({ type: "remove", id, revision: saved.revision })).status, 409);
  assert.equal((await read()).tasks[0].id, id);
});
test("invalid batches are atomic; deleting removes only the selected task", async () => {
  for (const command of [
    { type: "add", titles: ["Valid", ""] },
    { type: "add", titles: ["Two\nlines"] },
    { type: "add", titles: ["x".repeat(501)] },
    { type: "add", titles: Array(101).fill("Task") },
    { type: "add", titles: [] },
    { type: "enabled", enabled: "false" },
    { type: "complete", id: (await read()).tasks[0].id, completed: "true" },
    { type: "unknown" },
  ]) {
    const saved = await read();
    assert.equal((await change(command)).status, 400);
    assert.deepEqual(await read(), saved);
  }
  const saved = await read();
  await change({ type: "remove", id: saved.tasks[0].id });
  assert.deepEqual((await read()).tasks, saved.tasks.slice(1));
});
