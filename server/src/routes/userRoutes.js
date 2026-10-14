const { Router } = require("express");
const { body } = require("express-validator");
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validateRequest");

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

router.post("/registration", credentials(), userController.registration);
router.post("/login", credentials(), userController.login);
router.get("/auth", authMiddleware, userController.check);

module.exports = router;
