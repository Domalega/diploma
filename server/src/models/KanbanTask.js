const { DataTypes } = require("sequelize");
const database = require("../config/database");

module.exports = database.define(
  "kanbanTask",
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    columnId: { type: DataTypes.STRING, allowNull: false },
    title: { type: DataTypes.STRING(140), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    date: { type: DataTypes.DATEONLY, allowNull: true },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    startedAt: { type: DataTypes.DATE, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
  },
  { indexes: [{ fields: ["userId", "columnId", "position"] }, { fields: ["userId", "date"] }] },
);
