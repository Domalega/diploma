const { Router } = require("express");
const router = Router();

router.use("/user", require("./userRoutes"));
router.use("/userDate", require("./userDateRoutes"));
router.use("/medications", require("./medicationRoutes"));
router.use("/kanban", require("./kanbanRoutes"));

module.exports = router;
