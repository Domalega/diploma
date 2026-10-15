import { isNativeApp, nativeRequest } from "./nativeBridge";
test("ordinary WebView hosts are not mistaken for the Daymark Windows client", async () => {
  const original = window.chrome;
  window.chrome = { webview: { postMessage: jest.fn() } };
  expect(isNativeApp()).toBe(false);
  await expect(nativeRequest("status")).rejects.toThrow("installed Daymark");
  expect(window.chrome.webview.postMessage).not.toHaveBeenCalled();
  window.chrome = original;
});
test("native replies are matched to requests, failures propagate, and stale replies are ignored", async () => {
  window.DaymarkNative = { postMessage: jest.fn() };
  const first = nativeRequest("status");
  const request = JSON.parse(window.DaymarkNative.postMessage.mock.calls[0][0]);
  window.DaymarkNative.onmessage({ data: "invalid JSON" });
  window.DaymarkNative.onmessage({ data: JSON.stringify({ id: "unknown", result: {} }) });
  window.DaymarkNative.onmessage({
    data: JSON.stringify({ id: request.id, result: { permission: "granted" } }),
  });
  await expect(first).resolves.toEqual({ permission: "granted" });
  const second = nativeRequest("sync", { rules: [] });
  const update = JSON.parse(window.DaymarkNative.postMessage.mock.calls[1][0]);
  window.DaymarkNative.onmessage({
    data: JSON.stringify({ id: update.id, error: "Storage unavailable" }),
  });
  await expect(second).rejects.toThrow("Storage unavailable");
  delete window.DaymarkNative;
});
