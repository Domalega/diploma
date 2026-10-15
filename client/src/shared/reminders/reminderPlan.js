// This portable contract contains no credentials. Native schedulers evaluate dates locally.
export function reminderPlan({ dates, notesEnabled, plan, recordsByDate, locale, t }) {
  const rules = [];
  const onOpen = [];
  if (notesEnabled)
    dates.forEach((note) => {
      (note.time ? rules : onOpen).push({
        id: "note:" + note.id,
        kind: "note",
        startDate: note.date,
        endDate: note.date,
        time: note.time || "00:00",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        title: t("A note for today"),
        body: (note.comment || t("Untitled note")).slice(0, 2000),
      });
    });
  if (plan.enabled && plan.reminders)
    plan.rows.forEach((row) => {
      plan.slots
        .filter((slot) => row.slotIds.includes(slot.id))
        .forEach((slot) => {
          rules.push({
            id: "med:" + row.id + ":" + slot.id,
            kind: "medication",
            startDate: row.startDate,
            endDate: row.endDate || null,
            time: slot.time,
            weekdays: [...row.weekdays],
            title: t("Medication reminder"),
            body: row.name,
          });
        });
    });
  const marks = {};
  Object.entries(recordsByDate).forEach(([date, records]) => {
    marks[date] = records.map((record) => "med:" + record.medicationId + ":" + record.slotId);
  });
  return { version: 1, owner: String(plan.userId), locale, rules, onOpen, marks };
}
