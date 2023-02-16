/**
 * Importing npm packages.
 */

/**
 * Importing user defined packages.
 */

/**
 * Importing and defining types.
 */

/**
 * Declaring the constants.
 */
const csrfSecretKey = process.env.CSRF_SECRET_KEY || 'wiJVTyl+XrTOm5SBbZxs0o8QdSLljAFRV7F01D9bFKA=';

const refreshTokenSecretKey = process.env.REFRESH_TOKEN_SECRET_KEY || 'IPYNiQFG8Q4URcbSyjwXDgWG6pnjDuLhDpGV9ybKgU0=';

export const SERVICE_NAME = 'chronicle';

export const SECRET_KEY = {
  CSRF: Buffer.from(csrfSecretKey, 'base64'),
  REFRESH_TOKEN: Buffer.from(refreshTokenSecretKey, 'base64'),
};

export const AUTH = {
  COOKIE_MAX_AGE: 30 * 24 * 60 * 60,
  COOKIE_NAME: 'SASID',
};

/**
 * @class App Errors
 */
export class AppError extends Error {
  constructor(name: 'VALIDATION_ERROR', msg: string) {
    super(msg);
    this.name = 'AppError';
  }
}

export class HTTPError extends Error {
  private statusCode: number;

  constructor(statusCode: number, msg: string) {
    super(msg);
    this.statusCode = statusCode;
    this.name = 'HTTPError';
  }

  getStatusCode() {
    return this.statusCode;
  }
}
