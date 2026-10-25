const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomBytes, randomUUID } = require("node:crypto");
Object.assign(process.env, {
  DB_DIALECT: "sqlite",
  SQLITE_STORAGE: ":memory:",
  SECRET_KEY: "vault-test-only",
  PORT: "5000",
  MAIL_TRANSPORT: "outbox",
});
const app = require("../src/app");
const db = require("../src/config/database");
const { User, UserDate, EncryptedVault, VaultDeactivation, KanbanEvent } = require("../src/models");
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

let disableCommand;
test("disabling restores current content and historical intakes atomically while retaining both backups", async () => {
  const saved = (await call("/vault")).data;
  const legacy = await userWrite(
    id,
    (tx) => require("../src/services/syncService").snapshot(id, tx),
    { encrypted: true },
  );
  const document = { state: structuredClone(legacy.state), history: {} };
  const noteKey = Object.keys(document.state).find((k) => k.startsWith("note/"));
  document.state[noteKey].comment = "Latest decrypted note";
  const taskId = randomUUID();
  document.state["task/" + taskId] = {
    title: "Encrypted-era task",
    description: "",
    columnId: "todo",
    position: 0,
    date: null,
    startedAt: null,
    completedAt: null,
  };
  document.history[taskId] = [
    {
      id: randomUUID(),
      kind: "created",
      details: { title: "Encrypted-era task" },
      createdAt: "2026-10-25T12:00:00.000Z",
    },
  ];
  const medicationId = randomUUID(),
    slotId = randomUUID();
  document.state[`intake/2026-10-25/${medicationId}/${slotId}`] = {
    date: "2026-10-25",
    medicationId,
    slotId,
    takenAt: "2026-10-25T12:00:00.000Z",
    nameSnapshot: "Historical medicine",
    detailSnapshot: "",
    timeSnapshot: "12:00",
    slotLabelSnapshot: "",
  };
  disableCommand = {
    operationId: randomUUID(),
    revision: saved.revision,
    salt: saved.envelope.salt,
    document,
  };
  assert.equal(
    (
      await call(
        "/vault/disable",
        { ...disableCommand, revision: saved.revision - 1 },
        token,
        "POST",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "/vault/disable",
        {
          ...disableCommand,
          document: { state: document.state, history: { [taskId]: [{ kind: "invalid" }] } },
        },
        token,
        "POST",
      )
    ).status,
    400,
  );
  assert.equal(await VaultDeactivation.count(), 0);
  assert.deepEqual((await call("/vault")).data, saved);
  assert.equal((await call("/vault/disable", disableCommand, token, "POST")).status, 200);
  const restored = await call("/sync");
  assert.equal(restored.status, 200);
  assert.deepEqual(restored.data.state, document.state);
  assert.equal(restored.data.history[taskId][0].kind, "created");
  assert.equal(await KanbanEvent.count({ where: { userId: id, taskId } }), 1);
  const backup = await VaultDeactivation.findByPk(disableCommand.operationId);
  assert.deepEqual(backup.envelope, saved.envelope);
  assert.deepEqual(backup.legacy, legacy);
  assert.deepEqual((await EncryptedVault.findByPk(id)).envelope, saved.envelope);
  assert.equal((await call("/vault")).data.encrypted, false);
});
test("disable receipts reject substitution and another account and safely retry after ordinary edits", async () => {
  assert.equal((await call("/vault/disable", disableCommand, null, "POST")).status, 401);
  assert.equal((await call("/vault/disable", disableCommand, other, "POST")).status, 409);
  assert.equal((await call("/vault/disable", disableCommand, token, "POST")).status, 200);
  assert.equal(
    (await call("/vault/disable", { ...disableCommand, document: {} }, token, "POST")).status,
    409,
  );
  assert.equal(await VaultDeactivation.count(), 1);
});
test("encryption can be enabled again without reusing a prior revision or deleting its backup", async () => {
  const ordinary = (await call("/vault")).data;
  assert.equal(
    (await call("/vault", { revision: disableCommand.revision, envelope: envelope() })).status,
    409,
  );
  assert.equal(
    (await call("/vault", { revision: 0, digest: ordinary.digest, envelope: envelope() })).status,
    200,
  );
  assert.ok((await call("/vault")).data.revision > disableCommand.revision);
  assert.equal((await call("/sync")).status, 409);
  assert.equal((await call("/vault/disable", disableCommand, token, "POST")).status, 409);
  assert.equal(await VaultDeactivation.count(), 1);
});
