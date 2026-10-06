import { Hono } from 'hono';
import type { AppEnv } from './types';
import { applySecurityHeaders, isHttps, randomToken } from './lib/security';
import { loadSettings } from './lib/settings';
import pub, { notFound } from './public';
import admin from './admin/routes';

const app = new Hono<AppEnv>();

// Security headers (with a per-request CSP nonce) on every response.
app.use('*', async (c, next) => {
  const nonce = randomToken(16);
  c.set('nonce', nonce);
  await next();
  try {
    applySecurityHeaders(c.res.headers, nonce, isHttps(c));
  } catch {
    c.res = new Response(c.res.body, c.res);
    applySecurityHeaders(c.res.headers, nonce, isHttps(c));
  }
});

// Site settings for everything except raw media files.
app.use('*', async (c, next) => {
  if (!c.req.path.startsWith('/media/')) c.set('s', await loadSettings(c.env.DB));
  await next();
});

app.route('/admin', admin);
app.route('/', pub);

app.notFound((c) => (c.get('s') ? notFound(c) : c.text('Not found', 404)));

app.onError((err, c) => {
  console.error('Unhandled error', c.req.method, c.req.path, err);
  return c.text('Sorry — something went wrong. Please try again in a moment.', 500);
});

export default app;
