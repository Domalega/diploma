const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define("userDate", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  time: { type: DataTypes.STRING(5), allowNull: true },
  comment: { type: DataTypes.STRING, allowNull: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
});
