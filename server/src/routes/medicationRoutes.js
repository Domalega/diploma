const { Router } = require("express");
const { body, query } = require("express-validator");
const service = require("../services/medicationService");
const auth = require("../middleware/authMiddleware");
const validate = require("../middleware/validateRequest");
const router = Router();
const { planIsValid } = require("../services/medicationValidation");
const { validDate } = require("../services/validation");
const handle = require("../middleware/jsonHandler");
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
