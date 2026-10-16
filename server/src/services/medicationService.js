const userWrite = require("./userWrite");
const { MedicationPlan, MedicationIntake } = require("../models");
const ApiError = require("../errors/ApiError");

const defaultPlan = (userId) => ({
  userId,
  enabled: false,
  reminders: false,
  revision: 0,
  rows: [],
  slots: [],
});
function isDue(row, date) {
  if (date < row.startDate || (row.endDate && date > row.endDate)) return false;
  return row.weekdays.includes(new Date(date + "T00:00:00Z").getUTCDay());
}

async function getPlan(userId) {
  const plan = await MedicationPlan.findByPk(userId);
  return plan ? plan.toJSON() : defaultPlan(userId);
}
async function getIntakes(userId, date, transaction) {
  return MedicationIntake.findAll({ where: { userId, date }, order: [["id", "ASC"]], transaction });
}
async function lockedPlan(userId, revision, transaction) {
  const plan = await MedicationPlan.findByPk(userId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!plan || plan.revision !== revision)
    throw ApiError.conflict("The medication schedule changed. Reload it before saving.");
  return plan;
}
async function savePlan(userId, values) {
  return userWrite(userId, async (transaction) => {
    await MedicationPlan.findOrCreate({
      where: { userId },
      defaults: defaultPlan(userId),
      transaction,
    });
    const plan = await lockedPlan(userId, values.revision, transaction);
    const slots = values.slots.map(({ id, time, label }) => ({ id, time, label: label.trim() }));
    const rows = values.rows.map(({ id, name, detail, slotIds, weekdays, startDate, endDate }) => ({
      id,
      name: name.trim(),
      detail: detail.trim(),
      slotIds,
      weekdays,
      startDate,
      endDate,
    }));
    await plan.update(
      {
        enabled: values.enabled,
        reminders: values.reminders,
        rows,
        slots,
        revision: plan.revision + 1,
      },
      { transaction },
    );
    return plan.toJSON();
  });
}
async function mark(userId, values, entireColumn = false) {
  return userWrite(userId, async (transaction) => {
    const plan = await lockedPlan(userId, values.revision, transaction);
    if (!plan.enabled) throw ApiError.conflict("Enable the experimental medication tracker first.");
    const slot = plan.slots.find((item) => item.id === values.slotId);
    let rows;
    if (entireColumn) {
      if (!slot) throw ApiError.notFound("Intake time was not found");
      rows = plan.rows.filter((row) => row.slotIds.includes(slot.id) && isDue(row, values.date));
      if (!rows.length) throw ApiError.badRequest("No medications are scheduled for this column");
    } else {
      const row = plan.rows.find((item) => item.id === values.medicationId);
      if (
        values.taken &&
        (!slot || !row || !row.slotIds.includes(slot.id) || !isDue(row, values.date))
      )
        throw ApiError.badRequest("This medication is not scheduled for this time and day");
      rows = row ? [row] : [{ id: values.medicationId }];
    }
    for (const row of rows) {
      const where = { userId, date: values.date, medicationId: row.id, slotId: values.slotId };
      if (values.taken) {
        await MedicationIntake.findOrCreate({
          where,
          defaults: {
            ...where,
            takenAt: new Date(),
            nameSnapshot: row.name,
            detailSnapshot: row.detail || "",
            timeSnapshot: slot.time,
            slotLabelSnapshot: slot.label || "",
          },
          transaction,
        });
      } else {
        await MedicationIntake.destroy({ where, transaction });
      }
    }
    return { records: await getIntakes(userId, values.date, transaction) };
  });
}

module.exports = { defaultPlan, isDue, getPlan, savePlan, getIntakes, mark };
