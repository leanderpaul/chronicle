/**
 * Importing npm packages.
 */
import sagus from 'sagus';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';

/**
 * Importing user defined packages.
 */
import { Validator, Crypto, Context, AppError, SERVICE_NAME, AUTH, HTTPError, Utils } from '@server/utils';

/**
 * Importing and defining types.
 */
export interface IUserSession {
  /** User session id. This is the value stored in the user's cookie */
  id: string;
  /** The date the session was created on */
  createdOn: Date;
}

export interface IUserBase {
  /** User ID */
  uid: string;
  /** User's email address */
  email: string;
  /** User's name */
  name: string;
  /** Denotes whether a user email address is verified or not */
  verified: boolean;
  /** Array storing the session details of the user */
  sessions: IUserSession[];
  /** URL containing the user's profile pic */
  imageUrl?: string;
}

export interface INativeUser extends IUserBase {
  /** User's password */
  password: string;
}

export interface IOAuthUser extends IUserBase {
  /** Service provider user id */
  spuid: string;
  /** Service Provider refresh token */
  refreshToken: string;
}

export type IUser = INativeUser | IOAuthUser;

type INativeUserDoc = { _id: ObjectId } & Omit<INativeUser, 'uid'>;

type IOAuthUserDoc = { _id: ObjectId } & Omit<IOAuthUser, 'uid'>;

type INativeUserInput = Pick<INativeUser, 'email' | 'name' | 'password'>;

type IOAuthUserInput = Pick<IOAuthUser, 'email' | 'name' | 'spuid' | 'refreshToken' | 'verified'>;

export type IUserDoc = Omit<INativeUser, 'uid'> | Omit<IOAuthUser, 'uid'>;

/**
 * Declaring the constants.
 */
const logger = global.getLogger('models:user');
const usersCollection = global.getCollection('users');
const metadataCollection = global.getCollection('metadata');

/**
 * Contains methods to manipulate user data
 */
export class User {
  generateCSRFToken(sessionID: string) {
    const iv = crypto.randomBytes(16);
    const encryptedSession = Crypto.encrypt(iv, 'CSRF', sessionID);
    return iv.toString('base64') + '|' + encryptedSession;
  }

  async verifyCSRFToken(token: string, sessionID: string) {
    const [iv, encryptedSessionId] = token.split('|');
    if (!iv || !encryptedSessionId) return false;
    const biv = Buffer.from(iv, 'base64');
    if (biv.length != 16) return false;
    const result = Crypto.decrypt(biv, 'CSRF', encryptedSessionId);
    return result === sessionID;
  }

  async register(input: INativeUserInput): Promise<IUser>;
  async register(input: IOAuthUserInput): Promise<IUser>;
  async register(input: INativeUserInput | IOAuthUserInput): Promise<IUser> {
    let user: any;
    if ('password' in input) {
      const email = input.email.toLowerCase().trim();
      const name = input.name.trim();
      if (!Validator.isEmail(email)) throw new AppError('VALIDATION_ERROR', "User's email address is invalid");
      if (!Validator.isName(name)) throw new AppError('VALIDATION_ERROR', "User's name is invalid");
      if (!Validator.isPassword(input.password)) throw new AppError('VALIDATION_ERROR', "User's password is invalid");
      const password = await sagus.hash(input.password, 10);
      user = { email, name, password, verified: false };
    } else {
      const { email, name, spuid, verified } = input;
      const iv = spuid.substring(0, 16);
      const refreshToken = Crypto.encrypt(iv, 'REFRESH_TOKEN', input.refreshToken);
      user = { email, name, spuid, verified, refreshToken };
    }

    const session = { id: crypto.randomBytes(32).toString('base64'), createdOn: new Date() };
    const result = await usersCollection.insertOne({ ...user, sessions: [session] });
    await metadataCollection.insertOne({ uid: result.insertedId, service: SERVICE_NAME, billCount: 0, groups: [], pms: [] });
    logger.info(`User '${user.email}' registered a ${user.password ? 'Native' : 'OAuth'} account`);
    Context.setCurrentSession(session);
    return { uid: result.insertedId.toString(), ...user };
  }

  async login(input: Pick<INativeUser, 'email' | 'password'>): Promise<IUser> {
    const email = input.email.toLowerCase().trim();
    const user = await usersCollection.findOne<INativeUserDoc>({ email, password: { $exists: true } });
    if (!user) throw new Error('User account does not exist');
    const validPassword = await sagus.compareHash(input.password, user.password);
    if (!validPassword) throw new Error('Password does not match');

    const session = { id: crypto.randomBytes(32).toString('base64'), createdOn: new Date() };
    await usersCollection.updateOne({ email }, { $push: { sessions: session } });
    Context.setCurrentSession(session);
    const obj = sagus.removeKeys(user, ['_id']);
    return { uid: user._id.toString(), ...obj, sessions: [...obj.sessions, session] };
  }

  async getUserFromCookie() {
    const req = Context.getCurrentRequest();
    const cookie = req.cookies[AUTH.COOKIE_NAME] as string | undefined;
    if (!cookie) throw new HTTPError(401, 'Unauthorized');
    const { sid, uid } = Utils.decodeCookie(cookie);

    const user = await usersCollection.findOne({ _id: new ObjectId(uid) });
    if (!user) throw new HTTPError(401, 'Unauthorized');
    const session = user.sessions.find((s) => s.id === sid);
    if (!session) throw new HTTPError(401, 'Unauthorized');
    Context.setCurrentSession(session);

    const obj = sagus.removeKeys(user, ['_id']);
    return { uid: uid.toString(), ...obj } as IUser;
  }

  async findByEmail(email: string) {
    const user = await usersCollection.findOne({ email });
    if (!user) return null;
    const uid = user._id.toString();
    const obj = sagus.removeKeys(user, ['_id']);
    return { uid, ...obj } as IUser;
  }

  async findByID(uid: string | ObjectId) {
    if (typeof uid === 'string') uid = new ObjectId(uid);
    const user = await usersCollection.findOne({ _id: uid });
    if (!user) return null;
    const obj = sagus.removeKeys(user, ['_id']);
    return { uid: uid.toString(), ...obj } as IUser;
  }

  async updatePassword(password: string) {
    const { email } = Context.getCurrentUser();
    if (!Validator.isPassword(password)) throw new AppError('VALIDATION_ERROR', "User's password is invalid");
    const hashedPassword = sagus.hash(password, 10);
    const result = await usersCollection.updateOne({ email }, { $set: { password: hashedPassword } });
    if (result.modifiedCount === 0) logger.warn(`user '${email}' password updation failed`);
  }

  async removeSession(sessionId: string) {
    const { email } = Context.getCurrentUser();
    const update = sessionId === '*' ? { $set: { sessions: [] } } : { $pull: { sessions: { id: sessionId } } };
    const result = await usersCollection.updateOne({ email }, update);
    if (result.modifiedCount === 0) logger.warn(`user '${email}' session updation failed for all session - ${sessionId === '*'}`);
  }
}
