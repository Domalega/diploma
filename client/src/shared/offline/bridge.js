import createNativeRequest from "../api/nativeRequest";

export const isOfflineApp = () => !!window.DaymarkOffline?.postMessage;
export const offlineNative = createNativeRequest(
  () => (isOfflineApp() ? window.DaymarkOffline : null),
  {
    timeout: 90000,
    unavailable: "Open the updated Android app.",
    timeoutMessage: "Local storage did not respond. Try again.",
  },
);
