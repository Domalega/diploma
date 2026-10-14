const express = require("express");
const cors = require("cors");
const router = require("./routes");
const ApiError = require("./errors/ApiError");
const errorMiddleware = require("./middleware/errorMiddleware");

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "16kb" }));
app.use("/api", router);
app.use((req, res, next) => next(ApiError.notFound("Route was not found")));
app.use(errorMiddleware);

module.exports = app;
