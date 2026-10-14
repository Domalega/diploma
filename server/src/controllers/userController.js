const userService = require("../services/userService");
const { generateToken } = require("../services/tokenService");

exports.registration = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    res.json(await userService.register(email, password));
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    res.json(await userService.login(email, password));
  } catch (error) {
    next(error);
  }
};

exports.check = (req, res) => {
  res.json({ token: generateToken(req.user) });
};
