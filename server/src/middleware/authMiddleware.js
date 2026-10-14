const ApiError = require("../errors/ApiError");
const { verifyToken } = require("../services/tokenService");
const { AccountSecurity } = require("../models");

module.exports = async function authMiddleware(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get("authorization") || "");
  if (!match) return next(ApiError.unauthorized());

  let user;
  try {
    user = verifyToken(match[1]);
  } catch {
    return next(ApiError.unauthorized());
  }
  try {
    if (!Number.isInteger(user.id) || user.id < 1) {
      return next(ApiError.unauthorized());
    }
    const version = user.sessionVersion ?? 0;
    const security = await AccountSecurity.findByPk(user.id);
    if (!Number.isInteger(version) || version !== (security?.sessionVersion || 0)) {
      return next(ApiError.unauthorized());
    }
    req.user = { ...user, sessionVersion: version };
  } catch (error) {
    return next(error);
  }
  return next();
};
