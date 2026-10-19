module.exports = (action) => async (req, res, next) => {
  try {
    res.json(await action(req, res));
  } catch (error) {
    next(error);
  }
};
