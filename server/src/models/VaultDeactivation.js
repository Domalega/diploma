const { DataTypes } = require("sequelize");
const database = require("../config/database");
module.exports = database.define(
  "vaultDeactivation",
  {
    id: { type: DataTypes.UUID, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    revision: { type: DataTypes.INTEGER, allowNull: false },
    salt: { type: DataTypes.STRING, allowNull: false },
    digest: { type: DataTypes.STRING, allowNull: false },
    envelope: { type: DataTypes.JSON, allowNull: false },
    legacy: { type: DataTypes.JSON, allowNull: false },
  },
  { indexes: [{ fields: ["userId", "revision", "salt"] }] },
);
