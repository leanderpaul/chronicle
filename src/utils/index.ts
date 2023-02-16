/**
 * Importing npm packages.
 */
import sagus from 'sagus';
import cookie from 'cookie';
import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Importing user defined packages.
 */
import { calculateTotal } from './helpers';
import { SECRET_KEY, AppError, AUTH, SERVICE_NAME, HTTPError } from './constants';

/**
 * Importing and defining types.
 */
import type { CookieSerializeOptions } from 'cookie';
import type { RequestHandler, Request, Response } from 'express';
import type { IUser, IUserSession, IMetadata } from '@server/lib';

const logger = global.getLogger('utils:index');

export { SECRET_KEY, AppError, calculateTotal, AUTH, SERVICE_NAME, HTTPError };

/****************************************** Validators *******************************************/

export const Validator = {
  isEmail(email: string) {
    return /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(email);
  },

  isName(name: string) {
    return /^[a-zA-Z\ ]{3,32}$/.test(name);
  },

  isPassword(password: string) {
    return /[a-zA-Z0-9@\-_$#&!]{8,32}/.test(password);
  },
};

/******************************************** Crypto *********************************************/

export const Crypto = {
  encrypt(iv: string | Buffer, secretKey: keyof typeof SECRET_KEY, input: string) {
    const biv = typeof iv === 'string' ? Buffer.from(iv, 'base64') : iv;
    const cipher = crypto.createCipheriv('aes-256-ctr', SECRET_KEY[secretKey], biv);
    const result = Buffer.concat([cipher.update(input), cipher.final()]);
    return result.toString('base64');
  },
  decrypt(iv: string | Buffer, secretKey: keyof typeof SECRET_KEY, encryptedinput: string) {
    const biv = typeof iv === 'string' ? Buffer.from(iv, 'base64') : iv;
    const decipher = crypto.createDecipheriv('aes-256-ctr', SECRET_KEY[secretKey], biv);
    const result = Buffer.concat([decipher.update(Buffer.from(encryptedinput, 'base64')), decipher.final()]);
    return result.toString();
  },
};

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

/********************************************* Utils *********************************************/

export const Utils = {
  encodeCookie(uid: string, sid: string) {
    return uid + '|' + sid;
  },

  decodeCookie(cookie: string) {
    const data = cookie.split('|');
    return { uid: data[0]!, sid: data[1]! };
  },
};
