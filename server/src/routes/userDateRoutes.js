const { Router } = require("express");
const { body } = require("express-validator");
const userDateController = require("../controllers/userDateController");
const authMiddleware = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");

const router = Router();
const dateValidator = (optional = false) =>
  body("date")
    .optional(optional)
    .isString()
    .bail()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .bail()
    .isISO8601({ strict: true })
    .withMessage("Enter a valid date (YYYY-MM-DD)");
const timeValidator = () =>
  body("time")
    .optional({ nullable: true })
    .isString()
    .bail()
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage("Enter a valid time (HH:MM) or leave it empty");
const noteSelector = () => [
  body("id").optional().isInt({ min: 1 }).withMessage("Enter a valid note ID").toInt(),
  body()
    .custom((value) => value?.id !== undefined || value?.date !== undefined)
    .withMessage("A note ID is required"),
];

router.use(authMiddleware);
router.post(
  "/create",
  dateValidator(),
  timeValidator(),
  body("comment")
    .optional({ nullable: true })
    .isString()
    .bail()
    .isLength({ max: 255 })
    .withMessage("Comment must not exceed 255 characters"),
  validateRequest,
  userDateController.create,
);
router.get("/get", userDateController.getAll);
router.patch(
  "/update",
  dateValidator(true),
  ...noteSelector(),
  timeValidator(),
  body("comment")
    .isString()
    .bail()
    .isLength({ max: 255 })
    .withMessage("Comment must not exceed 255 characters"),
  validateRequest,
  userDateController.update,
);
router.delete(
  "/delete",
  dateValidator(true),
  ...noteSelector(),
  validateRequest,
  userDateController.delete,
);

module.exports = router;
