/**
 * Importing npm packages.
 */
import sagus from 'sagus';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Importing user defined packages.
 */

/**
 * Importing and defining types.
 */
import type { RequestHandler, Request, Response } from 'express';
import type { IUser, IUserSession, IMetadata } from '@server/lib';

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

/**************************************** Request Context ****************************************/

const asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();

export const Context = {
  init(): RequestHandler {
    return (req, res, next) => {
      asyncLocalStorage.run(new Map(), () => {
        const store = asyncLocalStorage.getStore()!;
        store.set('RID', sagus.genUUID());
        store.set('CURRENT_REQUEST', req);
        store.set('CURRENT_RESPONSE', res);
        return next();
      });
    };
  },

  getRID(): string {
    return asyncLocalStorage.getStore()!.get('RID');
  },

  getCurrentRequest(): Request {
    return asyncLocalStorage.getStore()!.get('CURRENT_REQUEST');
  },

  getCurrentResponse(): Response {
    return asyncLocalStorage.getStore()!.get('CURRENT_RESPONSE');
  },

  getCurrentUser(): IUser & { metadata: IMetadata } {
    return asyncLocalStorage.getStore()!.get('CURRENT_USER');
  },

  setCurrentUser(user: IUser, metadata: IMetadata) {
    const obj = { ...user, metadata };
    asyncLocalStorage.getStore()!.set('CURRENT_USER', obj);
  },

  getCurrentSession(): IUserSession {
    return asyncLocalStorage.getStore()!.get('CURRENT_USER_SESSION');
  },

  setCurrentSession(session: IUserSession) {
    asyncLocalStorage.getStore()!.set('CURRENT_USER_SESSION', session);
  },
};

global.getRID = () => asyncLocalStorage.getStore()?.get('RID') ?? null;
