import { act, render } from "@testing-library/react";
import useMedicationReminders from "./useMedicationReminders";
import { EVERY_DAY } from "../utils/schedule";
const plan = {
  userId: 7,
  enabled: true,
  reminders: true,
  slots: [
    { id: "morning", time: "08:00" },
    { id: "night", time: "22:00" },
  ],
  rows: [
    {
      id: "a",
      name: "Private example A",
      slotIds: ["morning", "night"],
      weekdays: EVERY_DAY,
      startDate: "2026-10-01",
      endDate: null,
    },
    {
      id: "b",
      name: "Private example B",
      slotIds: ["morning"],
      weekdays: [3],
      startDate: "2026-10-01",
      endDate: "2026-10-31",
    },
  ],
};
let original;
beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 14, 7, 59));
  original = window.Notification;
  window.Notification = jest.fn();
  Notification.permission = "granted";
});
afterEach(() => {
  window.Notification = original;
  jest.useRealTimers();
});
function Fixture({ schedule = plan, records = [], ready = true, permission = "granted" }) {
  useMedicationReminders(schedule, records, permission, ready);
  return null;
}
test("reminders wait for the slot time, omit medication names and skip previously taken cells", () => {
  render(<Fixture records={[{ date: "2026-10-14", medicationId: "a", slotId: "morning" }]} />);
  expect(Notification).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(60000));
  expect(Notification).toHaveBeenCalledTimes(1);
  expect(Notification.mock.calls[0][0]).toBe("08:00 — Medication reminder");
  expect(Notification.mock.calls[0][1].body).toContain("1 scheduled item");
  expect(Notification.mock.calls[0][1].body).not.toContain("Private");
  act(() => window.dispatchEvent(new Event("focus")));
  expect(Notification).toHaveBeenCalledTimes(1);
  act(() => {
    jest.setSystemTime(new Date(2026, 9, 14, 22, 0));
    window.dispatchEvent(new Event("focus"));
  });
  expect(Notification).toHaveBeenCalledTimes(2);
});
test("disabled, unready and completed schedules do not notify or request permission", () => {
  jest.setSystemTime(new Date(2026, 9, 14, 8, 0));
  Notification.requestPermission = jest.fn();
  const view = render(<Fixture schedule={{ ...plan, enabled: false }} />);
  view.rerender(<Fixture ready={false} />);
  view.rerender(<Fixture permission="default" />);
  view.rerender(
    <Fixture
      records={[
        { date: "2026-10-14", medicationId: "a", slotId: "morning" },
        { date: "2026-10-14", medicationId: "b", slotId: "morning" },
      ]}
    />,
  );
  expect(Notification).not.toHaveBeenCalled();
  expect(Notification.requestPermission).not.toHaveBeenCalled();
  view.unmount();
  expect(jest.getTimerCount()).toBe(0);
});
test("notification deduplication survives remounts and remains scoped to the account", () => {
  jest.setSystemTime(new Date(2026, 9, 14, 8, 0));
  let view = render(<Fixture />);
  expect(Notification).toHaveBeenCalledTimes(1);
  view.unmount();
  view = render(<Fixture />);
  expect(Notification).toHaveBeenCalledTimes(1);
  view.rerender(<Fixture schedule={{ ...plan, userId: 8 }} />);
  expect(Notification).toHaveBeenCalledTimes(2);
  view.rerender(<Fixture schedule={{ ...plan, userId: 8, reminders: false }} />);
  expect(jest.getTimerCount()).toBe(0);
});
