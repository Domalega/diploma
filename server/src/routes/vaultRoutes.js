const { Router } = require("express");
const auth = require("../middleware/authMiddleware");
const handle = require("../middleware/jsonHandler");
const service = require("../services/vaultService");
const devices = require("../services/vaultDeviceService");
const router = Router();
router.use(auth);
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.post(
  "/disable",
  handle((req) => service.disable(req.user.id, req.body)),
);
router.post(
  "/devices",
  handle((req) => devices.register(req.user.id, req.body)),
);
router.get(
  "/devices/:id",
  handle((req) => devices.read(req.user.id, req.params.id)),
);
router.put(
  "/devices/:id",
  handle((req) => devices.approve(req.user.id, { ...req.body, id: req.params.id })),
);
router.get(
  "/",
  handle((req) => service.read(req.user.id)),
);
router.put(
  "/",
  handle((req) => service.save(req.user.id, req.body)),
);
module.exports = router;
