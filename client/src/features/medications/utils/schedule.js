import { parseDate } from "../../calendar/utils/calendarDates";
import { translate } from "../../../shared/i18n/messages";
export const WEEKDAYS = [
  { value: 1, short: "M", name: "Monday" },
  { value: 2, short: "T", name: "Tuesday" },
  { value: 3, short: "W", name: "Wednesday" },
  { value: 4, short: "T", name: "Thursday" },
  { value: 5, short: "F", name: "Friday" },
  { value: 6, short: "S", name: "Saturday" },
  { value: 0, short: "S", name: "Sunday" },
];
export const EVERY_DAY = WEEKDAYS.map((day) => day.value);
export const emptyPlan = {
  userId: null,
  enabled: false,
  reminders: false,
  revision: 0,
  rows: [],
  slots: [],
};
export const intakeKey = (medicationId, slotId) => medicationId + ":" + slotId;
export const isDue = (row, date) =>
  date >= row.startDate &&
  (!row.endDate || date <= row.endDate) &&
  row.weekdays.includes(parseDate(date).getDay());
export function matrixForDay(plan, records, date) {
  const marks = new Map(
    records.map((record) => [intakeKey(record.medicationId, record.slotId), record]),
  );
  const rows = plan.rows.filter(
    (row) => isDue(row, date) || records.some((record) => record.medicationId === row.id),
  );
  const slots = [...plan.slots];
  records.forEach((record) => {
    if (!rows.some((row) => row.id === record.medicationId))
      rows.push({
        id: record.medicationId,
        name: record.nameSnapshot,
        detail: record.detailSnapshot,
        slotIds: [],
        weekdays: [],
        startDate: date,
        endDate: date,
        historical: true,
      });
    if (!slots.some((slot) => slot.id === record.slotId))
      slots.push({
        id: record.slotId,
        time: record.timeSnapshot,
        label: record.slotLabelSnapshot,
        historical: true,
      });
  });
  slots.sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  const scheduled = (row, slot) =>
    !row.historical && !slot.historical && isDue(row, date) && row.slotIds.includes(slot.id);
  return { rows, slots, marks, scheduled };
}
export const repeatLabel = (row, locale = "en") =>
  row.weekdays.length === 7
    ? translate("Every day", locale)
    : WEEKDAYS.filter((day) => row.weekdays.includes(day.value))
        .map((day) =>
          locale === "ru"
            ? new Intl.DateTimeFormat("ru", { weekday: "short" }).format(
                new Date(2024, 0, day.value === 0 ? 7 : day.value),
              )
            : day.name.slice(0, 3),
        )
        .join(", ");
