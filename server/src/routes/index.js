const { Router } = require("express");
const router = Router();

router.use("/user", require("./userRoutes"));
router.use("/vault", require("./vaultRoutes"));
router.use(
  ["/userDate", "/medications", "/kanban", "/todos", "/sync"],
  require("../middleware/authMiddleware"),
  async (req, res, next) => {
    try {
      if (await require("../services/activeVault")(req.user.id))
        return next(
          require("../errors/ApiError").conflict(
            "Unlock your encrypted data in an updated Daymark client.",
          ),
        );
      next();
    } catch (error) {
      next(error);
    }
  },
);
router.use("/userDate", require("./userDateRoutes"));
router.use("/medications", require("./medicationRoutes"));
router.use("/kanban", require("./kanbanRoutes"));
router.use("/todos", require("./todoRoutes"));
router.use("/sync", require("./syncRoutes"));

module.exports = router;
