const bcrypt = require("bcrypt");
const { User } = require("../models");
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
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw ApiError.unauthorized("Email or password is incorrect");
  }
  return { token: generateToken(user) };
}

module.exports = { register, login };
