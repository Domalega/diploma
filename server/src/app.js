const express = require("express");
const cors = require("cors");
const router = require("./routes");
const ApiError = require("./errors/ApiError");
const errorMiddleware = require("./middleware/errorMiddleware");
const { clientOrigins } = require("./config/env");

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: clientOrigins.length ? clientOrigins : true }));
app.use(express.json({ limit: "16kb" }));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api", router);
app.use((req, res, next) => next(ApiError.notFound("Route was not found")));
app.use(errorMiddleware);

module.exports = app;
