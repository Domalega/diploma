const { DataTypes } = require("sequelize");
const database = require("../config/database");

module.exports = database.define("kanbanBoard", {
  userId: { type: DataTypes.INTEGER, primaryKey: true },
  enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  columns: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
});
