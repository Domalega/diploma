const Router = require("express");
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const { body } = require("express-validator");

const router = new Router();

router.post(
  "/registration",
  body("email").isEmail(),
  userController.registration
);
router.post("/login", body("email").isEmail(), userController.login);
router.get("/auth", authMiddleware, userController.check);

module.exports = router;
