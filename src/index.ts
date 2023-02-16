/**
 * Importing npm packages.
 */
import next from 'next';
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';

/**
 * Importing user defined packages.
 */
import apis from '@server/apis';
import { Library } from '@server/lib';
import { Context, HTTPError } from '@server/utils';

/**
 * Importing and defining types.
 */
import type { ErrorRequestHandler } from 'express';

/**
 * Declaring the constants.
 */
const logger = global.getLogger('server');
const hostname = process.env.HOST_NAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '') || 8080;

const app = express();
const nextApp = next({ customServer: true, dev: global.isDevServer() });

/** Setting up the Parsers */
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/** Setting up the Context for the request */
app.use(Context.init());

/** Middleware to handle authentication */
app.use(async (req, _res, next) => {
  const url = req.path;
  if (url === '/api/status' || url === '/api/set-cookie') return next();

  const user = await Library.user.getUserFromCookie();
  const metadata = await Library.metadata.findByUID(user.uid);
  if (!metadata) {
    logger.error(`Metadata not found for user '${user.email}'`);
    throw new HTTPError(500, 'Unexpected Server Error');
  }

  logger.debug(`Current user: ${user.email}`);
  Context.setCurrentUser(user, metadata);
  return next();
});

/** Handling API routes */
app.use('/api', apis);

/** Setting up the next server */
const nextHandler = nextApp.getRequestHandler();
app.use((req, res) => nextHandler(req, res));

app.use(((err, _req, res, _next) => {
  const rid = Context.getRID();

  if (err instanceof HTTPError) {
    const statusCode = err.getStatusCode();
    return res.status(statusCode).json({ rid, err: err.message });
  }

  logger.debug(`Unexpected Error: ${err} for request ${rid}`, err);
  return res.status(500).json({ rid, err: 'Unexpected server error' });
}) as ErrorRequestHandler);

export async function init() {
  await nextApp.prepare();
  const server = app.listen(port, hostname, () => logger.info(`${process.env.NODE_ENV || 'development'} server started in port ${port}`));

  return async () => {
    server.close();
    logger.info('Express server stopped');
    await nextApp.close();
    logger.info('Next server stopped');
  };
}

export default { init };
