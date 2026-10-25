import { base64, bytes, cleanPublicKey } from "./crypto";
import { isOfflineApp, offlineNative } from "../offline/bridge";
import { isNativeApp, nativeRequest } from "../reminders/nativeBridge";
async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("daymark-device-keys", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("devices");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Device key storage is unavailable."));
    request.onblocked = () => reject(new Error("Close other Daymark tabs and try again."));
  });
}
export async function readDevice(scope) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("devices", "readonly"),
        request = tx.objectStore("devices").get(scope);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error("Device key storage is unavailable."));
    });
  } finally {
    db.close();
  }
}
export async function saveDevice(scope, device) {
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("devices", "readwrite");
      tx.objectStore("devices").put(device, scope);
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(new Error("The device key could not be saved."));
    });
  } finally {
    db.close();
  }
}
async function protection(action, data) {
  try {
    return isOfflineApp()
      ? await offlineNative(action, { data, token: localStorage.getItem("token") })
      : await nativeRequest(action, { data });
  } catch {
    throw new Error("Update the installed Daymark app to protect this device key.");
  }
}
export async function privateDeviceKey(device) {
  if (device.privateKey) return device.privateKey;
  const result = await protection("unprotectDeviceKey", device.protectedPrivate);
  return window.crypto.subtle.importKey(
    "pkcs8",
    bytes(result.data),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
}
export async function getDevice(scope, renew = false) {
  if (!window.crypto?.subtle) throw new Error("Encryption requires HTTPS and an updated browser.");
  if (!navigator.locks?.request)
    throw new Error("Update your browser to use encrypted local storage.");
  return navigator.locks.request("daymark-device:" + scope, async () => {
    const saved = await readDevice(scope);
    if (saved && !renew) return saved;
    if (saved) await saveDevice(scope + ":backup:" + saved.id, saved);
    const native = isNativeApp() || isOfflineApp();
    const keys = await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      native,
      ["deriveBits"],
    );
    const device = {
      id: window.crypto.randomUUID(),
      publicKey: cleanPublicKey(await window.crypto.subtle.exportKey("jwk", keys.publicKey)),
    };
    if (native) {
      const raw = await window.crypto.subtle.exportKey("pkcs8", keys.privateKey);
      device.protectedPrivate = (await protection("protectDeviceKey", base64(raw))).data;
    } else device.privateKey = keys.privateKey;
    await saveDevice(scope, device);
    const verified = await readDevice(scope);
    if (!verified || verified.id !== device.id)
      throw new Error("The device key could not be saved.");
    return verified;
  });
}
