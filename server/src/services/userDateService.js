const { UserDate } = require("../models");
const ApiError = require("../errors/ApiError");
const userWrite = require("./userWrite");

async function create(userId, date, comment, time = null) {
  return userWrite(userId, async (transaction) => {
    const note = await UserDate.create({ userId, date, comment, time }, { transaction });
    return { message: "ok", note };
  });
}

function getAll(userId) {
  return UserDate.findAll({
    where: { userId },
    order: [
      ["date", "ASC"],
      ["id", "ASC"],
    ],
  });
}

async function noteWhere(userId, id, date, transaction) {
  if (id !== undefined) return { userId, id };
  // Older clients address notes by date. Never let that update or delete an entire day.
  const notes = await UserDate.findAll({
    where: { userId, date },
    attributes: ["id"],
    limit: 2,
    transaction,
  });
  if (!notes.length) throw ApiError.notFound("Note was not found");
  if (notes.length > 1)
    throw ApiError.conflict("Select an individual note. Reload the calendar to update the app.");
  return { userId, id: notes[0].id };
}

async function update(userId, { id, date, comment, time }) {
  return userWrite(userId, async (transaction) => {
    const where = await noteWhere(userId, id, date, transaction);
    const changes = { comment };
    if (date !== undefined) changes.date = date;
    if (time !== undefined) changes.time = time;
    const [count] = await UserDate.update(changes, { where, transaction });
    if (!count) throw ApiError.notFound("Note was not found");
    return { message: "Note was updated successfully" };
  });
}

async function remove(userId, { id, date }) {
  return userWrite(userId, async (transaction) => {
    const where = await noteWhere(userId, id, date, transaction);
    const deleted = await UserDate.destroy({ where, transaction });
    if (!deleted) throw ApiError.notFound("Note was not found");
    return { message: "Note was deleted successfully" };
  });
}

module.exports = { create, getAll, update, remove };
