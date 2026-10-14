const { Sequelize } = require("sequelize");
const fs = require("node:fs");
const path = require("node:path");
const { database } = require("./env");

if (database.dialect === "sqlite") {
  if (database.storage !== ":memory:") {
    fs.mkdirSync(path.dirname(database.storage), { recursive: true });
  }
  module.exports = new Sequelize({
    dialect: "sqlite",
    storage: database.storage,
    logging: false,
  });
} else {
  module.exports = new Sequelize(database.name, database.user, database.password, {
    dialect: "postgres",
    host: database.host,
    port: database.port,
    logging: false,
  });
}
