class CApiError {
  constructor(status, message) {
    this.status = status;
    this.message = message;
  }

  static badRequest(message) {
    return new CApiError(404, message);
  }

  static internal(message) {
    return new CApiError(500, message);
  }

  static forbidden(message) {
    // no access
    return new CApiError(403, message);
  }

  static unauthorized(message) {
    return new CApiError(401, message);
  }
}

export default CApiError;
