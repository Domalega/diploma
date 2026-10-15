import { act, render } from "@testing-library/react";
import useDeviceReminders from "./useDeviceReminders";
import { nativeRequest, deviceRemindersEnabled } from "./nativeBridge";
jest.mock("./nativeBridge", () => ({
  isNativeApp: () => true,
  nativeRequest: jest.fn(),
  deviceRemindersEnabled: jest.fn(),
}));
const source = {
  dates: [],
  notesEnabled: true,
  plan: { userId: 1, enabled: false },
  recordsByDate: {},
  locale: "en",
  t: (key) => key,
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  deviceRemindersEnabled.mockReturnValue(true);
  nativeRequest.mockResolvedValue({ savedAt: "2026-10-15T08:00:00Z", exact: true });
});
afterEach(() => jest.useRealTimers());
test("only complete, opted-in snapshots reach the device and rapid edits are coalesced", async () => {
  let state;
  function Probe({ ready, data = source }) {
    state = useDeviceReminders(data, ready);
    return null;
  }
  const view = render(<Probe ready={false} />);
  await act(async () => jest.advanceTimersByTime(300));
  expect(nativeRequest).not.toHaveBeenCalled();
  deviceRemindersEnabled.mockReturnValue(false);
  view.rerender(<Probe ready />);
  await act(async () => jest.advanceTimersByTime(300));
  expect(nativeRequest).not.toHaveBeenCalled();
  deviceRemindersEnabled.mockReturnValue(true);
  view.rerender(<Probe ready={false} />);
  view.rerender(<Probe ready />);
  view.rerender(<Probe ready data={{ ...source, notesEnabled: false }} />);
  await act(async () => jest.advanceTimersByTime(300));
  expect(nativeRequest).toHaveBeenCalledTimes(1);
  expect(nativeRequest).toHaveBeenCalledWith(
    "sync",
    expect.objectContaining({ owner: "1", rules: [] }),
  );
  expect(state.savedAt).toBe("2026-10-15T08:00:00Z");
  view.rerender(<Probe ready data={{ ...source, notesEnabled: false, locale: "ru" }} />);
  view.unmount();
  await act(async () => jest.advanceTimersByTime(300));
  expect(nativeRequest).toHaveBeenCalledTimes(1);
});
test("a native save failure is visible instead of claiming the schedule is saved", async () => {
  nativeRequest.mockRejectedValue(new Error("Disk unavailable"));
  let state;
  function Probe() {
    state = useDeviceReminders(source, true);
    return null;
  }
  render(<Probe />);
  await act(async () => jest.advanceTimersByTime(300));
  expect(state.error).toMatch(/could not be saved/);
  expect(state.savedAt).toBeNull();
});
