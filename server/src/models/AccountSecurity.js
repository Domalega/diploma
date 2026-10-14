const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Separate metadata keeps existing user tables compatible without destructive sync.
module.exports = sequelize.define("accountSecurity", {
  userId: { type: DataTypes.INTEGER, primaryKey: true },
  sessionVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  resetTokenHash: { type: DataTypes.STRING(64), allowNull: true, unique: true },
  resetExpiresAt: { type: DataTypes.DATE, allowNull: true },
  resetRequestedAt: { type: DataTypes.DATE, allowNull: true },
});
