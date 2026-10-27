/** @jest-environment node */
import { webcrypto } from "crypto";
import { IDBFactory } from "fake-indexeddb";
import {
  initializeDeviceAccess,
  restoreDeviceAccess,
  enableDeviceEncryption,
  approveDeviceConnection,
  parseConnection,
  rememberLegacyDevice,
} from "./deviceFlow";
import { readDevice } from "./deviceStore";
import {
  inspectVault,
  unlockVault,
  encryptedRequest,
  deviceScope,
  deviceContext,
  disableVault,
  syncVault,
} from "./vault";
import { lockEncryption, encryptionSession, setEncryptionSession } from "./session";
import { unwrapContentKey } from "./crypto";
const token = `header.${btoa(JSON.stringify({ id: 7 }))}.signature`;
const fresh = () => ({
  version: 1,
  state: {
    todos: { enabled: false },
    board: {
      enabled: false,
      columns: [
        { id: "todo", name: "", kind: "todo", hidden: false, wipLimit: null },
        { id: "doing", name: "", kind: "doing", hidden: false, wipLimit: 3 },
        { id: "done", name: "", kind: "done", hidden: false, wipLimit: null },
      ],
    },
    medications: { enabled: false, reminders: false, rows: [], slots: [] },
  },
  history: {},
});
function storage() {
  const values = new Map([["token", token]]);
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, String(v)),
    removeItem: (k) => values.delete(k),
    values,
  };
}
let remote, devices, bodies, online;
beforeAll(() => {
  global.window = Object.assign(new EventTarget(), {
    crypto: webcrypto,
    location: { href: "http://localhost/calendar" },
  });
  const locks = new Map();
  Object.defineProperty(global, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: (name, fn) => {
          const p = (locks.get(name) || Promise.resolve()).then(fn);
          locks.set(
            name,
            p.catch(() => {}),
          );
          return p;
        },
      },
    },
  });
});
beforeEach(() => {
  global.indexedDB = new IDBFactory();
  global.localStorage = storage();
  lockEncryption();
  remote = null;
  devices = new Map();
  bodies = [];
  online = true;
  global.fetch = jest.fn(async (url, options) => {
    if (!online) throw new TypeError("Offline");
    const body = options.body ? JSON.parse(options.body) : undefined;
    if (body) bodies.push(body);
    const path = new URL(url).pathname;
    const ok = (data) => ({ ok: true, json: async () => data });
    const error = (status, message) => ({ ok: false, status, json: async () => ({ message }) });
    if (path === "/api/vault/disable") {
      remote = {
        encrypted: false,
        legacy: body.document,
        digest: "restored",
        disabled: { salt: body.salt, revision: body.revision, id: body.operationId },
      };
      return ok({ encrypted: false });
    }
    if (path === "/api/sync" && !remote.encrypted) {
      remote.legacy = { state: body.local, history: remote.legacy.history };
      return ok({ ...remote.legacy, conflicts: [] });
    }
    if (path === "/api/vault/devices" && options.method === "POST") {
      if (!devices.has(body.id)) devices.set(body.id, { ...body, wrappedKey: null });
      return ok(devices.get(body.id));
    }
    if (path.startsWith("/api/vault/devices/")) {
      const row = devices.get(path.split("/").at(-1));
      if (!row) return error(404, "Not found");
      if (options.method === "PUT") row.wrappedKey = body.wrappedKey;
      return ok(row);
    }
    if (options.method === "PUT") {
      if (body.revision !== (remote?.revision || 0)) return error(409, "Concurrent change");
      remote = {
        encrypted: true,
        revision: body.revision + 1,
        envelope: body.envelope,
        legacyRetained: false,
      };
      if (body.device) devices.get(body.device.id).wrappedKey = body.device.wrappedKey;
      return ok({ revision: remote.revision, legacyRetained: false });
    }
    return ok(remote || { encrypted: false, legacy: fresh(), digest: "migration-check" });
  });
});
afterEach(() => {
  lockEncryption();
  delete global.fetch;
});
const snapshotDevice = () => ({
  db: global.indexedDB,
  storage: global.localStorage,
  session: encryptionSession(),
});
function switchTo(value) {
  global.indexedDB = value.db;
  global.localStorage = value.storage;
  setEncryptionSession(value.session);
}
const newDevice = () => {
  global.indexedDB = new IDBFactory();
  global.localStorage = storage();
  lockEncryption();
};
const note = () =>
  encryptedRequest("/userDate/create", {
    method: "POST",
    token,
    body: { date: "2026-10-25", comment: "Private automatic-key note" },
  });
