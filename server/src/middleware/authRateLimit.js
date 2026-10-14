const ApiError = require("../errors/ApiError");

module.exports = function authRateLimit(limit = 30) {
  const entries = new Map();
  const windowMs = 15 * 60_000;
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.expires <= now) entries.delete(key);
    }
    const key = req.ip;
    const entry = entries.get(key) || { count: 0, expires: now + windowMs };
    if (entry.count >= limit || (!entries.has(key) && entries.size >= 10_000)) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((entry.expires - now) / 1000))));
      return next(new ApiError(429, "Too many attempts. Please try again later."));
    }
    entry.count++;
    entries.set(key, entry);
    return next();
  };
};
