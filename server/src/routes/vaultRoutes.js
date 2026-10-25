const { Router } = require("express");
const auth = require("../middleware/authMiddleware");
const handle = require("../middleware/jsonHandler");
const service = require("../services/vaultService");
const router = Router();
router.use(auth);
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.get(
  "/",
  handle((req) => service.read(req.user.id)),
);
router.put(
  "/",
  handle((req) => service.save(req.user.id, req.body)),
);
module.exports = router;