test("encryption is off by default and creates no key or device request until explicitly enabled", async () => {
  expect((await initializeDeviceAccess()).mode).toBe("plain");
  expect(await readDevice(deviceScope())).toBeNull();
  expect(devices.size).toBe(0);
  expect(bodies).toEqual([]);
});
test("automatic keys survive reload and logout, are not exportable, and never reach the server in plaintext", async () => {
  await enableDeviceEncryption();
  await note();
  const device = await readDevice(deviceScope());
  expect(device.privateKey.extractable).toBe(false);
  expect(remote.envelope.version).toBe(2);
  expect(remote.envelope.kdf).toBe("DEVICE-KEY");
  expect(JSON.stringify(bodies)).not.toContain("privateKey");
  expect(JSON.stringify(bodies)).not.toContain("Private automatic-key note");
  expect(JSON.stringify([...localStorage.values])).not.toContain("Private automatic-key note");
  lockEncryption();
  localStorage.removeItem("token");
  localStorage.setItem("token", token);
  expect((await initializeDeviceAccess()).mode).toBe("ready");
  expect((await encryptedRequest("/userDate/get", { token }))[0].comment).toBe(
    "Private automatic-key note",
  );
  online = false;
  lockEncryption();
  expect((await initializeDeviceAccess()).mode).toBe("ready");
});
test("saved device keys and ciphertext open without any server request, even during a stalled sync", async () => {
  await enableDeviceEncryption();
  await note();
  lockEncryption();
  const original = global.fetch;
  let release, started;
  const requested = new Promise((resolve) => (started = resolve));
  global.fetch = jest.fn(
    () =>
      new Promise((resolve) => {
        release = resolve;
        started();
      }),
  );
  expect((await restoreDeviceAccess()).mode).toBe("ready");
  expect(global.fetch).not.toHaveBeenCalled();
  const syncing = syncVault();
  try {
    await requested;
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((await encryptedRequest("/userDate/get", { token }))[0].comment).toBe(
      "Private automatic-key note",
    );
  } finally {
    release(await original("http://localhost:5000/api/vault", { method: "GET" }));
    await syncing;
  }
});

