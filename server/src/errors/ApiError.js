class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  static badRequest(message) {
    return new ApiError(400, message);
  }
  static notFound(message) {
    return new ApiError(404, message);
  }
  static conflict(message) {
    return new ApiError(409, message);
  }
  static unauthorized(message = "Unauthorized user") {
    return new ApiError(401, message);
  }
}

module.exports = ApiError;
