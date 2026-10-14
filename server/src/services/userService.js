const bcrypt = require("bcrypt");
const { User, AccountSecurity } = require("../models");
const ApiError = require("../errors/ApiError");
const { generateToken } = require("./tokenService");

async function register(email, password) {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw ApiError.conflict("A user with this email already exists");

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, password: hash });
  return { token: generateToken(user) };
}

async function login(email, password) {
  const user = await User.findOne({ where: { email } });
  if (!user) throw ApiError.unauthorized("Email or password is incorrect");
  const security = await AccountSecurity.findByPk(user.id);
  // Do not grant the new session version to an old password during a reset race.
  const current = await User.findByPk(user.id, { attributes: ["password"] });
  if (
    !current ||
    current.password !== user.password ||
    !(await bcrypt.compare(password, user.password))
  ) {
    throw ApiError.unauthorized("Email or password is incorrect");
  }
  return {
    token: generateToken({
      id: user.id,
      email: user.email,
      sessionVersion: security?.sessionVersion || 0,
    }),
  };
}

module.exports = { register, login };
