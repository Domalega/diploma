import createNativeRequest from "../api/nativeRequest";

export const supportsAppUpdates = () => !!window.DaymarkUpdates?.postMessage;
export const updateNative = createNativeRequest(
  () => (supportsAppUpdates() ? window.DaymarkUpdates : null),
  {
    timeout: 90000,
    unavailable: "Open the updated Android app.",
    timeoutMessage: "The update service did not respond. Try again.",
  },
);
