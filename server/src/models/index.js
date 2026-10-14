const User = require("./User");
const UserDate = require("./UserDate");
const AccountSecurity = require("./AccountSecurity");

User.hasMany(UserDate);
UserDate.belongsTo(User);
User.hasOne(AccountSecurity, { foreignKey: "userId", onDelete: "CASCADE" });
AccountSecurity.belongsTo(User, { foreignKey: "userId" });

module.exports = { User, UserDate, AccountSecurity };
