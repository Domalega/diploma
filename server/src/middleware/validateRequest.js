const { validationResult } = require("express-validator");
const ApiError = require("../errors/ApiError");

module.exports = function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(ApiError.badRequest(errors.array()[0].msg));
  }
  return next();
};
