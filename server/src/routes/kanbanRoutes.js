const { Router } = require("express");
const auth = require("../middleware/authMiddleware");
const handle = require("../middleware/jsonHandler");
const service = require("../services/kanbanService");
const router = Router();
router.use(auth);
router.get(
  "/",
  handle((req) => service.getBoard(req.user.id)),
);
router.post(
  "/",
  handle((req) => service.changeBoard(req.user.id, req.body)),
);
router.get(
  "/tasks/:id/history",
  handle((req) => service.getHistory(req.user.id, req.params.id, req.query)),
);
module.exports = router;
