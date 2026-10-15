const { Router } = require("express");
const auth = require("../middleware/authMiddleware");
const service = require("../services/kanbanService");
const router = Router();
router.use(auth);
router.get("/", async (req, res, next) => {
  try {
    res.json(await service.getBoard(req.user.id));
  } catch (error) {
    next(error);
  }
});
router.post("/", async (req, res, next) => {
  try {
    res.json(await service.changeBoard(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
});
router.get("/tasks/:id/history", async (req, res, next) => {
  try {
    res.json(await service.getHistory(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
});
module.exports = router;
