const Router = require("express");
const userDateController = require("../controllers/userDateController");
const authMiddleware = require("../middleware/authMiddleware");
const router = new Router();

router.post("/create", authMiddleware, userDateController.create);
router.get("/get", authMiddleware, userDateController.getAll);
router.delete("/delete", authMiddleware, userDateController.delete);

module.exports = router;
