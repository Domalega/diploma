import { tokenOwner } from "../api/browserCache";
import { isOfflineApp } from "../offline/bridge";
import { isNativeApp } from "../reminders/nativeBridge";
import { getDevice, readDevice, saveDevice, privateDeviceKey } from "./deviceStore";
import {
  newSalt,
  wrapContentKey,
  unwrapContentKey,
  samePublicKey,
  legacyRawKey,
  contentKey,
  open,
} from "./crypto";
import {
  inspectVault,
  vaultNetwork,
  deviceScope,
  deviceContext,
  bootstrapDeviceVault,
  activateDeviceVault,
} from "./vault";
import { encryptionEpoch } from "./session";
const owner = () => tokenOwner(localStorage.getItem("token"));
function flowGuard() {
  const id = owner(),
    epoch = encryptionEpoch();
  return () => {
    if (!id || owner() !== id || encryptionEpoch() !== epoch)
      throw new Error("Unlock your encrypted data first.");
  };
}
const label = () => (isOfflineApp() ? "Android" : isNativeApp() ? "Windows" : "Browser");
const registration = (device) => ({ id: device.id, publicKey: device.publicKey, label: label() });
const register = (device) => vaultNetwork("POST", registration(device), "/vault/devices");
const cleanRequest = (device, keyId) => ({
  version: 1,
  owner: owner(),
  id: device.id,
  publicKey: device.publicKey,
  keyId,
});
export function connectionLink(device, keyId) {
  const request = btoa(JSON.stringify(cleanRequest(device, keyId)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const url = new URL(
    isOfflineApp() ? "https://domalega.github.io/diploma/#/calendar" : window.location.href,
  );
  if (url.hash.startsWith("#/")) {
    url.search = "";
    url.hash = "/calendar?connect=" + request;
  } else {
    url.pathname = "/calendar";
    url.search = "?connect=" + request;
    url.hash = "";
  }
  return url.href;
}
export function parseConnection(search) {
  const value = new URLSearchParams(search).get("connect");
  if (!value || value.length > 4096) return null;
  try {
    const data = JSON.parse(atob(value.replace(/-/g, "+").replace(/_/g, "/")));
    if (
      data.version !== 1 ||
      data.owner !== owner() ||
      !/^[0-9a-f-]{36}$/i.test(data.id) ||
      typeof data.keyId !== "string" ||
      data.keyId.length !== 24 ||
      data.publicKey?.kty !== "EC" ||
      data.publicKey.crv !== "P-256" ||
      ![data.publicKey.x, data.publicKey.y].every(
        (v) => typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v),
      )
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
export async function initializeDeviceAccess() {
  const guard = flowGuard();
  guard();
  const status = await inspectVault();
  guard();
  if (!status.encrypted) return { mode: "plain", status };
  const scope = deviceScope(),
    device = await getDevice(scope);
  guard();
  let saved = device;
  if (!status.offline) {
    const row = await register(device);
    guard();
    if (row.wrappedKey && (!device.wrappedKey || device.keyId !== status.envelope.salt)) {
      saved = { ...device, wrappedKey: row.wrappedKey, keyId: status.envelope.salt };
      await saveDevice(scope, saved);
      guard();
    }
  }
  if (!saved.wrappedKey || saved.keyId !== status.envelope.salt)
    return {
      mode: status.envelope.version === 1 ? "legacy" : "waiting",
      status,
      link: connectionLink(device, status.envelope.salt),
      code: device.id.slice(0, 8),
    };
  const raw = await unwrapContentKey(
    saved.wrappedKey,
    await privateDeviceKey(saved),
    deviceContext(saved, saved.keyId),
  );
  try {
    guard();
    await activateDeviceVault(raw, status);
  } finally {
    raw.fill(0);
  }
  return { mode: "ready", status };
}
export async function enableDeviceEncryption() {
  const guard = flowGuard();
  guard();
  const scope = deviceScope(),
    device = await getDevice(scope);
  guard();
  const status = await inspectVault();
  guard();
  if (status.encrypted) return initializeDeviceAccess();
  await register(device);
  guard();
  const keyId = device.keyId || newSalt();
  const raw = device.wrappedKey
    ? await unwrapContentKey(
        device.wrappedKey,
        await privateDeviceKey(device),
        deviceContext(device, keyId),
      )
    : window.crypto.getRandomValues(new Uint8Array(32));
  try {
    const wrappedKey =
      device.wrappedKey ||
      (await wrapContentKey(raw, device.publicKey, deviceContext(device, keyId)));
    guard();
    await saveDevice(scope, { ...device, keyId, wrappedKey });
    guard();
    await bootstrapDeviceVault(raw, keyId, { ...registration(device), wrappedKey }, status);
    return { mode: "ready", status: { encrypted: true, envelope: { version: 2, salt: keyId } } };
  } finally {
    raw.fill(0);
  }
}
export async function approveDeviceConnection(request) {
  const guard = flowGuard();
  guard();
  if (request.owner !== owner()) throw new Error("Sign in to the same account on both devices.");
  const scope = deviceScope(),
    device = await readDevice(scope);
  guard();
  if (!device?.wrappedKey || device.keyId !== request.keyId || device.id === request.id)
    throw new Error("Open this link on an already connected device.");
  const row = await vaultNetwork("GET", undefined, "/vault/devices/" + request.id);
  guard();
  if (!samePublicKey(row.publicKey, request.publicKey))
    throw new Error("The connection link does not match this device.");
  if (row.wrappedKey) return;
  const raw = await unwrapContentKey(
    device.wrappedKey,
    await privateDeviceKey(device),
    deviceContext(device, device.keyId),
  );
  try {
    const wrappedKey = await wrapContentKey(
      raw,
      request.publicKey,
      deviceContext(request, request.keyId),
    );
    guard();
    await vaultNetwork(
      "PUT",
      { publicKey: request.publicKey, wrappedKey },
      "/vault/devices/" + request.id,
    );
  } finally {
    raw.fill(0);
  }
}
export async function rememberLegacyDevice(phrase, status) {
  const guard = flowGuard();
  guard();
  const scope = deviceScope(),
    device = await getDevice(scope),
    keyId = status.envelope.salt;
  guard();
  const raw = await legacyRawKey(phrase, keyId);
  try {
    // Verify possession before sharing a key from the previous format.
    await open(await contentKey(raw), status.envelope, `daymark:v1:${scope}:remote`);
    await register(device);
    guard();
    const wrappedKey = await wrapContentKey(raw, device.publicKey, deviceContext(device, keyId));
    guard();
    await vaultNetwork(
      "PUT",
      { publicKey: device.publicKey, wrappedKey },
      "/vault/devices/" + device.id,
    );
    await saveDevice(scope, { ...device, keyId, wrappedKey });
    await activateDeviceVault(raw, status);
    return { mode: "ready", status };
  } finally {
    raw.fill(0);
  }
}