test("local restoration cannot use another account's device key or ciphertext", async () => {
  await enableDeviceEncryption();
  await note();
  lockEncryption();
  localStorage.setItem("token", `header.${btoa(JSON.stringify({ id: 8 }))}.signature`);
  global.fetch.mockClear();
  expect(await restoreDeviceAccess()).toBeNull();
  expect(encryptionSession()).toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("an encrypted copy without its device key cannot be opened locally", async () => {
  await enableDeviceEncryption();
  lockEncryption();
  global.indexedDB = new IDBFactory();
  expect(await restoreDeviceAccess()).toBeNull();
  expect(encryptionSession()).toBeNull();
});

test("another device cannot decrypt until its pinned connection link is explicitly approved", async () => {
  await enableDeviceEncryption();
  await note();
  const first = await readDevice(deviceScope()),
    a = snapshotDevice();
  newDevice();
  const waiting = await initializeDeviceAccess(),
    second = await readDevice(deviceScope()),
    b = snapshotDevice();
  expect(waiting.mode).toBe("waiting");
  expect(encryptionSession()).toBeNull();
  await expect(
    unwrapContentKey(first.wrappedKey, second.privateKey, deviceContext(first, first.keyId)),
  ).rejects.toThrow();
  const url = new URL(waiting.link),
    request = parseConnection(url.search);
  switchTo(a);
  await approveDeviceConnection(request);
  switchTo(b);
  expect((await initializeDeviceAccess()).mode).toBe("ready");
  expect((await encryptedRequest("/userDate/get", { token }))[0].comment).toBe(
    "Private automatic-key note",
  );
});
test("a substituted public key in a connection link is rejected without granting access", async () => {
  await enableDeviceEncryption();
  const a = snapshotDevice();
  newDevice();
  const pending = await initializeDeviceAccess(),
    b = snapshotDevice();
  const request = parseConnection(new URL(pending.link).search);
  newDevice();
  await initializeDeviceAccess();
  const attacker = await readDevice(deviceScope());
  switchTo(a);
  await expect(
    approveDeviceConnection({ ...request, publicKey: attacker.publicKey }),
  ).rejects.toThrow(/does not match/);
  switchTo(b);
  expect((await initializeDeviceAccess()).mode).toBe("waiting");
});
test("an older phrase-protected account can remember its existing access once without rewriting its encrypted records", async () => {
  const phrase = "old separate encryption phrase";
  await unlockVault(phrase, await inspectVault());
  await note();
  const previous = JSON.parse(JSON.stringify(remote));
  lockEncryption();
  expect((await initializeDeviceAccess()).mode).toBe("legacy");
  await expect(rememberLegacyDevice("wrong old phrase", await inspectVault())).rejects.toThrow();
  await rememberLegacyDevice(phrase, await inspectVault());
  expect(remote).toEqual(previous);
  lockEncryption();
  expect((await initializeDeviceAccess()).mode).toBe("ready");
});
test("lost bootstrap replies recover using only the persistent device key", async () => {
  const original = global.fetch;
  let first = true;
  global.fetch = jest.fn(async (...args) => {
    const r = await original(...args);
    if (args[1].method === "PUT" && new URL(args[0]).pathname === "/api/vault" && first) {
      first = false;
      throw new TypeError("Reply lost");
    }
    return r;
  });
  await expect(enableDeviceEncryption()).rejects.toThrow(/Reply lost/);
  expect(remote.encrypted).toBe(true);
  expect((await initializeDeviceAccess()).mode).toBe("ready");
});

test("disabling uploads pending edits, keeps ciphertext backups and permits a fresh automatic key", async () => {
  await enableDeviceEncryption();
  const first = await readDevice(deviceScope());
  online = false;
  await note();
  online = true;
  await disableVault();
  expect(encryptionSession()).toBeNull();
  expect(remote.encrypted).toBe(false);
  expect(JSON.stringify(remote.legacy)).toContain("Private automatic-key note");
  expect((await initializeDeviceAccess()).mode).toBe("plain");
  const backups = [...localStorage.values].filter(([k]) => k.includes(":backup:"));
  expect(backups.length).toBe(1);
  expect(backups[0][1]).not.toContain("Private automatic-key note");
  await enableDeviceEncryption();
  const second = await readDevice(deviceScope());
  expect(second.id).not.toBe(first.id);
  expect(second.keyId).not.toBe(first.keyId);
  expect(remote.encrypted).toBe(true);
  expect((await encryptedRequest("/userDate/get", { token }))[0].comment).toBe(
    "Private automatic-key note",
  );
});
test("disabling requires a connection and recovers a committed change whose reply was lost", async () => {
  await enableDeviceEncryption();
  online = false;
  await expect(disableVault()).rejects.toThrow(/Offline/);
  expect(encryptionSession()).not.toBeNull();
  online = true;
  const original = global.fetch;
  global.fetch = jest.fn(async (...args) => {
    const result = await original(...args);
    if (new URL(args[0]).pathname === "/api/vault/disable")
      throw new TypeError("Lost disable reply");
    return result;
  });
  await disableVault();
  expect(encryptionSession()).toBeNull();
  expect(remote.encrypted).toBe(false);
});
test("an offline connected device merges pending edits after another device disables encryption", async () => {
  await enableDeviceEncryption();
  await note();
  const a = snapshotDevice();
  newDevice();
  const pending = await initializeDeviceAccess(),
    b = snapshotDevice();
  const request = parseConnection(new URL(pending.link).search);
  switchTo(a);
  await approveDeviceConnection(request);
  switchTo(b);
  await initializeDeviceAccess();
  online = false;
  await note();
  const offlineDevice = snapshotDevice();
  online = true;
  switchTo(a);
  await disableVault();
  switchTo(offlineDevice);
  await syncVault();
  expect(encryptionSession()).toBeNull();
  expect(Object.keys(remote.legacy.state).filter((k) => k.startsWith("note/")).length).toBe(2);
  expect((await initializeDeviceAccess()).mode).toBe("plain");
});
