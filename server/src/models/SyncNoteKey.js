const { DataTypes } = require("sequelize");
const database = require("../config/database");
module.exports = database.define("syncNoteKey", {
  userId: { type: DataTypes.INTEGER, primaryKey: true },
  key: { type: DataTypes.UUID, primaryKey: true },
  noteId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
});
