const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const dialect = process.env.DB_DIALECT || "postgres";
if (!["postgres", "sqlite"].includes(dialect)) {
  throw new Error("DB_DIALECT must be postgres or sqlite");
}
const required = ["SECRET_KEY"];
if (dialect === "postgres") required.push("DB_NAME", "DB_USER", "DB_PASSWORD", "DB_HOST");
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing environment variables: ${missing.join(", ")}`);
}

function readPort(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Invalid port in ${name}`);
  }
  return value;
}

module.exports = {
  port: readPort("PORT", 5000),
  jwtSecret: process.env.SECRET_KEY,
  database: {
    dialect,
    storage:
      process.env.SQLITE_STORAGE === ":memory:"
        ? ":memory:"
        : path.resolve(__dirname, "../..", process.env.SQLITE_STORAGE || "data/calendar.sqlite"),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: dialect === "postgres" ? readPort("DB_PORT", 5432) : undefined,
  },
};
