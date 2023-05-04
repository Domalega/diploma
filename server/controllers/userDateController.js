const { UserDate } = require("../models/models");
const ApiError = require("../errors/ApiError");
const { json } = require("sequelize");
const jwt = require("jsonwebtoken");

class CUserDateController {
  async create(req, res, next) {
    try {
      const { date, comment } = req.body;
      const token = req.headers.authorization;
      console.log(date, comment, token);
      const tokenSplitted = token.split(" ")[1];
      const decode = jwt.verify(tokenSplitted, process.env.SECRET_KEY);
      const userId = decode.id;

      const type = await UserDate.create({ date, comment, userId });
      return res.json({ created: "ok" });
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  async getAll(req, res, next) {
    try {
      const token = req.headers.authorization.split(" ")[1];
      const decode = jwt.verify(token, process.env.SECRET_KEY);
      const id = decode.id;

      const all = await UserDate.findAll({ where: { id } });
      return res.json(all);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  async delete(req, res, next) {
    try {
      const { date, token } = req.body;
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
