/**
 * Importing npm packages.
 */
import winston from 'winston';
import { MongoClient } from 'mongodb';

/**
 * Importing and defining types.
 */
import type { Logger } from 'winston';
import type { Collection } from 'mongodb';

import type { IUserDoc } from '@server/lib/user';
import type { IExpenseDoc } from '@server/lib/expense';
import type { IMetadataDoc } from '@server/lib/metadata';

declare global {
  function getLogger(metadata: string | object): Logger;
  function getRID(): string | null;

  function isDevServer(): boolean;
  function isProdServer(): boolean;
  function isTestServer(): boolean;

  function getCollection(name: 'users'): Collection<IUserDoc>;
  function getCollection(name: 'expenses'): Collection<IExpenseDoc>;
  function getCollection(name: 'metadata'): Collection<IMetadataDoc>;
}

/**************************************** Gloabal Methods ****************************************/

const NODE_ENV = process.env.NODE_ENV || 'development';

global.getRID = () => null;
global.isDevServer = () => NODE_ENV === 'development';
global.isProdServer = () => NODE_ENV === 'production';
global.isTestServer = () => NODE_ENV === 'test';

/******************************************** Logger *********************************************/

const VALID_LOG_LEVELS = ['silly', 'debug', 'http', 'info', 'warn', 'error'];
const LOG_COLOR_FORMAT = { info: 'green', error: 'bold red', warn: 'italic yellow', debug: 'magenta', http: 'blue' };

const { Console, File } = winston.transports;
const { combine, printf, errors, timestamp, colorize, json } = winston.format;
const logLevel = VALID_LOG_LEVELS.includes(process.env.LOG_LEVEL || '') ? process.env.LOG_LEVEL : 'http';

const ridFormat = winston.format((info) => {
  const rid = global.getRID();
  if (rid) info.rid = rid;
  return info;
});
const jsonFormat = combine(errors({ stack: true }), json());
const consoleColor = colorize({ level: true, colors: LOG_COLOR_FORMAT });
const consoleFormat = printf(({ level, message, timestamp, service }) => `${timestamp} ${level}: [${service}] ${message}`);
const consoleLogFormat = combine(timestamp({ format: 'HH:mm:ss:SS' }), errors({ stack: true }), consoleColor, consoleFormat);
const fileLogFormat = combine(timestamp({ format: 'HH:mm:ss:SS' }), errors({ stack: true }), ridFormat(), json());
const logger = winston.createLogger({ level: logLevel, format: jsonFormat, defaultMeta: { service: 'startup' } });

if (global.isDevServer() || logLevel === 'debug') logger.add(new Console({ format: consoleLogFormat }));
logger.add(new File({ format: fileLogFormat, filename: `chronicle.log` }));

global.getLogger = (metadata) => (typeof metadata === 'string' ? logger.child({ service: metadata }) : logger.child({ ...metadata }));

(async function () {
  /******************************************* Database ********************************************/

  const DB_URI = process.env.DB_URI || 'mongodb://localhost/chronicle';
  const DB_COLLECTION_NAMES = ['users', 'expenses', 'metadata'] as const;

  const mongoClient = new MongoClient(DB_URI);
  const db = mongoClient.db();

  await mongoClient.connect();
  logger.info(`connected to database`);

  /** Creating the collections */
  const existingCollections = await db.collections();
  const existingCollectionNames = existingCollections.map((c) => c.collectionName);
  for (let index = 0; index < DB_COLLECTION_NAMES.length; index++) {
    const collectionName = DB_COLLECTION_NAMES[index]!;
    const collectionExists = existingCollectionNames.includes(collectionName);
    if (!collectionExists) await db.createCollection(collectionName);
    logger.info(`collection '${collectionName}' ${collectionExists ? 'already exists' : 'created'}`);
  }

  /** Storing the collection object */
  const collections = {
    users: db.collection('users'),
    expenses: db.collection('expenses'),
    metadata: db.collection('metadata'),
  };

  /** Creating indexes for each collection if not present */
  const usersIndexes = await collections.users.indexes();
  const usersIndexOpts = { unique: true, background: true, name: 'UNIQUE_EMAIL_INDEX' };
  const usersIndexExists = usersIndexes.find((index) => index.name === usersIndexOpts.name);
  if (!usersIndexExists) await collections.users.createIndex({ email: 1 }, usersIndexOpts);

  const expensesIndexes = await collections.expenses.indexes();
  const expensesIndexOpts = { unique: true, background: true, name: 'UNIQUE_UID_AND_EID_INDEX' };
  const expensesIndexExists = expensesIndexes.find((index) => index.name === expensesIndexOpts.name);
  if (!expensesIndexExists) await collections.expenses.createIndex({ uid: 1, _id: 1 }, expensesIndexOpts);

  const metadataIndexes = await collections.metadata.indexes();
  const metadataIndexOpts = { unique: true, background: true, name: 'UNIQUE_SERVICE_AND_UID_INDEX' };
  const metadataIndexExists = metadataIndexes.find((index) => index.name === metadataIndexOpts.name);
  if (!metadataIndexExists) await collections.metadata.createIndex({ service: 1, uid: 1 }, metadataIndexOpts);

  global.getCollection = (name) => (collections[name] || db.collection(name)) as any;

  /********************************************* Inits *********************************************/

  const { initLibrary } = await import('@server/lib');

  await initLibrary();

  /******************************************* Server ********************************************/

  const server = await import('@server/index');

  const stopServer = await server.init();

  function gracefullShutdown(signal?: NodeJS.Signals) {
    return async () => {
      await stopServer();
      await mongoClient.close().then(() => logger.info('disconnected from database'));
      process.kill(process.pid, signal);
    };
  }

  /** Handling Dev and Prod gracefull shutdown */
  process.once('SIGINT', gracefullShutdown('SIGINT'));
  process.once('SIGUSR2', gracefullShutdown('SIGUSR2'));
})();
