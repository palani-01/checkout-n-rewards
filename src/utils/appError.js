// @ts-check
export class AppError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class BadRequestError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Bad request') {
    super(message, 400);
  }
}

export class ConflictError extends AppError {
  /** @param {string} [message] */
  constructor(message = 'Conflict occurred') {
    super(message, 409);
  }
}