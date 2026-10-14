const { UniqueConstraintError } = require("sequelize");
const ApiError = require("../errors/ApiError");

module.exports = function errorMiddleware(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err instanceof UniqueConstraintError) {
    return res.status(409).json({ message: "This record already exists" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large" });
  }
  console.error("Request failed:", err.name);
  return res.status(500).json({ message: "Internal server error" });
};
