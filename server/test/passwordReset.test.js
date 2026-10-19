const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createHash } = require("node:crypto");
const jwt = require("jsonwebtoken");

Object.assign(process.env, {
  DB_DIALECT: "sqlite",
  SQLITE_STORAGE: ":memory:",
  SECRET_KEY: "reset-tests-only",
  MAIL_TRANSPORT: "outbox",
  NODE_ENV: "test",
});
const app = require("../src/app");
const db = require("../src/config/database");
const { User, AccountSecurity } = require("../src/models");
const resetService = require("../src/services/passwordResetService");
const mail = require("../src/services/mailService");
let server, base;
before(async () => {
  await db.sync();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});
async function request(route, body, token) {
  const response = await fetch(base + route, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}

test("recovery stores only a hash, expires, can be used once, and revokes previous sessions", async (t) => {
  const deliveries = [];
  const notifications = [];
  t.mock.method(mail, "sendReset", async (email, token) => deliveries.push({ email, token }));
  t.mock.method(mail, "sendResetConfirmation", async (email) => notifications.push(email));
  const credentials = { email: "reset-test@example.com", password: "original-password" };
  const registered = await request("/user/registration", credentials);
  assert.equal(registered.status, 200);
  const user = await User.findOne({ where: { email: credentials.email } });
  const originalHash = user.password;
  await resetService.requestReset(credentials.email);
  const token = deliveries[0].token;
  const state = await AccountSecurity.findByPk(user.id);
  assert.equal(state.resetTokenHash, createHash("sha256").update(token).digest("hex"));
  assert.notEqual(state.resetTokenHash, token);
  assert.ok(state.resetExpiresAt > new Date());
  assert.equal((await user.reload()).password, originalHash);
  await resetService.requestReset(credentials.email);
  assert.equal(deliveries.length, 1, "requests within one minute cannot flood an inbox");
  assert.equal(
    (
      await request("/user/reset-password", {
        token: "f".repeat(64),
        password: "replacement-password",
      })
    ).status,
    400,
  );
  assert.equal((await request("/user/reset-password", { token, password: "short" })).status, 400);
  const reset = await request("/user/reset-password", { token, password: "replacement-password" });
  assert.equal(reset.status, 200);
  assert.equal(reset.data.token, undefined, "reset does not automatically sign in");
  assert.equal(
    (await request("/user/reset-password", { token, password: "another-password" })).status,
    400,
  );
  assert.equal((await request("/user/auth", null, registered.data.token)).status, 401);
  const legacy = jwt.sign({ id: user.id, email: user.email }, process.env.SECRET_KEY);
  assert.equal((await request("/user/auth", null, legacy)).status, 401);
  assert.equal((await request("/user/login", credentials)).status, 401);
  const signedIn = await request("/user/login", {
    ...credentials,
    password: "replacement-password",
  });
  assert.equal(signedIn.status, 200);
  assert.equal((await request("/user/auth", null, signedIn.data.token)).status, 200);
  assert.equal(notifications[0], user.email);
  await state.reload();
  await state.update({ resetRequestedAt: new Date(0) });
  await resetService.requestReset(credentials.email);
  await state.reload();
  await state.update({ resetExpiresAt: new Date(0) });
  assert.equal(
    (
      await request("/user/reset-password", {
        token: deliveries[1].token,
        password: "third-password",
      })
    ).status,
    400,
  );
});

test("HTTP recovery responses do not disclose accounts and reject excessive requests", async (t) => {
  t.mock.method(resetService, "requestReset", async () => {});
  const known = await request("/user/forgot-password", { email: "reset-test@example.com" });
  const unknown = await request("/user/forgot-password", { email: "unknown@example.com" });
  assert.equal(known.status, 202);
  assert.deepEqual(unknown, known);
  assert.equal(known.data.token, undefined);
  for (let i = 0; i < 8; i++)
    assert.equal(
      (await request("/user/forgot-password", { email: "unknown@example.com" })).status,
      202,
    );
  assert.equal(
    (await request("/user/forgot-password", { email: "unknown@example.com" })).status,
    429,
  );
});

test("recovery reports unavailable without a configured mail transport", async (t) => {
  t.mock.method(mail, "isConfigured", () => false);
  assert.deepEqual((await request("/user/password-recovery")).data, { available: false });
});

test("concurrent recovery and calendar writes commit without overlapping SQLite transactions", async (t) => {
  const deliveries = [];
  t.mock.method(mail, "sendReset", async (email, token) => deliveries.push({ email, token }));
  const user = await User.create({ email: "concurrent-reset@example.com", password: "test-only" });
  const notes = require("../src/services/userDateService");
  await Promise.all([
    resetService.requestReset(user.email),
    resetService.requestReset(user.email),
    notes.create(user.id, "2026-10-19", "Preserved during recovery"),
  ]);
  assert.equal(deliveries.length, 1, "concurrent requests respect the delivery cooldown");
  assert.equal((await notes.getAll(user.id)).length, 1);
  assert.ok((await AccountSecurity.findByPk(user.id)).resetTokenHash);
});
