const { Router } = require("express");
const auth = require("../middleware/authMiddleware");
const handle = require("../middleware/jsonHandler");
const service = require("../services/syncService");
const router = Router();
router.use(auth);
router.get(
  "/",
  handle((req) => service.getSnapshot(req.user.id, req.query.history !== "none")),
);
router.post(
  "/",
  handle(async (req, res) => {
    const result = await service.exchange(req.user.id, req.body);
    res.status(result.conflicts.length ? 409 : 200);
    return result;
  }),
);
module.exports = router;
