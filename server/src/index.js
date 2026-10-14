const { port, host } = require("./config/env");
const sequelize = require("./config/database");
const app = require("./app");
const initializeDatabase = require("./config/initializeDatabase");

async function start() {
  try {
    await sequelize.authenticate();
    // Preserve existing tables and columns; never use force or alter here.
    await initializeDatabase(sequelize);
    const server = app.listen(port, host, () => console.log(`Server started on port ${port}`));
    server.on("error", async (error) => {
      console.error("Server failed to listen:", error.code);
      await sequelize.close();
      process.exitCode = 1;
    });
    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      server.close(async () => {
        try {
          await sequelize.close();
        } catch {
          process.exitCode = 1;
        }
      });
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  } catch (error) {
    console.error("Server startup failed:", error.name);
    await sequelize.close();
    process.exitCode = 1;
  }
}

start();
