const { UserDate } = require("../models");
const ApiError = require("../errors/ApiError");

async function create(userId, date, comment) {
  const existing = await UserDate.findOne({ where: { userId, date } });
  if (existing) throw ApiError.conflict("A note for this date already exists");

  await UserDate.create({ userId, date, comment });
  return { message: "ok" };
}

function getAll(userId) {
  return UserDate.findAll({ where: { userId }, order: [["date", "ASC"]] });
}

async function remove(userId, date) {
  const deleted = await UserDate.destroy({ where: { userId, date } });
  if (!deleted) throw ApiError.notFound("Note was not found");
  return { message: "Note was deleted successfully" };
}

module.exports = { create, getAll, remove };
