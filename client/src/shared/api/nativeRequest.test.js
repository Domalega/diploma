import createNativeRequest from "./nativeRequest";

function fixture() {
  const bridge = { postMessage: jest.fn() };
  const request = createNativeRequest(() => bridge, {
    timeout: 1000,
    unavailable: "Unavailable",
    timeoutMessage: "Timed out",
  });
  return { bridge, request };
}
afterEach(() => jest.useRealTimers());

test("synchronous send errors clear their timeout and permit retry", async () => {
  jest.useFakeTimers();
  const { bridge, request } = fixture();
  bridge.postMessage.mockImplementationOnce(() => {
    throw new Error("Disconnected");
  });
  await expect(request("read")).rejects.toThrow("Disconnected");
  expect(jest.getTimerCount()).toBe(0);
  const retry = request("read");
  const { id } = JSON.parse(bridge.postMessage.mock.calls[1][0]);
  bridge.onmessage({ data: JSON.stringify({ id, result: { saved: true } }) });
  await expect(retry).resolves.toEqual({ saved: true });
  expect(jest.getTimerCount()).toBe(0);
});

test("malformed replies are ignored and native HTTP status reaches the caller", async () => {
  const { bridge, request } = fixture();
  const call = request("write");
  const { id } = JSON.parse(bridge.postMessage.mock.calls[0][0]);
  for (const data of ["invalid", "null", "{}", "[]", undefined]) bridge.onmessage({ data });
  bridge.onmessage({ data: JSON.stringify({ id, error: "Conflict", status: 409 }) });
  await expect(call).rejects.toMatchObject({ message: "Conflict", status: 409 });
});

test("Windows object replies and replacement Android bridges are both supported", async () => {
  let receive;
  let bridge = {
    postMessage: jest.fn(),
    addEventListener: (_, handler) => {
      receive = handler;
    },
  };
  const request = createNativeRequest(() => bridge, { timeout: 1000 });
  const windows = request("status");
  const { id } = JSON.parse(bridge.postMessage.mock.calls[0][0]);
  receive({ data: { id, result: "Windows" } });
  await expect(windows).resolves.toBe("Windows");
  bridge = { postMessage: jest.fn() };
  const android = request("status");
  const next = JSON.parse(bridge.postMessage.mock.calls[0][0]);
  bridge.onmessage({ data: JSON.stringify({ id: next.id, result: "Android" }) });
  await expect(android).resolves.toBe("Android");
});
