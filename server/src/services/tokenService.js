const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");

function generateToken({ id, email, sessionVersion = 0 }) {
  return jwt.sign({ id, email, sessionVersion }, jwtSecret, {
    expiresIn: "24h",
    algorithm: "HS256",
  });
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
}

module.exports = { generateToken, verifyToken };
