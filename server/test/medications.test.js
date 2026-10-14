const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
Object.assign(process.env, {
  DB_DIALECT: "sqlite",
  SQLITE_STORAGE: ":memory:",
  SECRET_KEY: "medication-test-only-secret",
  PORT: "5000",
});
const app = require("../src/app");
const database = require("../src/config/database");
const { User, MedicationIntake } = require("../src/models");
const { generateToken } = require("../src/services/tokenService");
const { isDue } = require("../src/services/medicationService");
let server, url, alice, bob;
before(async () => {
  await database.sync();
  alice = generateToken(
    await User.create({ email: "medication-alice@example.com", password: "not-a-real-password" }),
  );
  bob = generateToken(
    await User.create({ email: "medication-bob@example.com", password: "not-a-real-password" }),
  );
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  url = `http://127.0.0.1:${server.address().port}/api/medications`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await database.close();
});
async function request(path, token = alice, body) {
  const response = await fetch(url + path, {
    method: body ? "PUT" : "GET",
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
function fixture() {
  const slots = [
    { id: randomUUID(), time: "08:00", label: "Morning" },
    { id: randomUUID(), time: "20:30", label: "Evening" },
  ];
  const rows = [
    {
      id: randomUUID(),
      name: "Example A",
      detail: "User-entered label",
      slotIds: slots.map((slot) => slot.id),
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: "2026-10-01",
      endDate: null,
    },
    {
      id: randomUUID(),
      name: "Example B",
      detail: "",
      slotIds: [slots[0].id],
      weekdays: [3, 5],
      startDate: "2026-10-01",
      endDate: "2026-10-31",
    },
  ];
  return { enabled: true, reminders: false, revision: 0, slots, rows };
}
test("weekday recurrence uses date-only days across leap years and DST, with inclusive course dates", () => {
  const row = { weekdays: [0, 1, 2, 3, 4, 5, 6], startDate: "2024-02-29", endDate: "2026-03-09" };
  assert.equal(isDue(row, "2024-02-28"), false);
  assert.equal(isDue(row, "2024-02-29"), true);
  assert.equal(isDue(row, "2026-03-08"), true);
  assert.equal(isDue(row, "2026-03-09"), true);
  assert.equal(isDue(row, "2026-03-10"), false);
  assert.equal(isDue({ ...row, weekdays: [1] }, "2026-03-08"), false);
  assert.equal(isDue({ ...row, weekdays: [1] }, "2026-03-09"), true);
});
test("tracker is opt-in, plans belong to their owner, and malformed schedules never write", async () => {
  assert.equal((await request("/plan", null)).status, 401);
  assert.equal((await request("/plan")).data.enabled, false);
  const plan = fixture();
  for (const broken of [
    { ...plan, enabled: "true" },
    { ...plan, slots: [{ ...plan.slots[0], time: "24:00" }] },
    { ...plan, slots: [plan.slots[0], { ...plan.slots[1], time: plan.slots[0].time }] },
    { ...plan, rows: [{ ...plan.rows[0], weekdays: [] }] },
    { ...plan, rows: [{ ...plan.rows[0], startDate: "2026-02-30" }] },
    { ...plan, rows: [{ ...plan.rows[0], slotIds: [randomUUID()] }] },
    { ...plan, rows: [{ ...plan.rows[0], name: " " }] },
  ])
    assert.equal((await request("/plan", alice, broken)).status, 400);
  assert.equal((await request("/plan")).data.revision, 0);
});
test("individual and whole-column marks are idempotent, isolated, reversible and retain history", async () => {
  const plan = fixture();
  let saved = (await request("/plan", alice, { ...plan, userId: 999 })).data;
  assert.equal(saved.revision, 1);
  assert.equal((await request("/plan", bob)).data.enabled, false);
  assert.equal((await request("/plan", alice, plan)).status, 409);
  const cell = {
    date: "2026-10-14",
    medicationId: saved.rows[0].id,
    slotId: saved.slots[0].id,
    taken: true,
    revision: saved.revision,
  };
  assert.equal((await request("/intakes", bob, cell)).status, 409);
  assert.equal((await request("/intakes", alice, { ...cell, taken: "false" })).status, 400);
  assert.equal(
    (await request("/intakes", alice, { ...cell, medicationId: randomUUID() })).status,
    400,
  );
  assert.equal(
    (
      await request("/intakes", alice, {
        ...cell,
        date: "2026-11-01",
        medicationId: saved.rows[1].id,
      })
    ).status,
    400,
  );
  let result = await request("/intakes", alice, cell);
  assert.equal(result.status, 200);
  const firstId = result.data.records[0].id;
  result = await request("/intakes", alice, cell);
  assert.equal(result.data.records.length, 1);
  assert.equal(result.data.records[0].id, firstId);
  const column = { date: cell.date, slotId: cell.slotId, taken: true, revision: saved.revision };
  result = await request("/intakes/column", alice, column);
  assert.equal(result.status, 200);
  assert.equal(result.data.records.length, 2);
  result = await request("/intakes/column", alice, column);
  assert.equal(result.data.records.length, 2);
  assert.deepEqual((await request("/intakes?date=" + cell.date, bob)).data, []);
  assert.equal((await request("/intakes?date=2026-02-30")).status, 400);
  assert.equal(
    (await request("/intakes", alice, { ...cell, taken: false })).data.records.length,
    1,
  );
  assert.equal(
    (await request("/intakes/column", alice, { ...column, taken: false })).data.records.length,
    0,
  );
  await request("/intakes", alice, cell);
  const historical = await MedicationIntake.findOne();
  assert.equal(historical.nameSnapshot, "Example A");
  assert.equal(historical.timeSnapshot, "08:00");
  saved = (await request("/plan", alice, { ...saved, enabled: false, rows: [], slots: [] })).data;
  assert.equal(
    (await request("/intakes", alice, { ...cell, revision: saved.revision })).status,
    409,
  );
  assert.equal((await request("/intakes?date=" + cell.date)).data.length, 1);
  saved = (await request("/plan", alice, { ...saved, enabled: true })).data;
  assert.equal(
    (await request("/intakes", alice, { ...cell, revision: saved.revision, taken: false })).data
      .records.length,
    0,
  );
});
