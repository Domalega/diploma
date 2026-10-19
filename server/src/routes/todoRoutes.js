const { Router } = require("express");
const auth = require("../middleware/authMiddleware");
const handle = require("../middleware/jsonHandler");
const service = require("../services/todoService");
const router = Router();
router.use(auth);
router.get(
  "/",
  handle((req) => service.getList(req.user.id)),
);
router.post(
  "/",
  handle((req) => service.changeList(req.user.id, req.body)),
);
module.exports = router;
