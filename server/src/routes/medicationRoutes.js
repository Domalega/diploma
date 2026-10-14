const { Router } = require("express");
const { body, query } = require("express-validator");
const service = require("../services/medicationService");
const auth = require("../middleware/authMiddleware");
const validate = require("../middleware/validateRequest");
const router = Router();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const time = /^([01]\d|2[0-3]):[0-5]\d$/;
function validDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
function planIsValid(plan) {
  if (
    !plan ||
    typeof plan.enabled !== "boolean" ||
    typeof plan.reminders !== "boolean" ||
    !Number.isInteger(plan.revision) ||
    plan.revision < 0
  )
    throw new Error("Enter valid tracker settings");
  if (
    !Array.isArray(plan.slots) ||
    plan.slots.length > 12 ||
    !Array.isArray(plan.rows) ||
    plan.rows.length > 40
  )
    throw new Error("Use up to 12 intake times and 40 medications");
  const slotIds = new Set();
  const times = new Set();
  for (const slot of plan.slots) {
    if (
      !slot ||
      typeof slot.id !== "string" ||
      !uuid.test(slot.id) ||
      slotIds.has(slot.id) ||
      typeof slot.time !== "string" ||
      !time.test(slot.time) ||
      times.has(slot.time) ||
      typeof slot.label !== "string" ||
      slot.label.length > 40
    )
      throw new Error("Enter distinct intake columns with valid HH:MM times");
    slotIds.add(slot.id);
    times.add(slot.time);
  }
  const rowIds = new Set();
  for (const row of plan.rows) {
    if (
      !row ||
      typeof row.id !== "string" ||
      !uuid.test(row.id) ||
      rowIds.has(row.id) ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      row.name.length > 80 ||
      typeof row.detail !== "string" ||
      row.detail.length > 120
    )
      throw new Error("Each medication needs a distinct ID and a name of up to 80 characters");
    rowIds.add(row.id);
    if (
      !Array.isArray(row.slotIds) ||
      !row.slotIds.length ||
      row.slotIds.length > 12 ||
      new Set(row.slotIds).size !== row.slotIds.length ||
      row.slotIds.some((id) => !slotIds.has(id))
    )
      throw new Error("Choose existing intake times for each medication");
    if (
      !validDate(row.startDate) ||
      (row.endDate !== null && (!validDate(row.endDate) || row.endDate < row.startDate))
    )
      throw new Error("Enter valid course dates");
    if (
      !Array.isArray(row.weekdays) ||
      !row.weekdays.length ||
      row.weekdays.length > 7 ||
      row.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
      new Set(row.weekdays).size !== row.weekdays.length
    )
      throw new Error("Choose at least one day of the week");
  }
  return true;
}
const handle = (action) => async (req, res, next) => {
  try {
    res.json(await action(req));
  } catch (error) {
    next(error);
  }
};
const markRules = () => [
  body("date").custom(validDate).withMessage("Enter a valid date (YYYY-MM-DD)"),
  body("slotId").isUUID(4),
  body("taken")
    .custom((value) => typeof value === "boolean")
    .withMessage("Taken must be true or false"),
  body("revision").isInt({ min: 0 }).toInt(),
];
router.use(auth);
router.get(
  "/plan",
  handle((req) => service.getPlan(req.user.id)),
);
router.put(
  "/plan",
  body().custom(planIsValid),
  validate,
  handle((req) => service.savePlan(req.user.id, req.body)),
);
router.get(
  "/intakes",
  query("date").custom(validDate).withMessage("Enter a valid date (YYYY-MM-DD)"),
  validate,
  handle((req) => service.getIntakes(req.user.id, req.query.date)),
);
router.put(
  "/intakes",
  ...markRules(),
  body("medicationId").isUUID(4),
  validate,
  handle((req) => service.mark(req.user.id, req.body)),
);
router.put(
  "/intakes/column",
  ...markRules(),
  validate,
  handle((req) => service.mark(req.user.id, req.body, true)),
);
module.exports = router;
