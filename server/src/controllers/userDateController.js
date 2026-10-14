const userDateService = require("../services/userDateService");

exports.create = async (req, res, next) => {
  try {
    const { date, comment } = req.body;
    res.json(await userDateService.create(req.user.id, date, comment));
  } catch (error) {
    next(error);
  }
};

exports.getAll = async (req, res, next) => {
  try {
    res.json(await userDateService.getAll(req.user.id));
  } catch (error) {
    next(error);
  }
};

exports.delete = async (req, res, next) => {
  try {
    res.json(await userDateService.remove(req.user.id, req.body.date));
  } catch (error) {
    next(error);
  }
};
