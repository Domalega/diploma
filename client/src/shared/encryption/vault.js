import { deriveKey, newSalt, open, seal } from "./crypto";
import {
  encryptionSession,
  setEncryptionSession,
  lockEncryption,
  encryptionEpoch,
} from "./session";
import { tokenOwner, clearBrowserCache } from "../api/browserCache";
import { isOfflineApp, offlineNative } from "../offline/bridge";
import { localApi } from "../offline/localApi";
import { validateDocument, validateNewIntakes } from "./validate";

const SOURCE = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const clone = (v) => JSON.parse(JSON.stringify(v));
const canonical = (v) =>
  v === undefined
    ? "undefined"
    : v === null || typeof v !== "object"
      ? JSON.stringify(v)
      : Array.isArray(v)
        ? "[" + v.map(canonical).join(",") + "]"
        : "{" +
          Object.keys(v)
            .sort()
            .map((k) => JSON.stringify(k) + ":" + canonical(v[k]))
            .join(",") +
          "}";
const equal = (a, b) => canonical(a) === canonical(b);
const owner = () => tokenOwner(localStorage.getItem("token"));
const storageKey = (id) => `daymark.encrypted.v1:${SOURCE}:${id}`;
const context = (id, purpose) => `daymark:v1:${SOURCE}:${id}:${purpose}`;
const notify = () => window.dispatchEvent(new Event("daymark:vault"));
let tail = Promise.resolve();
function serial(action) {
  const result = tail.then(action);
  tail = result.catch(() => {});
  return result;
}
function guard(s) {
  if (!s || s !== encryptionSession() || s.owner !== owner())
    throw new Error("Unlock your encrypted data first.");
}
async function network(method = "GET", body) {
  const token = localStorage.getItem("token");
  if (isOfflineApp()) return offlineNative("request", { path: "/vault", method, body, token });
  const response = await fetch(SOURCE + "/vault", {
    method,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(data.message || "Synchronization failed. Try again."), {
      status: response.status,
    });
  return data;
}
export async function inspectVault() {
  try {
    return await network();
  } catch (error) {
    // Authentication/protocol errors must never become an offline success.
    if (error.status) throw error;
    const saved = JSON.parse(localStorage.getItem(storageKey(owner())) || "null");
    if (!saved) throw error;
    return { encrypted: true, offline: true, envelope: saved };
  }
}
async function persist(s, doc) {
  guard(s);
  const saved = JSON.stringify(await seal(s.key, s.salt, doc, context(s.owner, "local")));
  await commitLocal(
    s.owner,
    s.stored,
    saved,
    () => guard(s),
    () => {
      s.stored = saved;
      s.doc = doc;
    },
  );
  notify();
}
async function commitLocal(id, expected, saved, check, accept = () => {}) {
  if (!navigator.locks?.request)
    throw new Error("Update your browser to use encrypted local storage.");
  // getItem + setItem alone is not a cross-tab compare-and-swap.
  return navigator.locks.request(storageKey(id), () => {
    check();
    if (localStorage.getItem(storageKey(id)) !== expected)
      throw new Error("Local data changed in another tab. Lock and unlock again.");
    localStorage.setItem(storageKey(id), saved);
    accept();
  });
}
const dirty = (s) => !equal(s.doc.current, s.doc.base);
function historyFor(state, ...documents) {
  const history = {};
  for (const id of new Set(documents.flatMap((doc) => Object.keys(doc?.history || {})))) {
    if (!state["task/" + id]) continue;
    history[id] = [
      ...new Map(
        documents.flatMap((doc) => doc?.history?.[id] || []).map((e) => [e.id, e]),
      ).values(),
    ].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || String(b.id).localeCompare(String(a.id)),
    );
  }
  return history;
}
function combine(base, local, remote) {
  const state = {},
    conflicts = [];
  for (const k of new Set([
    ...Object.keys(base.state),
    ...Object.keys(local.state),
    ...Object.keys(remote.state),
  ])) {
    const b = base.state[k],
      l = local.state[k],
      r = remote.state[k];
    let value;
    if (equal(l, b)) value = r;
    else if (equal(r, b) || equal(l, r)) value = l;
    else if (k.startsWith("intake/") && l && r) value = r;
    else {
      conflicts.push(k);
      value = l;
    }
    if (value !== undefined) state[k] = value;
  }
  const history = historyFor(state, remote, local);
  return { current: { state, history }, conflicts };
}
async function synchronize(s) {
  guard(s);
  const remote = await network();
  guard(s);
  if (!remote.encrypted || remote.envelope.salt !== s.salt)
    throw new Error("Invalid encrypted document");
  if (remote.revision < s.doc.revision)
    throw new Error("The server returned an older encrypted document.");
  if (remote.revision !== s.doc.revision) {
    const clear = await open(s.key, remote.envelope, context(s.owner, "remote"));
    validateDocument(clear);
    const merged = combine(s.doc.base, s.doc.current, clear);
    const unresolved = s.doc.conflicts || [];
    for (const k of unresolved) {
      if (s.doc.current.state[k] === undefined) delete merged.current.state[k];
      else merged.current.state[k] = s.doc.current.state[k];
    }
    merged.conflicts = [...new Set([...unresolved, ...merged.conflicts])];
    try {
      validateDocument(merged.current);
      validateNewIntakes(clear, merged.current);
    } catch {
      merged.conflicts = [
        ...new Set([
          ...merged.conflicts,
          ...[
            ...new Set([...Object.keys(s.doc.current.state), ...Object.keys(clear.state)]),
          ].filter((k) => !equal(s.doc.current.state[k], clear.state[k])),
        ]),
      ];
    }
    const conflictLocal = clone(s.doc.conflictLocal || s.doc.current);
    for (const k of merged.conflicts) {
      if (unresolved.includes(k)) continue;
      if (s.doc.current.state[k] === undefined) delete conflictLocal.state[k];
      else conflictLocal.state[k] = s.doc.current.state[k];
    }
    await persist(s, {
      ...s.doc,
      revision: remote.revision,
      base: clear,
      current: merged.current,
      conflictLocal: merged.conflicts.length ? conflictLocal : null,
      conflicts: merged.conflicts,
      legacyRetained: remote.legacyRetained,
      generation: s.doc.generation + 1,
    });
    window.dispatchEvent(new Event("daymark:sync"));
  }
  if (s.doc.conflicts?.length) throw new Error("These items changed on both devices");
  if (dirty(s)) {
    validateDocument(s.doc.current);
    const envelope = await seal(s.key, s.salt, s.doc.current, context(s.owner, "remote"));
    guard(s);
    const reply = await network("PUT", { revision: s.doc.revision, envelope });
    guard(s);
    await persist(s, {
      ...s.doc,
      revision: reply.revision,
      base: clone(s.doc.current),
      lastSync: new Date().toISOString(),
    });
  }
  s.error = "";
  notify();
}
export async function unlockVault(passphrase, status) {
  const epoch = encryptionEpoch();
  const id = owner();
  const opening = () => {
    if (epoch !== encryptionEpoch() || id !== owner())
      throw new Error("Unlock your encrypted data first.");
  };
  if (!id) throw new Error("Unauthorized");
  const stored = localStorage.getItem(storageKey(id));
  const salt = status.encrypted
    ? status.envelope.salt
    : stored
      ? JSON.parse(stored).salt
      : newSalt();
  const key = await deriveKey(passphrase, salt);
  const s = { owner: id, key, salt, stored, error: "" };
  opening();
  if (!status.encrypted) {
    if (stored) {
      const recovery = await open(key, JSON.parse(stored), context(id, "local"));
      if (recovery.revision !== 0 || !equal(recovery.base, recovery.current))
        throw new Error("The server has no encrypted document. Your local copy is retained.");
    }
    if (passphrase.length < 12)
      throw new Error("Use at least 12 characters for your encryption passphrase.");
    // Finish pending native writes before taking the server migration snapshot.
    if (isOfflineApp()) {
      await offlineNative("prepareVault", { token: localStorage.getItem("token") });
      status = await network();
      opening();
      if (status.encrypted) throw new Error("Data changed. Reload before enabling encryption.");
    }
    const current = { state: status.legacy.state, history: status.legacy.history || {} };
    validateDocument(current);
    const envelope = await seal(key, salt, current, context(id, "remote"));
    if (!equal(await open(key, envelope, context(id, "remote")), current))
      throw new Error("Invalid encrypted document");
    // Persist an encrypted recovery copy before sending the migration request.
    const recovery = { revision: 0, base: current, current, generation: 0, legacyRetained: true };
    const backup = JSON.stringify(await seal(key, salt, recovery, context(id, "local")));
    opening();
    await commitLocal(id, stored, backup, opening, () => {
      s.stored = backup;
    });
    const reply = await network("PUT", { revision: 0, digest: status.digest, envelope });
    s.doc = { ...recovery, revision: reply.revision, legacyRetained: reply.legacyRetained };
  } else {
    if (stored) {
      s.doc = await open(key, JSON.parse(stored), context(id, "local"));
    } else {
      if (status.offline) throw new Error("Connect once to download your encrypted data.");
      const current = await open(key, status.envelope, context(id, "remote"));
      validateDocument(current);
      s.doc = {
        revision: status.revision,
        base: current,
        current,
        generation: 0,
        legacyRetained: status.legacyRetained,
      };
      if (isOfflineApp()) {
        const legacy = await offlineNative("legacyVault", { token: localStorage.getItem("token") });
        if (legacy.state && !equal(legacy.base, legacy.state)) {
          const previous = { state: legacy.base, history: legacy.history || {} };
          const local = { state: legacy.state, history: legacy.history || {} };
          validateDocument(local);
          const merged = combine(previous, local, current);
          try {
            validateDocument(merged.current);
            validateNewIntakes(current, merged.current);
          } catch {
            merged.conflicts = [
              ...new Set([...Object.keys(local.state), ...Object.keys(current.state)]),
            ].filter((k) => !equal(local.state[k], current.state[k]));
          }
          s.doc.current = merged.current;
          s.doc.conflicts = merged.conflicts;
          s.doc.conflictLocal = local;
        }
      }
    }
  }
  opening();
  setEncryptionSession(s);
  try {
    await persist(s, s.doc);
    if (!status.offline) {
      try {
        await synchronize(s);
      } catch (error) {
        if (!s.doc.conflicts?.length) throw error;
        s.error = error.message;
      }
    }
    clearBrowserCache();
    if (isOfflineApp() && !status.offline)
      await offlineNative("sealVault", { token: localStorage.getItem("token") });
  } catch (error) {
    lockEncryption();
    throw error;
  }
  return s;
}
export const vaultStatus = () => {
  const s = encryptionSession();
  return s
    ? {
        pending: dirty(s),
        conflicts: s.doc.conflicts || [],
        conflictItems: (s.doc.conflicts || []).map((key) => ({
          key,
          local: s.doc.conflictLocal?.state[key],
          remote: s.doc.base.state[key],
        })),
        legacyRetained: s.doc.legacyRetained,
        error: s.error,
      }
    : null;
};
export function syncVault() {
  const scheduled = encryptionSession();
  return serial(async () => {
    const s = scheduled;
    if (!s) return;
    try {
      await synchronize(s);
    } catch (error) {
      s.error = error.message;
      notify();
      throw error;
    }
  });
}
export function resolveVault(choice) {
  const scheduled = encryptionSession();
  return serial(async () => {
    const s = scheduled;
    guard(s);
    const doc = clone(s.doc);
    for (const k of doc.conflicts || []) {
      const value = choice === "remote" ? doc.base.state[k] : doc.conflictLocal.state[k];
      if (value === undefined) delete doc.current.state[k];
      else doc.current.state[k] = value;
    }
    doc.conflicts = [];
    doc.current.history = historyFor(doc.current.state, doc.current, doc.base, doc.conflictLocal);
    doc.conflictLocal = null;
    validateDocument(doc.current);
    validateNewIntakes(doc.base, doc.current);
    doc.generation++;
    await persist(s, doc);
    window.dispatchEvent(new Event("daymark:sync"));
    await synchronize(s);
  });
}
export function encryptedRequest(path, { method = "GET", body, signal, token } = {}) {
  const scheduled = encryptionSession();
  return serial(async () => {
    const s = scheduled;
    guard(s);
    if (tokenOwner(token) !== s.owner) throw new Error("Unauthorized");
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (method === "GET") {
      const match = /^\/kanban\/tasks\/([^/]+)\/history(?:\?(.*))?$/.exec(path);
      if (match) {
        const query = new URLSearchParams(match[2]);
        const history = s.doc.current.history?.[decodeURIComponent(match[1])] || [];
        const before = query.get("before"),
          limit = Number(query.get("limit") || 50);
        const index = before ? history.findIndex((e) => String(e.id) === before) + 1 : 0;
        const events = history.slice(index, index + limit);
        return {
          events: clone(events),
          nextCursor: events.length === limit ? events.at(-1).id : null,
        };
      }
      return localApi({ owner: s.owner, generation: s.doc.generation, ...s.doc.current }, path)
        .result;
    }
    if (s.doc.conflicts?.length) throw new Error("These items changed on both devices");
    const { result, state } = localApi(
      { owner: s.owner, generation: s.doc.generation, ...s.doc.current },
      path,
      method,
      body,
    );
    const doc = clone(s.doc);
    doc.current.state = state;
    doc.generation++;
    // History is part of the encrypted document too; it never reaches the legacy endpoint.
    for (const k of new Set([...Object.keys(s.doc.current.state), ...Object.keys(state)])) {
      if (!k.startsWith("task/") || equal(s.doc.current.state[k], state[k])) continue;
      const id = k.slice(5),
        previous = s.doc.current.state[k],
        value = state[k];
      if (!value) {
        delete doc.current.history[id];
        continue;
      }
      const kind = !previous
        ? "created"
        : !previous.completedAt && value.completedAt
          ? "completed"
          : previous.completedAt && !value.completedAt
            ? "reopened"
            : previous.columnId !== value.columnId || previous.position !== value.position
              ? "moved"
              : "edited";
      const history = (doc.current.history[id] ||= []);
      history.unshift({
        id: window.crypto.randomUUID(),
        taskId: id,
        kind,
        createdAt: new Date().toISOString(),
        details: {
          title: value.title,
          from: previous?.columnId,
          to: value.columnId,
          date: value.date,
        },
      });
    }
    validateDocument(doc.current);
    validateNewIntakes(s.doc.current, doc.current);
    await persist(s, doc);
    // Local durability precedes the network. Failures retain pending ciphertext for retry.
    try {
      await synchronize(s);
    } catch (error) {
      s.error = error.message;
      notify();
    }
    return result;
  });
}
