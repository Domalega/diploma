const { DataTypes } = require("sequelize");
const database = require("../config/database");
module.exports = database.define("vaultDevice", {
  id: { type: DataTypes.UUID, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  publicKey: { type: DataTypes.JSON, allowNull: false },
  wrappedKey: { type: DataTypes.JSON, allowNull: true },
  label: { type: DataTypes.STRING(40), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
});
