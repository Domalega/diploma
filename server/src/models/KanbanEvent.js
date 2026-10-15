const { DataTypes } = require("sequelize");
const database = require("../config/database");

module.exports = database.define(
  "kanbanEvent",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    taskId: { type: DataTypes.UUID, allowNull: false },
    kind: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
  },
  { indexes: [{ fields: ["userId", "taskId"] }] },
);
