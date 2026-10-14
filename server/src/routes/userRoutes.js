const { Router } = require("express");
const { body } = require("express-validator");
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");
const authRateLimit = require("../middleware/authRateLimit");

const router = Router();
const credentials = () => [
  body("email")
    .isString()
    .bail()
    .trim()
    .isEmail()
    .isLength({ max: 255 })
    .withMessage("Enter a valid email address"),
  body("password")
    .isString()
    .bail()
    .notEmpty()
    .withMessage("Enter a password")
    .bail()
    .custom((value) => Buffer.byteLength(value, "utf8") <= 72)
    .withMessage("Password must not exceed 72 bytes"),
  validateRequest,
];

const newPassword = () =>
  body("password")
    .isString()
    .bail()
    .isLength({ min: 12 })
    .withMessage("Use at least 12 characters")
    .bail()
    .custom((value) => Buffer.byteLength(value, "utf8") <= 72)
    .withMessage("Password must not exceed 72 bytes");

router.post(
  "/registration",
  authRateLimit(15),
  credentials(),
  newPassword(),
  validateRequest,
  userController.registration,
);
router.post("/login", authRateLimit(30), credentials(), userController.login);
router.post(
  "/forgot-password",
  authRateLimit(10),
  body("email")
    .isString()
    .bail()
    .trim()
    .isEmail()
    .isLength({ max: 255 })
    .withMessage("Enter a valid email address"),
  validateRequest,
  userController.forgotPassword,
);
router.post(
  "/reset-password",
  authRateLimit(30),
  body("token")
    .isString()
    .bail()
    .matches(/^[a-f0-9]{64}$/)
    .withMessage("This reset link is invalid or expired. Request a new one."),
  newPassword(),
  validateRequest,
  userController.resetPassword,
);
router.get("/auth", authMiddleware, userController.check);
router.get("/password-recovery", userController.recoveryStatus);

module.exports = router;
