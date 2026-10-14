const userService = require("../services/userService");
const { generateToken } = require("../services/tokenService");
const passwordResetService = require("../services/passwordResetService");
const mailService = require("../services/mailService");
const ApiError = require("../errors/ApiError");

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

exports.recoveryStatus = (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ available: mailService.isConfigured() });
};

exports.forgotPassword = (req, res, next) => {
  if (!mailService.isConfigured())
    return next(
      new ApiError(503, "Password recovery is temporarily unavailable. Please try again later."),
    );
  // Reply before looking up the account or sending mail to avoid timing disclosure.
  passwordResetService
    .requestReset(req.body.email)
    .catch(() => console.error("Password recovery delivery failed"));
  res.status(202).json({
    message: "If an account exists for this email, you will receive a password reset link.",
  });
};

exports.resetPassword = async (req, res, next) => {
  try {
    res.json(await passwordResetService.resetPassword(req.body.token, req.body.password));
  } catch (error) {
    next(error);
  }
};
