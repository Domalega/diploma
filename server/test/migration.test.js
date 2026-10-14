const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Sequelize, DataTypes } = require("sequelize");
const initializeDatabase = require("../src/config/initializeDatabase");

test("adding note times preserves legacy rows and is safe to repeat", async () => {
  const database = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
  const model = database.define("userDate", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: DataTypes.DATEONLY,
    comment: DataTypes.STRING,
    userId: DataTypes.INTEGER,
  });
  try {
    await database.sync();
    const old = await model.create({ date: "2026-10-14", comment: "Legacy note", userId: 7 });
    await initializeDatabase(database);
    await initializeDatabase(database);
    const [rows] = await database.query('SELECT id, date, comment, time FROM "userDates"');
    assert.deepEqual(rows, [
      { id: old.id, date: "2026-10-14", comment: "Legacy note", time: null },
    ]);
  } finally {
    await database.close();
  }
});
