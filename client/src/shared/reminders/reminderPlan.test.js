import { reminderPlan } from "./reminderPlan";
import { translate } from "../i18n/messages";

const options = () => ({
  dates: [
    { id: 1, date: "2026-10-15", time: "09:30", comment: "Personal note" },
    { id: 2, date: "2026-10-16", time: null, comment: "All-day note" },
  ],
  notesEnabled: true,
  plan: {
    userId: 7,
    enabled: true,
    reminders: true,
    slots: [{ id: "am", time: "08:00" }],
    rows: [
      {
        id: "row",
        name: "Personal label",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        weekdays: [1, 3, 5],
        slotIds: ["am"],
      },
    ],
  },
  recordsByDate: { "2026-10-15": [{ medicationId: "row", slotId: "am" }] },
  locale: "ru",
  t: (key) => translate(key, "ru"),
});
test("portable plans retain weekdays, course boundaries and marks without transmitting tokens", () => {
  const value = reminderPlan(options());
  expect(value.owner).toBe("7");
  expect(value.rules).toHaveLength(2);
  expect(value.rules[0]).toMatchObject({
    kind: "note",
    startDate: "2026-10-15",
    endDate: "2026-10-15",
    time: "09:30",
    body: "Personal note",
  });
  expect(value.rules[1]).toMatchObject({
    id: "med:row:am",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    weekdays: [1, 3, 5],
    time: "08:00",
    body: "Personal label",
    title: "Напоминание о приёме",
  });
  expect(value.marks["2026-10-15"]).toEqual(["med:row:am"]);
  expect(value.onOpen).toHaveLength(1);
  expect(value.onOpen[0].body).toBe("All-day note");
  expect(JSON.stringify(value)).not.toMatch(/token|password/i);
});
test("disabled reminder categories are removed from the replacement snapshot", () => {
  const source = options();
  source.notesEnabled = false;
  expect(reminderPlan(source).rules.every((r) => r.kind === "medication")).toBe(true);
  expect(reminderPlan(source).onOpen).toEqual([]);
  source.plan.reminders = false;
  expect(reminderPlan(source).rules).toEqual([]);
  source.plan.reminders = true;
  source.plan.enabled = false;
  expect(reminderPlan(source).rules).toEqual([]);
});
