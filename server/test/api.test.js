const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

// Test the HTTP contract with model doubles; never connect to the user's database.
Object.assign(process.env, {
  DB_DIALECT: "postgres",
  DB_NAME: "diploma_test",
  DB_USER: "test",
  DB_PASSWORD: "test",
  DB_HOST: "localhost",
  DB_PORT: "5432",
  PORT: "5000",
  SECRET_KEY: "test-only-secret-not-for-deployment",
});
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const sequelize = require("../src/config/database");
const { User, UserDate, AccountSecurity } = require("../src/models");
const { generateToken } = require("../src/services/tokenService");

beforeEach((t) => {
  t.mock.method(AccountSecurity, "findByPk", async () => null);
  t.mock.method(User, "findByPk", async () => User.findOne());
});
let server;
let baseUrl;
const token = generateToken({ id: 7, email: "user@example.com" });

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});

async function request(path, { method = "GET", body, authorization } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

test("registration returns a token object and stores a password hash", async (t) => {
  t.mock.method(User, "findOne", async () => null);
  const create = t.mock.method(User, "create", async (values) => ({ id: 7, ...values }));
  const result = await request("/user/registration", {
    method: "POST",
    body: { email: "user@example.com", password: "secure-password" },
  });
  assert.equal(result.status, 200);
  assert.equal(jwt.verify(result.data.token, process.env.SECRET_KEY).id, 7);
  const stored = create.mock.calls[0].arguments[0];
  assert.notEqual(stored.password, "secure-password");
  assert.equal(await bcrypt.compare("secure-password", stored.password), true);
});

test("registration rejects duplicates with 409", async (t) => {
  t.mock.method(User, "findOne", async () => ({ id: 7 }));
  const result = await request("/user/registration", {
    method: "POST",
    body: { email: "user@example.com", password: "secure-password" },
  });
  assert.equal(result.status, 409);
});

test("invalid credentials are rejected before database access", async (t) => {
  const find = t.mock.method(User, "findOne", async () => {
    throw new Error("Unexpected DB access");
  });
  for (const body of [
    {},
    { email: "invalid", password: "secure-password" },
    { email: "user@example.com", password: "" },
    { email: "user@example.com", password: "я".repeat(37) },
  ]) {
    const result = await request("/user/registration", { method: "POST", body });
    assert.equal(result.status, 400);
  }
  assert.equal(find.mock.callCount(), 0);
});

test("login accepts existing bcrypt hashes and rejects wrong passwords", async (t) => {
  const password = await bcrypt.hash("legacy-password", 5);
  t.mock.method(User, "findOne", async () => ({ id: 7, email: "user@example.com", password }));
  const success = await request("/user/login", {
    method: "POST",
    body: { email: "user@example.com", password: "legacy-password" },
  });
  assert.equal(success.status, 200);
  assert.equal(jwt.verify(success.data.token, process.env.SECRET_KEY).id, 7);
  const failure = await request("/user/login", {
    method: "POST",
    body: { email: "user@example.com", password: "wrong" },
  });
  assert.equal(failure.status, 401);
});

test("protected routes reject missing, malformed and expired tokens", async () => {
  const expired = jwt.sign({ id: 7 }, process.env.SECRET_KEY, { expiresIn: -1 });
  for (const authorization of [
    undefined,
    "Basic credentials",
    "Bearer invalid",
    `Bearer ${expired}`,
  ]) {
    assert.equal((await request("/userDate/get", { authorization })).status, 401);
  }
  const badPayload = jwt.sign({ email: "user@example.com" }, process.env.SECRET_KEY);
  assert.equal(
    (await request("/userDate/get", { authorization: `Bearer ${badPayload}` })).status,
    401,
  );
});

test("auth check returns a valid token for the authenticated user", async () => {
  const result = await request("/user/auth", { authorization: `Bearer ${token}` });
  assert.equal(result.status, 200);
  assert.equal(jwt.verify(result.data.token, process.env.SECRET_KEY).id, 7);
});

test("reading and deleting notes use the token's user id, not supplied ids", async (t) => {
  const find = t.mock.method(UserDate, "findAll", async () => []);
  const destroy = t.mock.method(UserDate, "destroy", async () => 1);
  const authorization = `Bearer ${token}`;
  assert.equal((await request("/userDate/get?userId=99", { authorization })).status, 200);
  assert.deepEqual(find.mock.calls[0].arguments[0].where, { userId: 7 });
  assert.equal(
    (
      await request("/userDate/delete", {
        method: "DELETE",
        authorization,
        body: { date: "2026-10-14", userId: 99 },
      })
    ).status,
    200,
  );
  assert.deepEqual(destroy.mock.calls[0].arguments[0].where, { userId: 7, date: "2026-10-14" });
});

test("creating notes validates dates and comments, and assigns the authenticated owner", async (t) => {
  t.mock.method(UserDate, "findOne", async () => null);
  const create = t.mock.method(UserDate, "create", async () => ({}));
  const authorization = `Bearer ${token}`;
  for (const body of [
    { date: "2026-02-30" },
    { date: "2026-10-14T12:00:00Z" },
    { date: "2026-10-14", comment: "x".repeat(256) },
    { date: "2026-10-14", comment: {} },
  ]) {
    assert.equal(
      (await request("/userDate/create", { method: "POST", authorization, body })).status,
      400,
    );
  }
  assert.equal(create.mock.callCount(), 0);
  const result = await request("/userDate/create", {
    method: "POST",
    authorization,
    body: { date: "2026-10-14", comment: "Meeting", userId: 99 },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(create.mock.calls[0].arguments[0], {
    date: "2026-10-14",
    comment: "Meeting",
    userId: 7,
  });
});

test("duplicate dates and missing notes have distinct HTTP statuses", async (t) => {
  t.mock.method(UserDate, "findOne", async () => ({ id: 1 }));
  t.mock.method(UserDate, "destroy", async () => 0);
  const authorization = `Bearer ${token}`;
  assert.equal(
    (
      await request("/userDate/create", {
        method: "POST",
        authorization,
        body: { date: "2026-10-14" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/userDate/delete", {
        method: "DELETE",
        authorization,
        body: { date: "2026-10-14" },
      })
    ).status,
    404,
  );
});

test("updating a note validates input and scopes the write to its authenticated owner", async (t) => {
  const update = t.mock.method(UserDate, "update", async () => [1]);
  const authorization = `Bearer ${token}`;
  assert.equal(
    (
      await request("/userDate/update", {
        method: "PATCH",
        body: { date: "2026-10-14", comment: "Updated" },
      })
    ).status,
    401,
  );
  for (const body of [
    { date: "2026-02-30", comment: "Updated" },
    { date: "2026-10-14" },
    { date: "2026-10-14", comment: null },
    { date: "2026-10-14", comment: {} },
    { date: "2026-10-14", comment: "x".repeat(256) },
  ]) {
    assert.equal(
      (await request("/userDate/update", { method: "PATCH", authorization, body })).status,
      400,
    );
  }
  assert.equal(update.mock.callCount(), 0);
  assert.equal(
    (
      await request("/userDate/update", {
        method: "PATCH",
        authorization,
        body: { date: "2026-10-14", comment: "Updated", userId: 99, id: 99 },
      })
    ).status,
    200,
  );
  assert.deepEqual(update.mock.calls[0].arguments, [
    { comment: "Updated" },
    { where: { userId: 7, date: "2026-10-14" } },
  ]);
  t.mock.method(UserDate, "update", async () => [0]);
  assert.equal(
    (
      await request("/userDate/update", {
        method: "PATCH",
        authorization,
        body: { date: "2026-10-14", comment: "" },
      })
    ).status,
    404,
  );
});

test("unknown routes and malformed JSON return JSON errors", async () => {
  const health = await request("/health");
  assert.equal(health.status, 200);
  assert.deepEqual(health.data, { status: "ok" });
  assert.equal((await request("/missing")).status, 404);
  const result = await fetch(`${baseUrl}/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid",
  });
  assert.equal(result.status, 400);
  assert.equal((await result.json()).message, "Invalid JSON");
});
