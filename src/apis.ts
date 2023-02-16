/**
 * Importing npm packages.
 */
import sagus from 'sagus';
import { Router } from 'express';

/**
 * Importing user defined packages.
 */
import { Library } from '@server/lib';
import { HTTPError, Context, Utils, AUTH } from '@server/utils';

/**
 * Importing and defining types.
 */

/**
 * Declaring the constants.
 */
const router = Router();
const logger = global.getLogger('apis');
const USER = { email: 'test-user@mail.com', name: 'Test User', password: 'Password@123' };

router.get('/status', (_req, res) => res.json({ msg: 'Server Working' }));

router.get('/set-cookie', async (req, res) => {
  if (global.isProdServer()) throw new HTTPError(404, 'Page not Found');

  const u = Context.getCurrentUser();
  if (u) {
    const session = Context.getCurrentSession();
    const csrfToken = Library.user.generateCSRFToken(session.id);
    return 'password' in u
      ? res.json({ csrfToken, user: sagus.removeKeys(u, ['password']) })
      : res.json({ csrfToken, user: sagus.removeKeys(u, ['refreshToken', 'spuid']) });
  }

  let user = await Library.user.findByEmail(USER.email);
  user = await (user ? Library.user.login(USER) : Library.user.register(USER));
  const session = Context.getCurrentSession();
  const csrfToken = Library.user.generateCSRFToken(session.id);
  const cookie = Utils.encodeCookie(user.uid, session.id);
  res.cookie(AUTH.COOKIE_NAME, cookie, { maxAge: AUTH.COOKIE_MAX_AGE, secure: global.isProdServer() });
  return res.json({ csrfToken, user: USER });
});

export default router;
