const { UserDate } = require("../models/models");
const ApiError = require("../errors/ApiError");
const jwt = require("jsonwebtoken");

class CUserDateController {
  async create(req, res, next) {
    try {
      const { date, comment } = req.body;
      const token = req.headers.authorization;
      const tokenSplitted = token.split(" ")[1];
      const decode = jwt.verify(tokenSplitted, process.env.SECRET_KEY);
      const userId = decode.id;
      const dateWasCreated = await UserDate.findOne({ where: { date } });
      if (dateWasCreated)
        return res.json({ message: "date was already created" });

      const type = await UserDate.create({ date, comment, userId });
      return res.json({ message: "ok" });
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  async getAll(req, res, next) {
    try {
      const token = req.headers.authorization.split(" ")[1];
      const decode = jwt.verify(token, process.env.SECRET_KEY);
      const userId = decode.id;

      const all = await UserDate.findAll({ where: { userId } });
      return res.json(all);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  async delete(req, res, next) {
    try {
      const { date } = req.body;
      const token = req.headers.authorization;
      const tokenSplitted = token.split(" ")[1];
      const decode = jwt.verify(tokenSplitted, process.env.SECRET_KEY);
      const userId = decode.id;

      const deleted = await UserDate.destroy({ where: { date, userId } });
      if (deleted)
        return res.json({ message: "note was deleted successfully" });
      else return next(ApiError.badRequest("note was not found"));
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }
}

module.exports = new CUserDateController();
