const { randomUUID } = require("node:crypto");
const database = require("../config/database");
const { TodoList } = require("../models");
const ApiError = require("../errors/ApiError");

const defaults = { enabled: false, revision: 0, tasks: [] };
const fail = () => {
  throw ApiError.badRequest("Enter a valid to-do update");
};
function title(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 500 || /[\r\n]/.test(value))
    throw ApiError.badRequest("Use one line of up to 500 characters per task");
  return value.trim();
}
async function getList(userId) {
  const list = await TodoList.findByPk(userId);
  return list ? list.toJSON() : { ...defaults, userId };
}
async function changeList(userId, command) {
  if (
    !command ||
    Array.isArray(command) ||
    !Number.isSafeInteger(command.revision) ||
    command.revision < 0
  )
    fail();
  await TodoList.findOrCreate({ where: { userId }, defaults });
  return database.transaction(async (transaction) => {
    const list = await TodoList.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (list.revision !== command.revision)
      throw ApiError.conflict("The to-do list changed. Reload it before saving.");
    const tasks = structuredClone(list.tasks);
    let enabled = list.enabled;
    if (command.type === "enabled") {
      if (typeof command.enabled !== "boolean") fail();
      enabled = command.enabled;
    } else {
      if (!enabled) throw ApiError.conflict("Enable the to-do list first");
      if (command.type === "add") {
        if (!Array.isArray(command.titles) || !command.titles.length || command.titles.length > 100)
          fail();
        if (tasks.length + command.titles.length > 1000)
          throw ApiError.badRequest("Use up to 1000 to-do tasks");
        tasks.push(
          ...command.titles.map((value) => ({
            id: randomUUID(),
            title: title(value),
            completed: false,
          })),
        );
      } else if (["edit", "complete", "remove"].includes(command.type)) {
        const index = tasks.findIndex((task) => task.id === command.id);
        if (index < 0) throw ApiError.notFound("Task was not found");
        if (command.type === "edit") tasks[index].title = title(command.title);
        if (command.type === "complete") {
          if (typeof command.completed !== "boolean") fail();
          tasks[index].completed = command.completed;
        }
        if (command.type === "remove") tasks.splice(index, 1);
      } else fail();
    }
    const [updated] = await TodoList.update(
      { enabled, tasks, revision: list.revision + 1 },
      { where: { userId, revision: command.revision }, transaction },
    );
    if (!updated) throw ApiError.conflict("The to-do list changed. Reload it before saving.");
    return (await TodoList.findByPk(userId, { transaction })).toJSON();
  });
}
module.exports = { getList, changeList };
