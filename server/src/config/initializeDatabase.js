const { DataTypes } = require("sequelize");

// Additive and repeatable: existing notes become all-day notes without rewriting rows.
module.exports = async function initializeDatabase(sequelize) {
  await sequelize.sync();
  const table = sequelize.models.userDate.getTableName();
  const query = sequelize.getQueryInterface();
  const columns = await query.describeTable(table);
  if (!columns.time)
    await query.addColumn(table, "time", { type: DataTypes.STRING(5), allowNull: true });
};
