const userDateService = require("../services/userDateService");
const handle = require("../middleware/jsonHandler");

exports.create = handle((req) => {
  const { date, comment, time } = req.body;
  return userDateService.create(req.user.id, date, comment, time);
});
exports.getAll = handle((req) => userDateService.getAll(req.user.id));
exports.delete = handle((req) => userDateService.remove(req.user.id, req.body));
exports.update = handle((req) => userDateService.update(req.user.id, req.body));
