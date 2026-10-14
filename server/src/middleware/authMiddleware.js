const ApiError = require("../errors/ApiError");
const { verifyToken } = require("../services/tokenService");

module.exports = function authMiddleware(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get("authorization") || "");
  if (!match) return next(ApiError.unauthorized());

  try {
    const user = verifyToken(match[1]);
    if (!Number.isInteger(user.id) || user.id < 1) {
      return next(ApiError.unauthorized());
    }
    req.user = user;
  } catch {
    return next(ApiError.unauthorized());
  }
  return next();
};
