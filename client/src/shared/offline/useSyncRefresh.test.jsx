import { act, renderHook } from "@testing-library/react";
import useSyncRefresh from "./useSyncRefresh";

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  delete window.DaymarkOffline;
});

test("web refreshes on reconnect, focus and the visible-page timer and cleans up", () => {
  const reload = jest.fn().mockResolvedValue();
  const { unmount } = renderHook(() => useSyncRefresh(reload));
  act(() => {
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));
    jest.advanceTimersByTime(60000);
  });
  expect(reload).toHaveBeenCalledTimes(3);
  unmount();
  act(() => {
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));
    jest.advanceTimersByTime(60000);
  });
  expect(reload).toHaveBeenCalledTimes(3);
});

test("Android uses only its existing sync notifications", () => {
  window.DaymarkOffline = { postMessage() {} };
  const reload = jest.fn().mockResolvedValue();
  renderHook(() => useSyncRefresh(reload));
  act(() => {
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));
    jest.advanceTimersByTime(60000);
  });
  expect(reload).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new Event("daymark:sync")));
  expect(reload).toHaveBeenCalledTimes(1);
});
