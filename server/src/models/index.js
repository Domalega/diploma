const User = require("./User");
const UserDate = require("./UserDate");
const AccountSecurity = require("./AccountSecurity");
const MedicationPlan = require("./MedicationPlan");
const MedicationIntake = require("./MedicationIntake");

User.hasMany(UserDate);
UserDate.belongsTo(User);
User.hasOne(AccountSecurity, { foreignKey: "userId", onDelete: "CASCADE" });
AccountSecurity.belongsTo(User, { foreignKey: "userId" });

User.hasOne(MedicationPlan, { foreignKey: "userId", onDelete: "CASCADE" });
MedicationPlan.belongsTo(User, { foreignKey: "userId" });
User.hasMany(MedicationIntake, { foreignKey: "userId", onDelete: "CASCADE" });
MedicationIntake.belongsTo(User, { foreignKey: "userId" });

module.exports = { User, UserDate, AccountSecurity, MedicationPlan, MedicationIntake };
