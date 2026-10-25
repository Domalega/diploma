const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomBytes } = require("node:crypto");
Object.assign(process.env, {
  DB_DIALECT: "sqlite",
  SQLITE_STORAGE: ":memory:",
  SECRET_KEY: "vault-test-only",
  PORT: "5000",
  MAIL_TRANSPORT: "outbox",
});
const app = require("../src/app");
const db = require("../src/config/database");
const { User, UserDate, EncryptedVault } = require("../src/models");
const { generateToken } = require("../src/services/tokenService");
const userWrite = require("../src/services/userWrite");
const { requestReset } = require("../src/services/passwordResetService");
let server, url, token, other, id;
const envelope = () => ({
  version: 1,
  kdf: "PBKDF2-SHA256-600000",
  salt: randomBytes(16).toString("base64"),
  iv: randomBytes(12).toString("base64"),
  ciphertext: randomBytes(48).toString("base64"),
});
before(async () => {
  await db.sync();
  const user = await User.create({ email: "vault@example.test", password: "test-only" });
  id = user.id;
  token = generateToken(user);
  other = generateToken(await User.create({ email: "other@example.test", password: "test-only" }));
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  url = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.close();
});
async function call(path, body, auth = token, method = body ? "PUT" : "GET") {
  const response = await fetch(url + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    data: await response.json(),
    cache: response.headers.get("cache-control"),
  };
}
test("vault migration is private, detects stale snapshots and retains all original records", async () => {
  assert.equal((await call("/vault", undefined, null)).status, 401);
  const first = (await call("/vault")).data;
  const note = await UserDate.create({
    userId: id,
    date: "2026-10-25",
    comment: "Legacy retained by request",
  });
  assert.equal(
    (await call("/vault", { revision: 0, digest: first.digest, envelope: envelope() })).status,
    409,
  );
  assert.equal(await EncryptedVault.count(), 0);
  const current = (await call("/vault")).data,
    encrypted = envelope();
  assert.equal(
    (await call("/vault", { revision: 0, digest: current.digest, envelope: encrypted })).status,
    200,
  );
  assert.equal((await UserDate.findByPk(note.id)).comment, "Legacy retained by request");
  const saved = await call("/vault");
  assert.equal(saved.cache, "no-store");
  assert.equal(saved.data.legacyRetained, true);
  assert.equal(saved.data.revision, 1);
  assert.deepEqual(saved.data.envelope, encrypted);
  assert.equal(JSON.stringify(saved.data).includes("Legacy retained"), false);
  assert.equal((await call("/vault", undefined, other)).data.encrypted, false);
});
test("encrypted accounts reject all legacy reads and writes, including a write past the HTTP guard", async () => {
  for (const path of [
    "/sync",
    "/userDate/get",
    "/todos",
    "/kanban",
    "/medications/plan",
    "/medications/intakes?date=2026-10-25",
  ])
    assert.equal((await call(path)).status, 409, path);
  assert.equal(
    (
      await call(
        "/userDate/create",
        { date: "2026-10-25", comment: "Must not persist" },
        token,
        "POST",
      )
    ).status,
    409,
  );
  await assert.rejects(
    userWrite(id, (transaction) =>
      UserDate.create({ userId: id, date: "2026-10-25", comment: "blocked" }, { transaction }),
    ),
    /Unlock/,
  );
  assert.equal(await UserDate.count({ where: { userId: id } }), 1);
  assert.equal((await call("/user/auth")).status, 200);
});
test("compare-and-swap prevents concurrent device overwrites and salt replacement", async () => {
  const current = (await call("/vault")).data;
  const a = { ...envelope(), salt: current.envelope.salt },
    b = { ...envelope(), salt: current.envelope.salt };
  const results = await Promise.all([
    call("/vault", { revision: current.revision, envelope: a }),
    call("/vault", { revision: current.revision, envelope: b }),
  ]);
  assert.deepEqual(results.map((v) => v.status).sort(), [200, 409]);
  const saved = (await call("/vault")).data;
  assert.equal(saved.revision, current.revision + 1);
  assert.equal(
    (await call("/vault", { revision: saved.revision, envelope: envelope() })).status,
    400,
  );
});
test("malformed envelopes, plaintext fields and oversized bodies never change the vault", async () => {
  const saved = (await call("/vault")).data;
  for (const patch of [
    { version: 2 },
    { kdf: "weak" },
    { salt: "AA==" },
    { iv: "AA==" },
    { ciphertext: "plaintext" },
    { password: "should never be stored" },
  ]) {
    const result = await call("/vault", {
      revision: saved.revision,
      envelope: { ...saved.envelope, ...patch },
    });
    assert.equal(result.status, 400);
  }
  assert.deepEqual((await call("/vault")).data, saved);
  const large = { ...saved.envelope, ciphertext: "AAAA".repeat(1600000) };
  assert.equal((await call("/vault", { revision: saved.revision, envelope: large })).status, 413);
  assert.deepEqual((await call("/vault")).data, saved);
});
test("account password recovery remains available without modifying encrypted content", async () => {
  const saved = (await call("/vault")).data;
  // A disabled mail transport may reject delivery, but the encrypted-account lock must allow reset state.
  await requestReset("vault@example.test").catch((error) =>
    assert.doesNotMatch(error.message, /Unlock/),
  );
  assert.deepEqual((await call("/vault")).data, saved);
});
