import { render, act } from "@testing-library/react";
import useDateNotifications from "./useDateNotifications";
import useNotificationSettings, { NOTIFICATION_KEY } from "./useNotificationSettings";
import { todayKey } from "../utils/calendarDates";
let original;
beforeEach(() => {
  original = window.Notification;
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 14, 23, 59, 30));
  window.Notification = jest.fn();
  window.Notification.permission = "granted";
});
afterEach(() => {
  window.Notification = original;
  jest.useRealTimers();
});
function Reminders({ notes, enabled = true }) {
  useDateNotifications(notes, enabled, "granted");
  return null;
}
test("reminders respect the toggle, notify once per note, and roll over to the next day", () => {
  const notes = [
    { id: 1, date: todayKey(), comment: "Today" },
    { id: 2, date: "2026-10-15", comment: "Tomorrow" },
  ];
  const view = render(<Reminders notes={notes} enabled={false} />);
  expect(Notification).not.toHaveBeenCalled();
  view.rerender(<Reminders notes={notes} />);
  expect(Notification).toHaveBeenCalledTimes(1);
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(Notification).toHaveBeenCalledTimes(1);
  act(() => {
    jest.advanceTimersByTime(60000);
  });
  expect(Notification).toHaveBeenCalledTimes(2);
  expect(Notification.mock.calls[1][1].body).toBe("Tomorrow");
  view.unmount();
  expect(jest.getTimerCount()).toBe(0);
});
test("notification preferences survive remounting and browser permission is requested only by an action", async () => {
  let settings;
  function Settings() {
    settings = useNotificationSettings();
    return null;
  }
  Notification.permission = "default";
  Notification.requestPermission = jest.fn(async () => "granted");
  const view = render(<Settings />);
  expect(Notification.requestPermission).not.toHaveBeenCalled();
  act(() => {
    settings.setEnabled(false);
  });
  expect(localStorage.getItem(NOTIFICATION_KEY)).toBe("off");
  view.unmount();
  render(<Settings />);
  expect(settings.enabled).toBe(false);
  await act(async () => {
    await settings.requestPermission();
  });
  expect(settings.permission).toBe("granted");
  expect(settings.enabled).toBe(true);
});

test("several timed notes wait for their local time and each reminds once", () => {
  jest.setSystemTime(new Date(2026, 9, 14, 9, 29, 0));
  const notes = [
    { id: 11, date: todayKey(), time: null, comment: "All day" },
    { id: 12, date: todayKey(), time: "09:30", comment: "Morning call" },
    { id: 13, date: todayKey(), time: "09:30", comment: "Another call" },
    { id: 14, date: todayKey(), time: "16:00", comment: "Afternoon" },
  ];
  render(<Reminders notes={notes} />);
  expect(Notification).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(60000));
  expect(Notification).toHaveBeenCalledTimes(3);
  expect(Notification.mock.calls[1][0]).toBe("09:30 — A note for today");
  act(() => window.dispatchEvent(new Event("focus")));
  expect(Notification).toHaveBeenCalledTimes(3);
  act(() => {
    jest.setSystemTime(new Date(2026, 9, 14, 16, 0));
    window.dispatchEvent(new Event("focus"));
  });
  expect(Notification).toHaveBeenCalledTimes(4);
});
