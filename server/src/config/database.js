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
  const options = {
    dialect: "postgres",
    logging: false,
    pool: { max: 5, min: 0, idle: 10000 },
    dialectOptions: database.ssl ? { ssl: { require: true, rejectUnauthorized: true } } : {},
  };
  if (database.url) {
    const url = new URL(database.url);
    // Pass TLS separately so connection-string options cannot override certificate checks.
    module.exports = new Sequelize(
      decodeURIComponent(url.pathname.slice(1)),
      decodeURIComponent(url.username),
      decodeURIComponent(url.password),
      { ...options, host: url.hostname, port: Number(url.port || 5432) },
    );
  } else {
    module.exports = new Sequelize(database.name, database.user, database.password, {
      ...options,
      host: database.host,
      port: database.port,
    });
  }
}
