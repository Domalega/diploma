const { Router } = require("express");
const auth = require("../middleware/authMiddleware");
const service = require("../services/todoService");
const router = Router();
router.use(auth);
router.get("/", async (req, res, next) => {
  try {
    res.json(await service.getList(req.user.id));
  } catch (error) {
    next(error);
  }
});
router.post("/", async (req, res, next) => {
  try {
    res.json(await service.changeList(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
});
module.exports = router;
