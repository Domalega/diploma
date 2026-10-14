const { Router } = require("express");
const { body } = require("express-validator");
const userDateController = require("../controllers/userDateController");
const authMiddleware = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");

const router = Router();
const dateValidator = () =>
  body("date")
    .isString()
    .bail()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .bail()
    .isISO8601({ strict: true })
    .withMessage("Enter a valid date (YYYY-MM-DD)");

router.use(authMiddleware);
router.post(
  "/create",
  dateValidator(),
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
  dateValidator(),
  body("comment")
    .isString()
    .bail()
    .isLength({ max: 255 })
    .withMessage("Comment must not exceed 255 characters"),
  validateRequest,
  userDateController.update,
);
router.delete("/delete", dateValidator(), validateRequest, userDateController.delete);

module.exports = router;
