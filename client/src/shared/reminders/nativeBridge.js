import createNativeRequest from "../api/nativeRequest";

export const isNativeApp = () =>
  !!window.DaymarkNative?.postMessage ||
  (window.__DAYMARK_NATIVE__ === true && !!window.chrome?.webview?.postMessage);
export const nativeRequest = createNativeRequest(
  () => (isNativeApp() ? window.DaymarkNative || window.chrome.webview : null),
  {
    timeout: 30000,
    unavailable: "Open the installed Daymark app.",
    timeoutMessage: "The device reminder service did not respond.",
  },
);
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
