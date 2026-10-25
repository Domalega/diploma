const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomBytes, randomUUID, generateKeyPairSync } = require("node:crypto");
Object.assign(process.env, {
  DB_DIALECT: "sqlite",
  SQLITE_STORAGE: ":memory:",
  SECRET_KEY: "device-test-only",
  PORT: "5000",
  MAIL_TRANSPORT: "outbox",
});
const app = require("../src/app"),
  db = require("../src/config/database");
const { User, VaultDevice, EncryptedVault } = require("../src/models");
const { generateToken } = require("../src/services/tokenService");
let server, url, alice, bob, owner;
const pub = () => {
  const k = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({
    format: "jwk",
  });
  return { kty: k.kty, crv: k.crv, x: k.x, y: k.y };
};
const packet = () => ({
  version: 1,
  publicKey: pub(),
  salt: randomBytes(16).toString("base64"),
  iv: randomBytes(12).toString("base64"),
  ciphertext: randomBytes(48).toString("base64"),
});
const envelope = () => ({
  version: 2,
  kdf: "DEVICE-KEY",
  salt: randomBytes(16).toString("base64"),
  iv: randomBytes(12).toString("base64"),
  ciphertext: randomBytes(48).toString("base64"),
});
const device = () => ({ id: randomUUID(), publicKey: pub(), label: "Browser" });
async function call(path, method = "GET", body, token = alice) {
  const r = await fetch(url + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
before(async () => {
  await db.sync();
  const a = await User.create({ email: "devices@example.test", password: "test-only" });
  owner = a.id;
  alice = generateToken(a);
  bob = generateToken(
    await User.create({ email: "other-device@example.test", password: "test-only" }),
  );
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  url = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await db.close();
});
let first, second, stored;
test("registering a public device key does not enable encryption or expose another account's request", async () => {
  first = device();
  second = device();
  assert.equal((await call("/vault/devices", "POST", first, null)).status, 401);
  assert.equal((await call("/vault/devices", "POST", first)).status, 200);
  assert.equal((await call("/vault/devices", "POST", first)).data.wrappedKey, null);
  assert.equal((await call("/vault")).data.encrypted, false);
  assert.equal((await call("/vault/devices/" + first.id, "GET", undefined, bob)).status, 404);
  assert.equal((await call("/vault/devices", "POST", { ...first, publicKey: pub() })).status, 409);
  assert.equal(
    (
      await call("/vault/devices", "POST", {
        ...device(),
        publicKey: { ...pub(), d: "must-not-be-stored" },
      })
    ).status,
    400,
  );
});
test("first-device bootstrap atomically stores a wrapped key and opaque format-two document", async () => {
  const snapshot = (await call("/vault")).data;
  const e = envelope();
  stored = packet();
  assert.equal(
    (await call("/vault", "PUT", { revision: 0, digest: snapshot.digest, envelope: e })).status,
    400,
  );
  assert.equal(await EncryptedVault.count(), 0);
  assert.equal((await call("/vault/devices/" + first.id)).data.wrappedKey, null);
  assert.equal(
    (
      await call("/vault", "PUT", {
        revision: 0,
        digest: snapshot.digest,
        envelope: e,
        device: { ...first, wrappedKey: stored },
      })
    ).status,
    200,
  );
  assert.deepEqual((await call("/vault/devices/" + first.id)).data.wrappedKey, stored);
  assert.deepEqual((await call("/vault")).data.envelope, e);
  assert.equal((await call("/sync")).status, 409);
});
test("another device remains pending until an immutable, matching public key is approved", async () => {
  await call("/vault/devices", "POST", second);
  assert.equal((await call("/vault/devices/" + second.id)).data.wrappedKey, null);
  const wrappedKey = packet();
  assert.equal(
    (await call("/vault/devices/" + second.id, "PUT", { publicKey: pub(), wrappedKey })).status,
    409,
  );
  assert.equal(
    (
      await call(
        "/vault/devices/" + second.id,
        "PUT",
        { publicKey: second.publicKey, wrappedKey },
        bob,
      )
    ).status,
    409,
  );
  assert.equal(
    (await call("/vault/devices/" + second.id, "PUT", { publicKey: second.publicKey, wrappedKey }))
      .status,
    200,
  );
  assert.equal(
    (await call("/vault/devices/" + second.id, "PUT", { publicKey: second.publicKey, wrappedKey }))
      .status,
    200,
  );
  assert.equal(
    (
      await call("/vault/devices/" + second.id, "PUT", {
        publicKey: second.publicKey,
        wrappedKey: packet(),
      })
    ).status,
    409,
  );
  assert.equal((await call("/vault/devices", "POST", { ...second })).status, 200);
});
test("expired requests and malformed key packets cannot be approved or change encrypted data", async () => {
  const pending = device();
  await call("/vault/devices", "POST", pending);
  const before = (await call("/vault")).data;
  assert.equal(
    (
      await call("/vault/devices/" + pending.id, "PUT", {
        publicKey: pending.publicKey,
        wrappedKey: { ...packet(), ciphertext: "bad" },
      })
    ).status,
    400,
  );
  await VaultDevice.update(
    { expiresAt: new Date(Date.now() - 1000) },
    { where: { id: pending.id, userId: owner } },
  );
  assert.equal(
    (
      await call("/vault/devices/" + pending.id, "PUT", {
        publicKey: pending.publicKey,
        wrappedKey: packet(),
      })
    ).status,
    409,
  );
  assert.deepEqual((await call("/vault")).data, before);
  const changed = { ...before.envelope, version: 1, kdf: "PBKDF2-SHA256-600000" };
  assert.equal(
    (await call("/vault", "PUT", { revision: before.revision, envelope: changed })).status,
    400,
  );
});
