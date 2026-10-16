import { supportsAppUpdates, updateNative } from "./bridge";
afterEach(() => {
  delete window.DaymarkUpdates;
  jest.useRealTimers();
});
test("the bridge only exists in a supported Android app", async () => {
  expect(supportsAppUpdates()).toBe(false);
  await expect(updateNative("status")).rejects.toThrow("updated Android app");
});
test("native responses are matched and malformed or stale responses are ignored", async () => {
  window.DaymarkUpdates = { postMessage: jest.fn() };
  const first = updateNative("check");
  const request = JSON.parse(window.DaymarkUpdates.postMessage.mock.calls[0][0]);
  window.DaymarkUpdates.onmessage({ data: "bad JSON" });
  window.DaymarkUpdates.onmessage({ data: JSON.stringify({ id: "stale", result: {} }) });
  window.DaymarkUpdates.onmessage({
    data: JSON.stringify({ id: request.id, result: { installedCode: 3 } }),
  });
  await expect(first).resolves.toEqual({ installedCode: 3 });
  const failure = updateNative("install");
  const next = JSON.parse(window.DaymarkUpdates.postMessage.mock.calls[1][0]);
  window.DaymarkUpdates.onmessage({ data: JSON.stringify({ id: next.id, error: "No space" }) });
  await expect(failure).rejects.toThrow("No space");
});
test("a hung native service times out and permits another attempt", async () => {
  jest.useFakeTimers();
  window.DaymarkUpdates = { postMessage: jest.fn() };
  const request = updateNative("check");
  const result = expect(request).rejects.toThrow("did not respond");
  jest.advanceTimersByTime(90001);
  await result;
});
