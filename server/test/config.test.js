const { test } = require("node:test");
const assert = require("node:assert/strict");

process.env.SECRET_KEY = "config-test-only-secret";
process.env.DB_DIALECT = "postgres";
process.env.DATABASE_URL = "postgresql://test:password@example.com/calendar?sslmode=require";
process.env.NODE_ENV = "production";
process.env.CLIENT_ORIGIN = "https://domalega.github.io";

test("cloud PostgreSQL uses a URL and certificate-verified TLS", () => {
  const { database, clientOrigins, host } = require("../src/config/env");
  assert.equal(new URL(database.url).searchParams.get("sslmode"), "verify-full");
  assert.equal(database.ssl, true);
  assert.equal(host, "0.0.0.0");
  assert.deepEqual(clientOrigins, ["https://domalega.github.io"]);
  const sequelize = require("../src/config/database");
  assert.equal(sequelize.options.dialectOptions.ssl.rejectUnauthorized, true);
  return sequelize.close();
});
