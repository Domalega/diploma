const User = require("./User");
const UserDate = require("./UserDate");

User.hasMany(UserDate);
UserDate.belongsTo(User);

module.exports = { User, UserDate };
