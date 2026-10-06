import type { Context } from 'hono';

const enc = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomToken(byteLength = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// ---------------------------------------------------------------------------------------------
// Passwords: PBKDF2-SHA256. Workers caps PBKDF2 at 100 000 iterations.
// ---------------------------------------------------------------------------------------------
const PBKDF2_ITERATIONS = 100_000;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

// Used when the e-mail is unknown, so a failed login takes the same time either way.
const DUMMY_HASH = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, iter, saltB64, hashB64] = (stored || DUMMY_HASH).split('$');
  if (scheme !== 'pbkdf2') return false;
  const hash = await pbkdf2(password, fromB64url(saltB64), Number(iter));
  return safeEqual(b64url(hash), hashB64) && !!stored;
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return 'Password must be at least 10 characters.';
  if (pw.length > 200) return 'Password is too long.';
  if (/^(.)\1+$/.test(pw)) return 'Password is too simple.';
  const common = ['password12', '1234567890', 'qwertyuiop', 'vpresidency', 'admin12345'];
  if (common.some((c) => pw.toLowerCase().includes(c))) return 'Password is too easy to guess.';
  return null;
}

// ---------------------------------------------------------------------------------------------
// TOTP (RFC 6238) for optional two-factor login, compatible with Google Authenticator etc.
// ---------------------------------------------------------------------------------------------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function newTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const ch of clean) {
    const v = B32.indexOf(ch);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const out = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}

async function totpAt(secret: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const offset = mac[mac.length - 1] & 0x0f;
  const code =
    (((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3]) % 1_000_000;
  return code.toString().padStart(6, '0');
}

export async function verifyTotp(secret: string, code: string): Promise<boolean> {
  const clean = (code || '').replace(/\D/g, '');
  if (clean.length !== 6) return false;
  const counter = Math.floor(Date.now() / 30000);
  for (const drift of [-1, 0, 1]) {
    if (safeEqual(await totpAt(secret, counter + drift), clean)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------------------------
export function clientIp(c: Context): string {
  return c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'local';
}

export function isHttps(c: Context): boolean {
  return new URL(c.req.url).protocol === 'https:';
}

/**
 * Fixed-window rate limiter stored in D1. Returns false once `limit` hits happen inside `windowSec`;
 * the key then stays locked for `lockSec`.
 */
export async function rateHit(db: D1Database, key: string, limit: number, windowSec: number, lockSec = windowSec): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare('SELECT count, window_start, locked_until FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<{ count: number; window_start: number; locked_until: number }>();
  if (row && row.locked_until > now) return false;
  if (!row || now - row.window_start >= windowSec) {
    await db
      .prepare(
        'INSERT INTO rate_limits (key, count, window_start, locked_until) VALUES (?, 1, ?, 0) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start, locked_until = 0',
      )
      .bind(key, now)
      .run();
    return true;
  }
  const count = row.count + 1;
  const lockedUntil = count >= limit ? now + lockSec : 0;
  await db.prepare('UPDATE rate_limits SET count = ?, locked_until = ? WHERE key = ?').bind(count, lockedUntil, key).run();
  return count <= limit;
}

export async function isLocked(db: D1Database, key: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare('SELECT locked_until FROM rate_limits WHERE key = ?').bind(key).first<{ locked_until: number }>();
  return row && row.locked_until > now ? row.locked_until - now : 0;
}

export async function clearRate(db: D1Database, key: string): Promise<void> {
  await db.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run();
}

export async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------------------------
export function contentSecurityPolicy(nonce: string, https: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://challenges.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com",
    "frame-src 'self' https://www.google.com https://maps.google.com https://challenges.cloudflare.com https://www.youtube-nocookie.com",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "manifest-src 'self'",
  ];
  if (https) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export function applySecurityHeaders(headers: Headers, nonce: string, https: boolean): void {
  // Routes like /media set a stricter sandbox policy of their own — keep it.
  if (!headers.has('Content-Security-Policy')) headers.set('Content-Security-Policy', contentSecurityPolicy(nonce, https));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (https) headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}
