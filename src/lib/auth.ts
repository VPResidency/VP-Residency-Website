import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppEnv, Session, User } from '../types';
import { clientIp, isHttps, randomToken, safeEqual, sha256 } from './security';

const IDLE_SECONDS = 3 * 86400;

export function cookieName(c: Context): string {
  // The __Host- prefix makes browsers refuse the cookie unless it is Secure, host-only and Path=/.
  return isHttps(c) ? '__Host-vp_admin' : 'vp_admin';
}

export async function createSession(c: Context<AppEnv>, userId: number, mfaPending: boolean): Promise<void> {
  const token = randomToken(32);
  const now = Math.floor(Date.now() / 1000);
  const days = c.get('s').security.sessionDays || 7;
  const ttl = mfaPending ? 600 : days * 86400;
  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, csrf, mfa_pending, expires_at, created_at, last_seen_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(await sha256(token), userId, randomToken(24), mfaPending ? 1 : 0, now + ttl, now, now, clientIp(c), (c.req.header('user-agent') || '').slice(0, 200))
    .run();
  setCookie(c, cookieName(c), token, { path: '/', httpOnly: true, secure: isHttps(c), sameSite: 'Lax', maxAge: ttl });
  // Housekeeping: drop expired sessions and stale rate-limit rows now and then.
  if (Math.random() < 0.2) {
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < ? OR last_seen_at < ?').bind(now, now - IDLE_SECONDS),
      c.env.DB.prepare('DELETE FROM rate_limits WHERE locked_until < ? AND window_start < ?').bind(now, now - 86400),
    ]);
  }
}

export async function readSession(c: Context<AppEnv>): Promise<{ session: Session; user: User } | null> {
  const token = getCookie(c, cookieName(c));
  if (!token || token.length > 100) return null;
  const id = await sha256(token);
  const row = await c.env.DB.prepare(
    `SELECT s.id, s.user_id, s.csrf, s.mfa_pending, s.expires_at, s.last_seen_at,
            u.email, u.name, u.role, u.totp_enabled
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
  )
    .bind(id)
    .first<Session & Omit<User, 'id'>>();
  const now = Math.floor(Date.now() / 1000);
  if (!row || row.expires_at < now || row.last_seen_at < now - IDLE_SECONDS) return null;
  if (now - row.last_seen_at > 300) {
    await c.env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').bind(now, id).run();
  }
  return {
    session: { id: row.id, user_id: row.user_id, csrf: row.csrf, mfa_pending: row.mfa_pending, expires_at: row.expires_at, last_seen_at: row.last_seen_at },
    user: { id: row.user_id, email: row.email, name: row.name, role: row.role, totp_enabled: row.totp_enabled },
  };
}

export async function destroySession(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, cookieName(c));
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run();
  deleteCookie(c, cookieName(c), { path: '/', secure: isHttps(c) });
}

/** Signed-in, fully verified admin required. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = await readSession(c);
  if (!auth || auth.session.mfa_pending) {
    if (c.req.method === 'GET' && !c.req.path.startsWith('/admin/api/')) {
      const nextPath = c.req.path + (new URL(c.req.url).search || '');
      return c.redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`);
    }
    return c.json({ error: 'Not signed in' }, 401);
  }
  c.set('session', auth.session);
  c.set('user', auth.user);
  await next();
};

/** Blocks cross-site form posts: same-origin check plus a per-session token. */
export const requireCsrf: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD') return next();
  const origin = c.req.header('origin');
  if (origin && origin !== new URL(c.req.url).origin) return c.text('Cross-site request blocked', 403);
  let token = c.req.header('x-csrf-token') || '';
  if (!token) {
    const type = c.req.header('content-type') || '';
    if (type.includes('form')) {
      const body = await c.req.parseBody();
      token = typeof body._csrf === 'string' ? body._csrf : '';
    }
  }
  const session = c.get('session');
  if (!session || !token || !safeEqual(token, session.csrf)) {
    return c.text('Your session form expired. Go back, refresh the page and try again.', 403);
  }
  await next();
};

export const ownerOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get('user')?.role !== 'owner') return c.text('Only the owner account can do this.', 403);
  await next();
};
