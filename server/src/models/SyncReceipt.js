const { DataTypes } = require("sequelize");
const database = require("../config/database");
module.exports = database.define("syncReceipt", {
  userId: { type: DataTypes.INTEGER, primaryKey: true },
  operationId: { type: DataTypes.UUID, primaryKey: true },
  digest: { type: DataTypes.STRING(64), allowNull: false },
});
