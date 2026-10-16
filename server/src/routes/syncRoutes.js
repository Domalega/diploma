const { Router } = require("express");
const auth = require("../middleware/authMiddleware");
const service = require("../services/syncService");
const router = Router();
router.use(auth);
router.get("/", async (req, res, next) => {
  try {
    res.json(await service.getSnapshot(req.user.id));
  } catch (error) {
    next(error);
  }
});
router.post("/", async (req, res, next) => {
  try {
    const result = await service.exchange(req.user.id, req.body);
    res.status(result.conflicts.length ? 409 : 200).json(result);
  } catch (error) {
    next(error);
  }
});
module.exports = router;
