const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");
const { Sequelize, QueryTypes } = require("sequelize");
const bcrypt = require("bcrypt");

// A fresh temporary file exercises real SQL without touching the local calendar.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "diploma-sqlite-test-"));
const storage = path.join(directory, "test.sqlite");
Object.assign(process.env, {
  DB_DIALECT: "sqlite",
  SQLITE_STORAGE: storage,
  SECRET_KEY: "sqlite-test-only-secret",
  PORT: "5000",
});
const app = require("../src/app");
const sequelize = require("../src/config/database");
const { User } = require("../src/models");
let server;
let baseUrl;

before(async () => {
  await sequelize.authenticate();
  await sequelize.sync();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

async function request(route, { method = "GET", token, body } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

test("real SQLite supports registration, login, persistence and private notes", async () => {
  const credentials = { email: "alice@example.com", password: "test-password" };
  const registered = await request("/user/registration", { method: "POST", body: credentials });
  assert.equal(registered.status, 200);
  assert.ok(registered.data.token);
  const duplicate = await request("/user/registration", { method: "POST", body: credentials });
  assert.equal(duplicate.status, 409);

  const storedUser = await User.findOne({ where: { email: credentials.email } });
  assert.notEqual(storedUser.password, credentials.password);
  assert.equal(await bcrypt.compare(credentials.password, storedUser.password), true);

  const loggedIn = await request("/user/login", { method: "POST", body: credentials });
  assert.equal(loggedIn.status, 200);
  const alice = loggedIn.data.token;
  assert.equal((await request("/user/auth", { token: alice })).status, 200);
  assert.equal(
    (
      await request("/user/login", {
        method: "POST",
        body: { ...credentials, password: "wrong" },
      })
    ).status,
    401,
  );

  const bobRegistration = await request("/user/registration", {
    method: "POST",
    body: { email: "bob@example.com", password: "other-password" },
  });
  assert.equal(bobRegistration.status, 200);
  const bob = bobRegistration.data.token;
  const note = { date: "2026-10-14", comment: "Проверка сохранения" };
  assert.equal(
    (await request("/userDate/create", { method: "POST", token: alice, body: note })).status,
    200,
  );
  assert.equal(
    (
      await request("/userDate/create", {
        method: "POST",
        token: alice,
        body: { ...note, time: "12:99" },
      })
    ).status,
    400,
  );
  assert.equal((await request("/userDate/get")).status, 401);

  const aliceNotes = await request("/userDate/get", { token: alice });
  assert.equal(aliceNotes.status, 200);
  assert.equal(aliceNotes.data.length, 1);
  assert.equal(aliceNotes.data[0].date, note.date);
  assert.equal(aliceNotes.data[0].comment, note.comment);
  assert.deepEqual((await request("/userDate/get", { token: bob })).data, []);
  assert.equal(
    (
      await request("/userDate/delete", {
        method: "DELETE",
        token: bob,
        body: { date: note.date },
      })
    ).status,
    404,
  );

  assert.equal(
    (
      await request("/userDate/update", {
        method: "PATCH",
        token: bob,
        body: { ...note, comment: "Wrong owner" },
      })
    ).status,
    404,
  );
  const edited = "Updated text\nWith another line";
  assert.equal(
    (
      await request("/userDate/update", {
        method: "PATCH",
        token: alice,
        body: { ...note, comment: edited },
      })
    ).status,
    200,
  );
  // Saving the same value is still a successful update.
  assert.equal(
    (
      await request("/userDate/update", {
        method: "PATCH",
        token: alice,
        body: { ...note, comment: edited },
      })
    ).status,
    200,
  );
  const updated = (await request("/userDate/get", { token: alice })).data;
  assert.equal(updated[0].id, aliceNotes.data[0].id);
  assert.equal(updated[0].comment, edited);
  // A separate connection reads the same disk file, proving writes were persisted.
  const reader = new Sequelize({ dialect: "sqlite", storage, logging: false });
  try {
    const persisted = await reader.query('SELECT date, comment FROM "userDates"', {
      type: QueryTypes.SELECT,
    });
    assert.deepEqual(persisted, [{ date: note.date, comment: edited }]);
  } finally {
    await reader.close();
  }

  assert.equal(
    (
      await request("/userDate/delete", {
        method: "DELETE",
        token: alice,
        body: { date: note.date },
      })
    ).status,
    200,
  );
  assert.deepEqual((await request("/userDate/get", { token: alice })).data, []);
  assert.equal(
    (
      await request("/userDate/create", {
        method: "POST",
        token: bob,
        body: note,
      })
    ).status,
    200,
  );
});

test("same-day notes retain individual IDs, times and ownership through edits and deletion", async () => {
  const owner = (
    await request("/user/registration", {
      method: "POST",
      body: { email: "schedule@example.com", password: "test-password" },
    })
  ).data.token;
  const other = (
    await request("/user/login", {
      method: "POST",
      body: { email: "bob@example.com", password: "other-password" },
    })
  ).data.token;
  const date = "2026-11-02";
  const ids = [];
  for (const time of [null, "09:30", "14:00", "09:30"]) {
    const result = await request("/userDate/create", {
      method: "POST",
      token: owner,
      body: { date, time, comment: "Note " + ids.length },
    });
    assert.equal(result.status, 200);
    ids.push(result.data.note.id);
  }
  assert.equal(new Set(ids).size, 4);
  let notes = (await request("/userDate/get", { token: owner })).data;
  assert.deepEqual(
    notes.map((note) => note.time),
    [null, "09:30", "14:00", "09:30"],
  );
  for (const method of ["PATCH", "DELETE"]) {
    const path = method === "PATCH" ? "/update" : "/delete";
    assert.equal(
      (
        await request("/userDate" + path, {
          method,
          token: owner,
          body: { date, comment: "Ambiguous" },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request("/userDate" + path, {
          method,
          token: other,
          body: { id: ids[1], date, comment: "Wrong owner" },
        })
      ).status,
      404,
    );
  }
  const changed = { id: ids[1], date: "2026-11-03", time: "00:00", comment: "Moved note" };
  assert.equal(
    (await request("/userDate/update", { method: "PATCH", token: owner, body: changed })).status,
    200,
  );
  assert.equal(
    (await request("/userDate/delete", { method: "DELETE", token: owner, body: { id: ids[2] } }))
      .status,
    200,
  );
  notes = (await request("/userDate/get", { token: owner })).data;
  assert.equal(notes.length, 3);
  assert.equal(notes.find((note) => note.id === ids[0]).comment, "Note 0");
  assert.equal(notes.find((note) => note.id === ids[3]).time, "09:30");
  assert.deepEqual(
    {
      id: notes.find((note) => note.id === ids[1]).id,
      date: notes.find((note) => note.id === ids[1]).date,
      time: notes.find((note) => note.id === ids[1]).time,
      comment: notes.find((note) => note.id === ids[1]).comment,
    },
    changed,
  );
  assert.equal(
    (
      await request("/userDate/update", {
        method: "PATCH",
        token: owner,
        body: { ...changed, time: null },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/userDate/get", { token: owner })).data.find((note) => note.id === ids[1]).time,
    null,
  );
});
