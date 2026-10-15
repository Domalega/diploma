const User = require("./User");
const UserDate = require("./UserDate");
const AccountSecurity = require("./AccountSecurity");
const MedicationPlan = require("./MedicationPlan");
const MedicationIntake = require("./MedicationIntake");
const KanbanBoard = require("./KanbanBoard");
const KanbanTask = require("./KanbanTask");
const KanbanEvent = require("./KanbanEvent");

User.hasMany(UserDate);
UserDate.belongsTo(User);
User.hasOne(AccountSecurity, { foreignKey: "userId", onDelete: "CASCADE" });
AccountSecurity.belongsTo(User, { foreignKey: "userId" });

User.hasOne(MedicationPlan, { foreignKey: "userId", onDelete: "CASCADE" });
MedicationPlan.belongsTo(User, { foreignKey: "userId" });
User.hasMany(MedicationIntake, { foreignKey: "userId", onDelete: "CASCADE" });
MedicationIntake.belongsTo(User, { foreignKey: "userId" });

User.hasOne(KanbanBoard, { foreignKey: "userId", onDelete: "CASCADE" });
KanbanBoard.belongsTo(User, { foreignKey: "userId" });
for (const model of [KanbanTask, KanbanEvent]) {
  User.hasMany(model, { foreignKey: "userId", onDelete: "CASCADE" });
  model.belongsTo(User, { foreignKey: "userId" });
}
KanbanTask.hasMany(KanbanEvent, { foreignKey: "taskId", onDelete: "CASCADE" });
KanbanEvent.belongsTo(KanbanTask, { foreignKey: "taskId" });
module.exports = {
  User,
  UserDate,
  AccountSecurity,
  MedicationPlan,
  MedicationIntake,
  KanbanBoard,
  KanbanTask,
  KanbanEvent,
};
