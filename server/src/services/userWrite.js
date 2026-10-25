const database = require("../config/database");
const ApiError = require("../errors/ApiError");

let sqliteTail = Promise.resolve();
// All calendar writes, including older web APIs, share the account lock with sync.
function userWrite(userId, action, { encrypted = false } = {}) {
  const run = () =>
    database.transaction(async (transaction) => {
      const { User } = require("../models");
      const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!user) throw ApiError.unauthorized();
      if (!encrypted && (await require("./activeVault")(userId, transaction)))
        throw ApiError.conflict("Unlock your encrypted data in an updated Daymark client.");
      return action(transaction);
    });
  if (database.getDialect() !== "sqlite") return run();
  const result = sqliteTail.then(run);
  sqliteTail = result.catch(() => {});
  return result;
}
module.exports = userWrite;
