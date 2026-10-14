const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define(
  "medicationIntake",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    medicationId: { type: DataTypes.UUID, allowNull: false },
    slotId: { type: DataTypes.UUID, allowNull: false },
    takenAt: { type: DataTypes.DATE, allowNull: false },
    nameSnapshot: { type: DataTypes.STRING(80), allowNull: false },
    detailSnapshot: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
    timeSnapshot: { type: DataTypes.STRING(5), allowNull: false },
    slotLabelSnapshot: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
  },
  {
    indexes: [{ unique: true, fields: ["userId", "date", "medicationId", "slotId"] }],
  },
);
