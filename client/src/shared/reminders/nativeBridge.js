const pending = new Map();
let sequence = 0;
let listening = false;
export const isNativeApp = () =>
  !!window.DaymarkNative?.postMessage ||
  (window.__DAYMARK_NATIVE__ === true && !!window.chrome?.webview?.postMessage);

function receive(value) {
  let response;
  try {
    response = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return;
  }
  const request = pending.get(response?.id);
  if (!request) return;
  pending.delete(response.id);
  clearTimeout(request.timer);
  if (response.error) request.reject(new Error(response.error));
  else request.resolve(response.result);
}

export function nativeRequest(action, payload = {}) {
  if (!isNativeApp()) return Promise.reject(new Error("Open the installed Daymark app."));
  if (!listening) {
    if (window.DaymarkNative) window.DaymarkNative.onmessage = (event) => receive(event.data);
    else window.chrome.webview.addEventListener("message", (event) => receive(event.data));
    listening = true;
  }
  const id = String(++sequence);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("The device reminder service did not respond."));
    }, 30000);
    pending.set(id, { resolve, reject, timer });
    try {
      const message = JSON.stringify({ id, action, payload });
      if (window.DaymarkNative) window.DaymarkNative.postMessage(message);
      else window.chrome.webview.postMessage(message);
    } catch (error) {
      clearTimeout(timer);
      pending.delete(id);
      reject(error);
    }
  });
}

export const DEVICE_REMINDERS_KEY = "daymark.device-reminders";
export function deviceRemindersEnabled() {
  try {
    return localStorage.getItem(DEVICE_REMINDERS_KEY) === "on";
  } catch {
    return false;
  }
}
export function setDeviceReminders(value) {
  localStorage.setItem(DEVICE_REMINDERS_KEY, value ? "on" : "off");
}
