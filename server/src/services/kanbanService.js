const { randomUUID } = require("node:crypto");
const userWrite = require("./userWrite");
const { KanbanBoard, KanbanTask, KanbanEvent } = require("../models");
const ApiError = require("../errors/ApiError");

const defaults = (userId) => ({
  userId,
  enabled: false,
  revision: 0,
  columns: [
    { id: "todo", name: "", kind: "todo", hidden: false, wipLimit: null },
    { id: "doing", name: "", kind: "doing", hidden: false, wipLimit: 3 },
    { id: "done", name: "", kind: "done", hidden: false, wipLimit: null },
  ],
});
const fail = (message) => {
  throw ApiError.badRequest(message);
};
const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function text(value, max, required = false) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim()))
    fail("Enter a valid title or description");
  return value.trim();
}
function taskDate(value) {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    fail("Enter a valid task date");
  return value;
}
async function getBoard(userId, transaction) {
  const board = await KanbanBoard.findByPk(userId, { transaction });
  const tasks = await KanbanTask.findAll({
    where: { userId },
    order: [
      ["position", "ASC"],
      ["createdAt", "ASC"],
      ["id", "ASC"],
    ],
    transaction,
  });
  return {
    ...(board ? board.toJSON() : defaults(userId)),
    tasks: tasks.map((task) => task.toJSON()),
  };
}
async function ownTask(userId, id, transaction) {
  if (!uuid(id)) fail("Choose a valid task");
  const task = await KanbanTask.findOne({ where: { userId, id }, transaction });
  if (!task) throw ApiError.notFound("Task was not found");
  return task;
}
async function getHistory(userId, id) {
  await ownTask(userId, id);
  return KanbanEvent.findAll({ where: { userId, taskId: id }, order: [["id", "DESC"]] });
}
async function capacity(userId, column, transaction, exceptId) {
  if (column.kind !== "doing" || column.wipLimit === null) return;
  const tasks = await KanbanTask.findAll({
    where: { userId, columnId: column.id, completedAt: null },
    transaction,
  });
  if (tasks.filter((task) => task.id !== exceptId).length >= column.wipLimit)
    throw ApiError.conflict("This column has reached its work-in-progress limit");
}
async function event(task, kind, details, transaction) {
  await KanbanEvent.create(
    { userId: task.userId, taskId: task.id, kind, details },
    { transaction },
  );
}
async function moveTask(userId, task, column, beforeId, transaction) {
  await capacity(userId, column, transaction, task.id);
  const previous = task.columnId;
  const target = await KanbanTask.findAll({
    where: { userId, columnId: column.id },
    order: [
      ["position", "ASC"],
      ["createdAt", "ASC"],
      ["id", "ASC"],
    ],
    transaction,
  });
  const ordered = target.filter((item) => item.id !== task.id);
  let index = ordered.length;
  if (beforeId !== null && beforeId !== undefined) {
    if (!uuid(beforeId)) fail("Choose a valid task position");
    index = ordered.findIndex((item) => item.id === beforeId);
    if (index < 0) fail("Choose a valid task position");
  }
  const complete = column.kind === "done";
  const kind =
    complete && !task.completedAt
      ? "completed"
      : !complete && task.completedAt
        ? "reopened"
        : "moved";
  await task.update(
    {
      columnId: column.id,
      startedAt: task.startedAt || (column.kind !== "todo" ? new Date() : null),
      completedAt: complete ? task.completedAt || new Date() : null,
    },
    { transaction },
  );
  ordered.splice(index, 0, task);
  for (const [position, item] of ordered.entries())
    if (item.position !== position) await item.update({ position }, { transaction });
  await event(task, kind, { from: previous, to: column.id, title: task.title }, transaction);
}
async function changeBoard(userId, command) {
  if (
    !command ||
    Array.isArray(command) ||
    !Number.isInteger(command.revision) ||
    command.revision < 0 ||
    typeof command.type !== "string"
  )
    fail("Enter a valid board update");
  return userWrite(userId, async (transaction) => {
    await KanbanBoard.findOrCreate({ where: { userId }, defaults: defaults(userId), transaction });
    const board = await KanbanBoard.findByPk(userId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (board.revision !== command.revision)
      throw ApiError.conflict("The board changed. Reload it before saving.");
    const [updated] = await KanbanBoard.update(
      { revision: board.revision + 1 },
      { where: { userId, revision: command.revision }, transaction },
    );
    if (!updated) throw ApiError.conflict("The board changed. Reload it before saving.");
    const columns = structuredClone(board.columns);
    const column = (id) => {
      const value = columns.find((item) => item.id === id);
      if (!value) fail("Column was not found");
      return value;
    };
    if (command.type === "enabled") {
      if (typeof command.enabled !== "boolean") fail("Enter a valid board update");
      await board.update({ enabled: command.enabled }, { transaction });
    } else {
      if (!board.enabled) throw ApiError.conflict("Enable the Kanban board first");
      switch (command.type) {
        case "column.create": {
          if (columns.length >= 30) fail("Use up to 30 columns");
          const item = {
            id: randomUUID(),
            name: text(command.name, 60, true),
            kind: "doing",
            hidden: false,
            wipLimit: null,
          };
          columns.splice(
            columns.findIndex((item) => item.id === "done"),
            0,
            item,
          );
          await board.update({ columns }, { transaction });
          break;
        }
        case "column.update": {
          const item = column(command.columnId);
          if (command.name !== undefined)
            item.name = text(command.name, 60, !["todo", "doing", "done"].includes(item.id));
          if (command.hidden !== undefined) {
            if (typeof command.hidden !== "boolean") fail("Enter valid column settings");
            item.hidden = command.hidden;
          }
          if (command.wipLimit !== undefined) {
            if (
              command.wipLimit !== null &&
              (!Number.isInteger(command.wipLimit) || command.wipLimit < 1 || command.wipLimit > 99)
            )
              fail("Use a work-in-progress limit between 1 and 99");
            if (item.kind !== "doing" && command.wipLimit !== null)
              fail("Only work-in-progress columns have a limit");
            const count = await KanbanTask.count({
              where: { userId, columnId: item.id, completedAt: null },
              transaction,
            });
            if (command.wipLimit !== null && count > command.wipLimit)
              throw ApiError.conflict("The limit cannot be lower than the current task count");
            item.wipLimit = command.wipLimit;
          }
          await board.update({ columns }, { transaction });
          break;
        }
        case "column.move": {
          const item = column(command.columnId);
          if (
            !Number.isInteger(command.index) ||
            command.index < 0 ||
            command.index >= columns.length
          )
            fail("Choose a valid column position");
          columns.splice(columns.indexOf(item), 1);
          columns.splice(command.index, 0, item);
          await board.update({ columns }, { transaction });
          break;
        }
        case "task.create": {
          const target = column(command.columnId);
          await capacity(userId, target, transaction);
          const count = await KanbanTask.max("position", {
            where: { userId, columnId: target.id },
            transaction,
          });
          const task = await KanbanTask.create(
            {
              userId,
              columnId: target.id,
              title: text(command.title, 140, true),
              description: text(command.description ?? "", 4000),
              date: taskDate(command.date ?? null),
              position: (Number.isFinite(count) ? count : -1) + 1,
              startedAt: target.kind !== "todo" ? new Date() : null,
              completedAt: target.kind === "done" ? new Date() : null,
            },
            { transaction },
          );
          await event(task, "created", { to: target.id, title: task.title }, transaction);
          break;
        }
        case "task.update": {
          const task = await ownTask(userId, command.taskId, transaction);
          await task.update(
            {
              title: text(command.title, 140, true),
              description: text(command.description ?? "", 4000),
              date: taskDate(command.date ?? null),
            },
            { transaction },
          );
          await event(task, "edited", { title: task.title, date: task.date }, transaction);
          break;
        }
        case "task.move":
        case "task.complete":
        case "task.reopen": {
          const task = await ownTask(userId, command.taskId, transaction);
          const target = column(
            command.type === "task.complete"
              ? "done"
              : command.type === "task.reopen"
                ? "todo"
                : command.columnId,
          );
          await moveTask(userId, task, target, command.beforeId, transaction);
          break;
        }
        default:
          fail("Unknown board update");
      }
    }
    return getBoard(userId, transaction);
  });
}
module.exports = { defaults, getBoard, getHistory, changeBoard };
