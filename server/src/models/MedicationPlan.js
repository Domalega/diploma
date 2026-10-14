const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define("medicationPlan", {
  userId: { type: DataTypes.INTEGER, primaryKey: true },
  enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  reminders: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  rows: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  slots: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
});
