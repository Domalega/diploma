const { Router } = require("express");
const router = Router();

router.use("/user", require("./userRoutes"));
router.use("/userDate", require("./userDateRoutes"));
router.use("/medications", require("./medicationRoutes"));

module.exports = router;
