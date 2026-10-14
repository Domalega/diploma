const { port } = require("./config/env");
const sequelize = require("./config/database");
const app = require("./app");

async function start() {
  try {
    await sequelize.authenticate();
    // Preserve existing tables and columns; never use force or alter here.
    await sequelize.sync();
    const server = app.listen(port, () => console.log(`Server started on port ${port}`));
    server.on("error", async (error) => {
      console.error("Server failed to listen:", error.code);
      await sequelize.close();
      process.exitCode = 1;
    });
  } catch (error) {
    console.error("Server startup failed:", error.name);
    await sequelize.close();
    process.exitCode = 1;
  }
}

start();
