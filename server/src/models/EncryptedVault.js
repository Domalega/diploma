const { DataTypes } = require("sequelize");
const database = require("../config/database");

module.exports = database.define("encryptedVault", {
  userId: { type: DataTypes.INTEGER, primaryKey: true },
  revision: { type: DataTypes.INTEGER, allowNull: false },
  legacyRetained: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  envelope: { type: DataTypes.JSON, allowNull: false },
});
