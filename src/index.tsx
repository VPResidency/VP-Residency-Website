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
  if (c.req.path.startsWith('/media/')) return next();
  const s = await loadSettings(c.env.DB);
  c.set('s', s);
  // One canonical address: www.* and any older domain (e.g. vpresidency.in) permanently redirect to the
  // "Live website address" in Admin → SEO, so Google and old links all end up on one site.
  const url = new URL(c.req.url);
  const host = url.hostname;
  const devHost = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.workers.dev');
  let target = host.startsWith('www.') ? host.slice(4) : host;
  const canonical = /^https:\/\/[a-z0-9.-]+$/i.test(s.seo.siteUrl) ? new URL(s.seo.siteUrl).hostname : '';
  if (canonical && !devHost) target = canonical;
  if (target !== host) {
    url.hostname = target;
    if (canonical && !devHost) url.protocol = 'https:';
    return c.redirect(url.toString(), 301);
  }
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
