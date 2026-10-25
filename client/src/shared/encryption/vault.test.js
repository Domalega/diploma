import { webcrypto } from "crypto";
import { TextEncoder, TextDecoder } from "util";
import {
  inspectVault,
  unlockVault,
  encryptedRequest,
  syncVault,
  vaultStatus,
  resolveVault,
} from "./vault";
import { encryptionSession, lockEncryption, setEncryptionSession } from "./session";
import { clearToken } from "../api/tokenStorage";
import { open, seal } from "./crypto";
import { offlineNative, isOfflineApp } from "../offline/bridge";
jest.mock("../offline/bridge", () => ({
  isOfflineApp: jest.fn(() => false),
  offlineNative: jest.fn(),
}));
const phrase = "separate secret encryption phrase";
const token = `header.${btoa(JSON.stringify({ id: 7 }))}.signature`;
const storageKey = "daymark.encrypted.v1:http://localhost:5000/api:7";
const remoteContext = "daymark:v1:http://localhost:5000/api:7:remote";
const initial = () => ({
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
let server, online, bodies;
beforeAll(() => {
  Object.defineProperty(navigator, "locks", {
    value: { request: (_name, action) => Promise.resolve().then(action) },
    configurable: true,
  });
  Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
});
beforeEach(() => {
  isOfflineApp.mockReturnValue(false);
  offlineNative.mockReset();
  localStorage.clear();
  lockEncryption();
  localStorage.setItem("token", token);
  online = true;
  server = null;
  bodies = [];
  global.fetch = jest.fn(async (url, options) => {
    if (!online) throw new TypeError("Offline");
    if (options.method === "PUT") {
      const body = JSON.parse(options.body);
      bodies.push(body);
      if (body.revision !== (server?.revision || 0))
        return { ok: false, status: 409, json: async () => ({ message: "Concurrent change" }) };
      server = {
        encrypted: true,
        revision: body.revision + 1,
        envelope: body.envelope,
        legacyRetained: false,
      };
      return { ok: true, json: async () => ({ revision: server.revision, legacyRetained: false }) };
    }
    return {
      ok: true,
      json: async () =>
        server || { encrypted: false, legacy: initial(), digest: "migration-check" },
    };
  });
});
afterEach(() => {
  lockEncryption();
  delete global.fetch;
});
const unlock = async () => unlockVault(phrase, await inspectVault());
const write = (path, body, method = "POST") => encryptedRequest(path, { token, method, body });
const read = (path) => encryptedRequest(path, { token });
function switchDevice(s) {
  localStorage.setItem(storageKey, s.stored);
  setEncryptionSession(s);
}
async function anotherDevice() {
  lockEncryption();
  localStorage.removeItem(storageKey);
  return unlock();
}

test("setup verifies encryption, disables plaintext caching and sends only envelopes", async () => {
  localStorage.setItem("daymark.web-data.v1", "legacy plaintext cache");
  await unlock();
  const result = await write("/userDate/create", {
    date: "2026-10-25",
    time: null,
    comment: "Private calendar text",
  });
  expect(result.note.comment).toBe("Private calendar text");
  expect((await read("/userDate/get"))[0].comment).toBe("Private calendar text");
  expect(localStorage.getItem("daymark.web-data.v1")).toBeNull();
  expect(JSON.stringify(bodies)).not.toContain("Private calendar text");
  expect(JSON.stringify(bodies)).not.toContain(phrase);
  expect(JSON.stringify(localStorage)).not.toContain("Private calendar text");
  expect(encryptionSession().key.extractable).toBe(false);
  expect(vaultStatus().pending).toBe(false);
});
test("offline edits survive lock, page reload and logout as ciphertext and later sync", async () => {
  await unlock();
  online = false;
  await write("/userDate/create", { date: "2026-10-25", comment: "Pending offline note" });
  expect(vaultStatus().pending).toBe(true);
  clearToken();
  expect(encryptionSession()).toBeNull();
  expect(localStorage.getItem(storageKey)).not.toContain("Pending offline note");
  localStorage.setItem("token", token);
  await unlock();
  expect((await read("/userDate/get"))[0].comment).toBe("Pending offline note");
  online = true;
  await syncVault();
  expect(vaultStatus().pending).toBe(false);
});
test("same-item conflicts retain both versions and explicitly resolve to the local version", async () => {
  await unlock();
  const { note } = await write("/userDate/create", { date: "2026-10-25", comment: "Initial" });
  const a = encryptionSession(),
    b = await anotherDevice();
  switchDevice(a);
  online = false;
  await write("/userDate/update", { id: note.id, comment: "Device A" }, "PATCH");
  switchDevice(b);
  online = true;
  await write("/userDate/update", { id: note.id, comment: "Device B" }, "PATCH");
  switchDevice(a);
  await expect(syncVault()).rejects.toThrow(/both devices/);
  expect(vaultStatus().conflicts).toContain("note/" + note.id);
  await resolveVault("local");
  expect(vaultStatus().conflicts).toEqual([]);
  expect((await open(a.key, server.envelope, remoteContext)).state["note/" + note.id].comment).toBe(
    "Device A",
  );
});
test("independent offline edits merge across devices without losing either note", async () => {
  const a = await unlock(),
    b = await anotherDevice();
  switchDevice(a);
  online = false;
  await write("/userDate/create", { date: "2026-10-25", comment: "From A" });
  switchDevice(b);
  online = true;
  await write("/userDate/create", { date: "2026-10-26", comment: "From B" });
  switchDevice(a);
  await syncVault();
  expect((await read("/userDate/get")).map((n) => n.comment).sort()).toEqual(["From A", "From B"]);
});
test("local storage failures and writes from other tabs cannot falsely report a successful save", async () => {
  await unlock();
  const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Quota exceeded");
  });
  await expect(
    write("/userDate/create", { date: "2026-10-25", comment: "Unsaved" }),
  ).rejects.toThrow(/Quota/);
  spy.mockRestore();
  expect(await read("/userDate/get")).toEqual([]);
  localStorage.setItem(storageKey, "another tab's document");
  await expect(
    write("/userDate/create", { date: "2026-10-25", comment: "Unsaved" }),
  ).rejects.toThrow(/another tab/);
  expect(await read("/userDate/get")).toEqual([]);
});
test("tampered ciphertext, wrong phrases and revoked sessions never fall back to plaintext", async () => {
  await unlock();
  lockEncryption();
  await expect(unlockVault("incorrect phrase", await inspectVault())).rejects.toThrow(/Incorrect/);
  expect(encryptionSession()).toBeNull();
  global.fetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: "Unauthorized" }),
  });
  await expect(inspectVault()).rejects.toMatchObject({ status: 401 });
  expect(offlineNative).not.toHaveBeenCalled();
});
test("Kanban history is encrypted, retains activity and paginates with opaque cursors", async () => {
  await unlock();
  await write("/kanban", { type: "enabled", enabled: true });
  const board = await write("/kanban", {
    type: "task.create",
    title: "Secret task",
    columnId: "todo",
  });
  const id = board.tasks[0].id;
  await write("/kanban", { type: "task.complete", taskId: id });
  const page = await read(`/kanban/tasks/${id}/history?limit=1`);
  expect(page.events[0].kind).toBe("completed");
  expect(page.nextCursor).toBeTruthy();
  const second = await read(`/kanban/tasks/${id}/history?limit=1&before=${page.nextCursor}`);
  expect(second.events[0].kind).toBe("created");
  expect(JSON.stringify(bodies)).not.toContain("Secret task");
});
test("a stale server snapshot is rejected without losing local work", async () => {
  const s = await unlock(),
    old = JSON.parse(JSON.stringify(server));
  await write("/userDate/create", { date: "2026-10-25", comment: "Retain this" });
  server = old;
  await expect(syncVault()).rejects.toThrow(/older/);
  expect((await read("/userDate/get"))[0].comment).toBe("Retain this");
  expect(s.doc.revision).toBe(2);
});
test("invalid client data never reaches local storage or the server", async () => {
  await unlock();
  const before = localStorage.getItem(storageKey),
    count = bodies.length;
  await expect(
    write("/userDate/create", { date: "2026-02-30", comment: "Invalid" }),
  ).rejects.toThrow(/Invalid/);
  expect(localStorage.getItem(storageKey)).toBe(before);
  expect(bodies).toHaveLength(count);
});
test("server envelopes are authenticated even if copied from the same account's local storage", async () => {
  const s = await unlock();
  const forged = await seal(
    s.key,
    s.salt,
    s.doc.current,
    "daymark:v1:http://localhost:5000/api:7:local",
  );
  server = { ...server, revision: server.revision + 1, envelope: forged };
  await expect(syncVault()).rejects.toThrow(/Incorrect/);
});
test("an unresolved conflict survives a later unrelated remote edit until the user chooses", async () => {
  await unlock();
  const { note } = await write("/userDate/create", { date: "2026-10-25", comment: "Initial" });
  const a = encryptionSession(),
    b = await anotherDevice();
  switchDevice(a);
  online = false;
  await write("/userDate/update", { id: note.id, comment: "A" }, "PATCH");
  switchDevice(b);
  online = true;
  await write("/userDate/update", { id: note.id, comment: "B" }, "PATCH");
  switchDevice(a);
  await expect(syncVault()).rejects.toThrow(/both devices/);
  switchDevice(b);
  await write("/userDate/create", { date: "2026-10-26", comment: "Unrelated" });
  switchDevice(a);
  await expect(syncVault()).rejects.toThrow(/both devices/);
  expect(vaultStatus().conflicts).toContain("note/" + note.id);
  await resolveVault("remote");
  expect((await read("/userDate/get")).map((n) => n.comment)).toEqual(["B", "Unrelated"]);
});
test("merging independent tasks cannot silently violate a column's WIP limit", async () => {
  await unlock();
  await write("/kanban", { type: "enabled", enabled: true });
  await write("/kanban", { type: "column.update", columnId: "doing", wipLimit: 1 });
  const a = encryptionSession(),
    b = await anotherDevice();
  switchDevice(a);
  online = false;
  await write("/kanban", { type: "task.create", columnId: "doing", title: "A" });
  switchDevice(b);
  online = true;
  await write("/kanban", { type: "task.create", columnId: "doing", title: "B" });
  switchDevice(a);
  await expect(syncVault()).rejects.toThrow(/both devices/);
  await resolveVault("local");
  expect((await read("/kanban")).tasks.map((t) => t.title)).toEqual(["A"]);
});
test("old pending Android edits are merged before the legacy exchange is disabled", async () => {
  await unlock();
  await write("/userDate/create", { date: "2026-10-25", comment: "Remote note" });
  const local = initial();
  local.state["note/" + webcrypto.randomUUID()] = {
    date: "2026-10-26",
    time: null,
    comment: "Pending old phone note",
  };
  isOfflineApp.mockReturnValue(true);
  offlineNative.mockImplementation(async (action, payload) => {
    if (action === "request") {
      const response = await global.fetch("http://localhost:5000/api/vault", {
        method: payload.method,
        body: payload.body ? JSON.stringify(payload.body) : undefined,
      });
      if (!response.ok) throw new Error("Network error");
      return response.json();
    }
    if (action === "legacyVault") return { base: initial().state, state: local.state, history: {} };
    if (action === "sealVault") return {};
    throw new Error("Unexpected native action");
  });
  await anotherDevice();
  expect((await read("/userDate/get")).map((n) => n.comment)).toEqual([
    "Remote note",
    "Pending old phone note",
  ]);
  expect(offlineNative).toHaveBeenCalledWith("sealVault", { token });
});
test("a missing server vault never overwrites an existing encrypted local account copy", async () => {
  await unlock();
  const stored = localStorage.getItem(storageKey);
  lockEncryption();
  server = null;
  await expect(unlock()).rejects.toThrow(/local copy is retained/);
  expect(localStorage.getItem(storageKey)).toBe(stored);
});
test("an uncertain first upload can be resumed with the same phrase and encrypted recovery copy", async () => {
  const original = global.fetch;
  let first = true;
  global.fetch = jest.fn(async (...args) => {
    const reply = await original(...args);
    if (args[1].method === "PUT" && first) {
      first = false;
      throw new TypeError("Reply lost after commit");
    }
    return reply;
  });
  await expect(unlock()).rejects.toThrow(/Reply lost/);
  expect(encryptionSession()).toBeNull();
  const copy = localStorage.getItem(storageKey);
  await expect(unlockVault("incorrect phrase", await inspectVault())).rejects.toThrow(/Incorrect/);
  expect(localStorage.getItem(storageKey)).toBe(copy);
  await unlock();
  expect(encryptionSession()).not.toBeNull();
  expect(vaultStatus().pending).toBe(false);
});
test("choosing a remotely edited task after local deletion also restores its complete encrypted history", async () => {
  await unlock();
  await write("/kanban", { type: "enabled", enabled: true });
  const board = await write("/kanban", { type: "task.create", columnId: "todo", title: "Initial" });
  const id = board.tasks[0].id,
    a = encryptionSession(),
    b = await anotherDevice();
  switchDevice(a);
  online = false;
  await write("/kanban", { type: "task.delete", taskId: id });
  switchDevice(b);
  online = true;
  await write("/kanban", { type: "task.update", taskId: id, title: "Remote edit" });
  switchDevice(a);
  await expect(syncVault()).rejects.toThrow(/both devices/);
  await resolveVault("remote");
  expect((await read("/kanban")).tasks[0].title).toBe("Remote edit");
  const history = await read(`/kanban/tasks/${id}/history?limit=50`);
  expect(history.events.map((e) => e.kind).sort()).toEqual(["created", "edited"]);
});
test("a new offline medication mark conflicts with a remotely removed intake slot", async () => {
  await unlock();
  const medicationId = webcrypto.randomUUID(),
    slotId = webcrypto.randomUUID();
  const plan = {
    enabled: true,
    reminders: true,
    rows: [
      {
        id: medicationId,
        name: "Medicine",
        detail: "Dose",
        slotIds: [slotId],
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        startDate: "2026-10-01",
        endDate: null,
      },
    ],
    slots: [{ id: slotId, time: "08:00", label: "Morning" }],
  };
  await write("/medications/plan", plan, "PUT");
  const a = encryptionSession(),
    b = await anotherDevice();
  switchDevice(a);
  online = false;
  await write(
    "/medications/intakes",
    { date: "2026-10-25", medicationId, slotId, taken: true },
    "PUT",
  );
  switchDevice(b);
  online = true;
  await write(
    "/medications/plan",
    { enabled: false, reminders: false, rows: [], slots: [] },
    "PUT",
  );
  switchDevice(a);
  await expect(syncVault()).rejects.toThrow(/both devices/);
  await resolveVault("remote");
  expect(await read("/medications/intakes?date=2026-10-25")).toEqual([]);
  expect((await read("/medications/plan")).slots).toEqual([]);
});
test("browsers without cross-tab storage locks cannot begin an unsafe encrypted migration", async () => {
  const locks = navigator.locks;
  Object.defineProperty(navigator, "locks", { value: undefined, configurable: true });
  try {
    await expect(unlock()).rejects.toThrow(/Update your browser/);
    expect(bodies).toEqual([]);
    expect(server).toBeNull();
    expect(localStorage.getItem(storageKey)).toBeNull();
  } finally {
    Object.defineProperty(navigator, "locks", { value: locks, configurable: true });
  }
});
