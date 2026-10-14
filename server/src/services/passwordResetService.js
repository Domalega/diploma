const { randomBytes, createHash } = require("node:crypto");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { User, AccountSecurity } = require("../models");
const ApiError = require("../errors/ApiError");
const mailService = require("./mailService");

const digest = (token) => createHash("sha256").update(token).digest("hex");
const invalidLink = () =>
  ApiError.badRequest("This reset link is invalid or expired. Request a new one.");

async function requestReset(email) {
  const user = await User.findOne({ where: { email } });
  if (!user) return;
  await AccountSecurity.findOrCreate({ where: { userId: user.id } });
  const token = randomBytes(32).toString("hex");
  const created = await sequelize.transaction(async (transaction) => {
    const security = await AccountSecurity.findByPk(user.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const now = Date.now();
    // Same response during cooldown, including for unknown accounts.
    if (security.resetRequestedAt && now - security.resetRequestedAt.getTime() < 60_000)
      return false;
    await security.update(
      {
        resetTokenHash: digest(token),
        resetExpiresAt: new Date(now + 15 * 60_000),
        resetRequestedAt: new Date(now),
      },
      { transaction },
    );
    return true;
  });
  if (created) await mailService.sendReset(user.email, token);
}

async function resetPassword(token, password) {
  const tokenHash = digest(token);
  const existing = await AccountSecurity.findOne({
    where: { resetTokenHash: tokenHash, resetExpiresAt: { [Op.gt]: new Date() } },
  });
  if (!existing) throw invalidLink();
  const hash = await bcrypt.hash(password, 10);
  const user = await sequelize.transaction(async (transaction) => {
    const security = await AccountSecurity.findByPk(existing.userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!security || security.resetTokenHash !== tokenHash || security.resetExpiresAt <= new Date())
      throw invalidLink();
    const account = await User.findByPk(security.userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!account) throw invalidLink();
    await account.update({ password: hash }, { transaction });
    await security.update(
      { sessionVersion: security.sessionVersion + 1, resetTokenHash: null, resetExpiresAt: null },
      { transaction },
    );
    return account;
  });
  // A notification failure must not undo a completed password change.
  mailService
    .sendResetConfirmation(user.email)
    .catch(() => console.error("Password change notification failed"));
  return { message: "Your password has been updated. Sign in with your new password." };
}

module.exports = { requestReset, resetPassword };
