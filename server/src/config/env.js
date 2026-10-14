const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const dialect = process.env.DB_DIALECT || "postgres";
if (!["postgres", "sqlite"].includes(dialect)) {
  throw new Error("DB_DIALECT must be postgres or sqlite");
}
const required = ["SECRET_KEY"];
if (dialect === "postgres" && !process.env.DATABASE_URL) {
  required.push("DB_NAME", "DB_USER", "DB_PASSWORD", "DB_HOST");
}
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

const ssl =
  dialect === "postgres" &&
  (process.env.NODE_ENV === "production" ||
    process.env.DB_SSL === "true" ||
    (Boolean(process.env.DATABASE_URL) && process.env.DB_SSL !== "false"));
let databaseUrl;
if (dialect === "postgres" && process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      url.pathname.length < 2
    ) {
      throw new Error();
    }
    if (ssl) url.searchParams.set("sslmode", "verify-full");
    databaseUrl = url.toString();
  } catch {
    throw new Error("Invalid PostgreSQL DATABASE_URL");
  }
}

const mailTransport =
  process.env.MAIL_TRANSPORT || (process.env.NODE_ENV === "production" ? "google" : "outbox");
if (!["google", "outbox"].includes(mailTransport)) throw new Error("Invalid MAIL_TRANSPORT");
if (process.env.NODE_ENV === "production" && mailTransport === "outbox") {
  throw new Error("Local mail outbox is not allowed in production");
}
const resetUrl =
  process.env.PASSWORD_RESET_URL ||
  (process.env.NODE_ENV !== "production" ? "http://localhost:3000/reset-password" : undefined);
if (
  process.env.GOOGLE_MAIL_URL &&
  !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
    process.env.GOOGLE_MAIL_URL,
  )
) {
  throw new Error("GOOGLE_MAIL_URL must be a deployed Google Apps Script web app URL");
}
if (process.env.GOOGLE_MAIL_SECRET && !/^[a-f0-9]{64}$/.test(process.env.GOOGLE_MAIL_SECRET)) {
  throw new Error("GOOGLE_MAIL_SECRET must be a 32-byte hexadecimal secret");
}
if (resetUrl) {
  let url;
  try {
    url = new URL(resetUrl);
  } catch {
    throw new Error("Invalid PASSWORD_RESET_URL");
  }
  const local =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    (!local && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash.includes("?")
  ) {
    throw new Error("PASSWORD_RESET_URL must be a trusted frontend URL without query parameters");
  }
}

module.exports = {
  port: readPort("PORT", 5000),
  host: process.env.HOST || "0.0.0.0",
  jwtSecret: process.env.SECRET_KEY,
  mail: {
    transport: mailTransport,
    googleUrl: process.env.GOOGLE_MAIL_URL,
    googleSecret: process.env.GOOGLE_MAIL_SECRET,
    resetUrl,
    outbox: path.resolve(__dirname, "../../data/mail"),
  },
  clientOrigins: (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  database: {
    dialect,
    url: databaseUrl,
    ssl,
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
