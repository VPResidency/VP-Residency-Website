import { Hono, type Context } from 'hono';
import { renderSVG } from 'uqr';
import { raw } from 'hono/html';
import type { AppEnv, PageRow, PostRow, RoomRow, User } from '../types';
import { createSession, destroySession, ownerOnly, readSession, requireAuth, requireCsrf } from '../lib/auth';
import { DEFAULTS, SETTINGS_KEYS, THEME_PRESETS, type SettingsKey } from '../lib/defaults';
import { FONTS, SYSTEM_FONT } from '../lib/fonts';
import { ICONS } from '../lib/icons-data';
import { Icon } from '../lib/icons';
import { BUILTIN_IMAGES } from '../lib/builtin-images';
import { renderMarkdown } from '../lib/markdown';
import { activeFestival, upcomingFestivals } from '../lib/festivals';
import { nowIst, THEME_VARS } from '../lib/content';
import {
  coerce, missingRequired, PAGE_SCHEMA, POST_SCHEMA, RESERVED_SLUGS, ROOM_SCHEMA, SETTINGS_FORMS, type FormSchema,
} from '../lib/schemas';
import {
  clearRate, clientIp, hashPassword, isLocked, newTotpSecret, passwordProblem, rateHit, safeEqual, verifyPassword, verifyTotp, verifyTurnstile,
} from '../lib/security';
import { audit, saveSetting } from '../lib/settings';
import { mediaStore } from '../lib/storage';
import { siteOrigin, verificationCode } from '../lib/seo';
import { bytes, fmtDate, fmtDateTime, inr, nowSql, parseJson, safeBack, slugify, telLink, waLink } from '../lib/util';
import { AdminLayout, AuthShell, Card, PostButton, SchemaForm, StatusChip, type AdminCtx } from './ui';

const admin = new Hono<AppEnv>();

admin.use('*', async (c, next) => {
  await next();
  c.header('X-Robots-Tag', 'noindex, nofollow');
  c.header('Cache-Control', 'no-store');
});

const ctxOf = (c: Context<AppEnv>): AdminCtx => ({
  user: c.get('user'),
  csrf: c.get('session').csrf,
  s: c.get('s'),
  newEnquiries: c.get('newEnquiries') || 0,
  nonce: c.get('nonce'),
});

const flash = (c: Context<AppEnv>) => ({ ok: c.req.query('ok'), err: c.req.query('err') });

function sameOrigin(c: Context<AppEnv>): boolean {
  const origin = c.req.header('origin');
  return !origin || origin === new URL(c.req.url).origin;
}

async function userCount(db: D1Database): Promise<number> {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
  return r?.n ?? 0;
}

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// =============================================================================================
// Sign in, two-step code, first-time setup
// =============================================================================================
function LoginPage({ c, error, next }: { c: Context<AppEnv>; error?: string; next: string }) {
  const s = c.get('s');
  const turnstile = s.security.protectLogin && s.security.turnstileSiteKey && s.security.turnstileSecret;
  return (
    <AuthShell s={s} title="Sign in">
      <h1>Welcome back</h1>
      <p class="muted">Sign in to manage your website.</p>
      {error ? (
        <div class="flash flash-err" role="alert">
          <Icon name="triangle-alert" size={18} /> {error}
        </div>
      ) : null}
      <form method="post" action="/admin/login" class="auth-form">
        <input type="hidden" name="next" value={next} />
        <label>
          E-mail
          <input type="email" name="email" required autocomplete="username" autofocus maxlength={200} />
        </label>
        <label>
          Password
          <input type="password" name="password" required autocomplete="current-password" maxlength={200} />
        </label>
        {turnstile ? <div class="cf-turnstile" data-sitekey={s.security.turnstileSiteKey}></div> : null}
        <button class="btn btn-primary btn-block" type="submit">
          Sign in
        </button>
      </form>
      {turnstile ? <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script> : null}
      <p class="auth-foot">
        <a href="/">← Back to website</a>
      </p>
    </AuthShell>
  );
}

admin.get('/login', async (c) => {
  if ((await userCount(c.env.DB)) === 0) return c.redirect('/admin/setup');
  const auth = await readSession(c);
  if (auth && !auth.session.mfa_pending) return c.redirect('/admin');
  const errors: Record<string, string> = {
    bad: 'Wrong e-mail or password.',
    locked: 'Too many attempts. Please wait 15 minutes and try again.',
    captcha: 'Please complete the security check.',
    expired: 'Your sign-in expired. Please sign in again.',
  };
  return c.html(<LoginPage c={c} error={errors[c.req.query('e') || '']} next={safeBack(c.req.query('next'), '/admin')} />);
});

admin.post('/login', async (c) => {
  if (!sameOrigin(c)) return c.text('Cross-site request blocked', 403);
  const db = c.env.DB;
  const s = c.get('s');
  const body = await c.req.parseBody();
  const email = str(body.email, 200).toLowerCase();
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  let next = safeBack(str(body.next, 300), '/admin');
  if (!next.startsWith('/admin')) next = '/admin';
  const back = (e: string) => c.redirect(`/admin/login?e=${e}&next=${encodeURIComponent(next)}`, 303);
  const ip = clientIp(c);
  if ((await isLocked(db, `login:ip:${ip}`)) || (await isLocked(db, `login:email:${email}`))) return back('locked');
  if (s.security.protectLogin && s.security.turnstileSiteKey && s.security.turnstileSecret) {
    if (!(await verifyTurnstile(s.security.turnstileSecret, str(body['cf-turnstile-response'], 2048), ip))) return back('captcha');
  }
  const user = await db
    .prepare('SELECT id, name, password_hash, totp_enabled FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: number; name: string; password_hash: string; totp_enabled: number }>();
  const ok = await verifyPassword(password, user?.password_hash);
  if (!user || !ok) {
    await rateHit(db, `login:ip:${ip}`, 20, 900);
    await rateHit(db, `login:email:${email}`, 6, 900);
    await audit(db, null, 'login.failed', email, ip);
    return back('bad');
  }
  await clearRate(db, `login:email:${email}`);
  await createSession(c, user.id, !!user.totp_enabled);
  if (user.totp_enabled) return c.redirect(`/admin/login/2fa?next=${encodeURIComponent(next)}`, 303);
  await db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(nowSql(), user.id).run();
  await audit(db, user, 'login', '', ip);
  return c.redirect(next, 303);
});

admin.get('/login/2fa', async (c) => {
  const auth = await readSession(c);
  if (!auth) return c.redirect('/admin/login?e=expired');
  if (!auth.session.mfa_pending) return c.redirect('/admin');
  const s = c.get('s');
  return c.html(
    <AuthShell s={s} title="Two-step code">
      <h1>Enter your code</h1>
      <p class="muted">Open your authenticator app and type the 6-digit code for {s.site.name}.</p>
      {c.req.query('e') ? (
        <div class="flash flash-err" role="alert">
          <Icon name="triangle-alert" size={18} /> That code didn't work. Try the newest one.
        </div>
      ) : null}
      <form method="post" action="/admin/login/2fa" class="auth-form">
        <input type="hidden" name="next" value={safeBack(c.req.query('next'), '/admin')} />
        <label>
          6-digit code
          <input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength={7} required autofocus class="code-input" />
        </label>
        <button class="btn btn-primary btn-block" type="submit">
          Verify
        </button>
      </form>
      <p class="auth-foot">
        <a href="/admin/login">Use a different account</a>
      </p>
    </AuthShell>,
  );
});

admin.post('/login/2fa', async (c) => {
  if (!sameOrigin(c)) return c.text('Cross-site request blocked', 403);
  const db = c.env.DB;
  const auth = await readSession(c);
  if (!auth || !auth.session.mfa_pending) return c.redirect('/admin/login?e=expired', 303);
  const body = await c.req.parseBody();
  let next = safeBack(str(body.next, 300), '/admin');
  if (!next.startsWith('/admin')) next = '/admin';
  const key = `2fa:${auth.user.id}`;
  if (await isLocked(db, key)) {
    await destroySession(c);
    return c.redirect('/admin/login?e=locked', 303);
  }
  const row = await db.prepare('SELECT totp_secret FROM users WHERE id = ?').bind(auth.user.id).first<{ totp_secret: string }>();
  if (!row?.totp_secret || !(await verifyTotp(row.totp_secret, str(body.code, 10)))) {
    await rateHit(db, key, 6, 900);
    return c.redirect(`/admin/login/2fa?e=1&next=${encodeURIComponent(next)}`, 303);
  }
  await clearRate(db, key);
  // Fresh session for the fully signed-in state.
  await destroySession(c);
  await createSession(c, auth.user.id, false);
  await db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(nowSql(), auth.user.id).run();
  await audit(db, auth.user, 'login', 'with 2-step code', clientIp(c));
  return c.redirect(next, 303);
});

function SetupPage({ c, error }: { c: Context<AppEnv>; error?: string }) {
  const s = c.get('s');
  const keySet = !!c.env.ADMIN_SETUP_KEY;
  return (
    <AuthShell s={s} title="Set up">
      <h1>Create the owner account</h1>
      {keySet ? (
        <>
          <p class="muted">This page works only once. Enter the setup key that was configured on the server, then choose your login.</p>
          {error ? (
            <div class="flash flash-err" role="alert">
              <Icon name="triangle-alert" size={18} /> {error}
            </div>
          ) : null}
          <form method="post" action="/admin/setup" class="auth-form">
            <label>
              Setup key
              <input type="password" name="key" required autocomplete="off" maxlength={200} />
            </label>
            <label>
              Your name
              <input type="text" name="name" required maxlength={80} autocomplete="name" />
            </label>
            <label>
              E-mail (used to sign in)
              <input type="email" name="email" required maxlength={200} autocomplete="username" />
            </label>
            <label>
              Password (10+ characters)
              <input type="password" name="password" required minlength={10} maxlength={200} autocomplete="new-password" />
            </label>
            <button class="btn btn-primary btn-block" type="submit">
              Create account
            </button>
          </form>
        </>
      ) : (
        <div class="flash flash-err">
          The setup key is not configured. Run <code>npx wrangler secret put ADMIN_SETUP_KEY</code> (or add it to <code>.dev.vars</code> locally) and reload this page.
        </div>
      )}
    </AuthShell>
  );
}

admin.get('/setup', async (c) => {
  if ((await userCount(c.env.DB)) > 0) return c.redirect('/admin/login');
  return c.html(<SetupPage c={c} />);
});

admin.post('/setup', async (c) => {
  if (!sameOrigin(c)) return c.text('Cross-site request blocked', 403);
  const db = c.env.DB;
  if ((await userCount(db)) > 0) return c.redirect('/admin/login', 303);
  const ip = clientIp(c);
  if (!(await rateHit(db, `setup:${ip}`, 8, 3600))) return c.html(<SetupPage c={c} error="Too many attempts. Try again in an hour." />, 429);
  const body = await c.req.parseBody();
  const key = str(body.key, 200);
  if (!c.env.ADMIN_SETUP_KEY || !safeEqual(key, c.env.ADMIN_SETUP_KEY)) return c.html(<SetupPage c={c} error="The setup key is not correct." />, 403);
  const name = str(body.name, 80);
  const email = str(body.email, 200).toLowerCase();
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.html(<SetupPage c={c} error="Enter your name and a valid e-mail." />, 400);
  const problem = passwordProblem(password);
  if (problem) return c.html(<SetupPage c={c} error={problem} />, 400);
  const res = await db
    .prepare("INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, 'owner', ?)")
    .bind(email, name, await hashPassword(password))
    .run();
  const id = Number(res.meta.last_row_id);
  await createSession(c, id, false);
  await audit(db, { id, name }, 'setup', 'Owner account created', ip);
  return c.redirect('/admin?ok=created', 303);
});

// =============================================================================================
// Everything below needs a signed-in admin
// =============================================================================================
admin.use('*', requireAuth, requireCsrf, async (c, next) => {
  const r = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'").first<{ n: number }>();
  c.set('newEnquiries', r?.n ?? 0);
  await next();
});

admin.post('/logout', async (c) => {
  await audit(c.env.DB, c.get('user'), 'logout', '', clientIp(c));
  await destroySession(c);
  return c.redirect('/admin/login', 303);
});

// ---------------------------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------------------------
admin.get('/', async (c) => {
  const db = c.env.DB;
  const ctx = ctxOf(c);
  const s = ctx.s;
  const [counts, recent, activity] = await Promise.all([
    db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM rooms WHERE status = 'published') AS rooms_live,
          (SELECT COUNT(*) FROM rooms) AS rooms_all,
          (SELECT COUNT(*) FROM posts WHERE status = 'published') AS posts_live,
          (SELECT COUNT(*) FROM pages WHERE status = 'published') AS pages_live,
          (SELECT COUNT(*) FROM media) AS media,
          (SELECT COUNT(*) FROM enquiries) AS enq_all,
          (SELECT COUNT(*) FROM enquiries WHERE created_at >= datetime('now', '-7 days')) AS enq_week`,
      )
      .first<Record<string, number>>(),
    db.prepare('SELECT * FROM enquiries ORDER BY id DESC LIMIT 5').all<Record<string, string | number>>(),
    db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 6').all<Record<string, string>>(),
  ]);
  const origin = siteOrigin(s, c.req.url);
  const festNow = activeFestival(s);
  const upcoming = upcomingFestivals(s, 4);
  const roomsRows = await db.prepare('SELECT data FROM rooms WHERE status = ?').bind('published').all<{ data: string }>();
  const roomsWithoutPhotos = roomsRows.results.filter((r) => !(parseJson<{ images?: string[] }>(r.data, {}).images || []).length).length;
  const checklist: { done: boolean; label: string; href: string }[] = [
    { done: !!s.seo.siteUrl, label: 'Add your live website address (for Google & sharing)', href: '/admin/settings/seo' },
    { done: s.seo.verifiedByDns || !!verificationCode(s.seo.googleVerification), label: 'Verify the site in Google Search Console', href: '/admin/settings/seo' },
    { done: /^G-/.test(s.seo.ga4Id), label: 'Connect Google Analytics (optional)', href: '/admin/settings/seo' },
    { done: roomsWithoutPhotos === 0, label: 'Every published room has photos', href: '/admin/rooms' },
    { done: s.booking.otas.some((o) => o.url), label: 'Add your Agoda / MakeMyTrip / Goibibo links', href: '/admin/settings/booking' },
    { done: !!(s.site.lat && s.site.lng), label: 'Add map coordinates for better Google results', href: '/admin/settings/site' },
    { done: !!ctx.user.totp_enabled, label: 'Turn on two-step login for your account', href: '/admin/account' },
    { done: !!(s.security.turnstileSiteKey && s.security.turnstileSecret), label: 'Add Cloudflare Turnstile spam protection (optional)', href: '/admin/settings/security' },
  ];
  const doneCount = checklist.filter((x) => x.done).length;
  const stat = (label: string, value: string | number, icon: string, href: string, note?: string) => (
    <a class="stat" href={href}>
      <span class="stat-icon">
        <Icon name={icon} size={20} />
      </span>
      <span>
        <strong>{value}</strong>
        <small>{label}</small>
        {note ? <em>{note}</em> : null}
      </span>
    </a>
  );
  return c.html(
    <AdminLayout ctx={ctx} title={`Hello, ${ctx.user.name.split(' ')[0]}`} active="dashboard" {...flash(c)}>
      <div class="stats">
        {stat('New enquiries', ctx.newEnquiries, 'inbox', '/admin/enquiries', `${counts?.enq_week ?? 0} this week`)}
        {stat('Rooms live', `${counts?.rooms_live ?? 0}/${counts?.rooms_all ?? 0}`, 'bed-double', '/admin/rooms')}
        {stat('Blog posts', counts?.posts_live ?? 0, 'newspaper', '/admin/posts')}
        {stat('Media files', counts?.media ?? 0, 'image', '/admin/media')}
      </div>
      <div class="grid-2">
        <Card title="Latest enquiries" actions={<a class="btn btn-ghost btn-sm" href="/admin/enquiries">View all</a>}>
          {recent.results.length ? (
            <ul class="list">
              {recent.results.map((e) => (
                <li>
                  <div>
                    <strong>{String(e.name)}</strong> <StatusChip status={String(e.status)} />
                    <small>
                      {e.room ? `${e.room} · ` : ''}
                      {e.checkin ? `${fmtDate(String(e.checkin))} → ${fmtDate(String(e.checkout || ''))} · ` : ''}
                      {fmtDateTime(String(e.created_at))}
                    </small>
                  </div>
                  <div class="row-actions">
                    <a class="btn btn-ghost btn-sm" href={telLink(String(e.phone))} title="Call">
                      <Icon name="phone" size={16} />
                    </a>
                    <a class="btn btn-ghost btn-sm" href={waLink(String(e.phone), `Hi ${e.name}, this is ${s.site.name} regarding your enquiry.`)} target="_blank" rel="noopener" title="WhatsApp">
                      <Icon name="whatsapp" size={16} />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p class="empty-note">No enquiries yet. They'll appear here when guests use the form on your website.</p>
          )}
        </Card>
        <Card title="Setup checklist" desc={`${doneCount} of ${checklist.length} done`}>
          <div class="progress">
            <span style={`width:${Math.round((doneCount / checklist.length) * 100)}%`}></span>
          </div>
          <ul class="checks">
            {checklist.map((i) => (
              <li class={i.done ? 'is-done' : ''}>
                <Icon name={i.done ? 'circle-check' : 'info'} size={18} />
                <a href={i.href}>{i.label}</a>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div class="grid-2">
        <Card title="Festival themes" actions={<a class="btn btn-ghost btn-sm" href="/admin/settings/festivals">Manage</a>}>
          {festNow ? (
            <p class="fest-now">
              <Icon name="party-popper" size={18} /> <strong>{festNow.name}</strong> is live on the website now.
              <a href={`/?festival=${encodeURIComponent(festNow.id)}`} target="_blank" rel="noopener">
                View
              </a>
            </p>
          ) : (
            <p class="muted">No festival theme is showing right now.</p>
          )}
          <ul class="list">
            {upcoming.map((f) => (
              <li>
                <div>
                  <strong>{f.name}</strong>
                  <small>
                    {fmtDate(f.start)} → {fmtDate(f.end)}
                  </small>
                </div>
                <a class="btn btn-ghost btn-sm" href={`/?festival=${encodeURIComponent(f.id)}`} target="_blank" rel="noopener">
                  <Icon name="eye" size={16} /> Preview
                </a>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Google Search Console" desc="Help Google find every page of your site.">
          <ol class="steps">
            <li>
              Open <a href="https://search.google.com/search-console" target="_blank" rel="noopener">Search Console</a> and add <code>{origin}</code> as a URL-prefix property.
            </li>
            <li>
              Choose <em>HTML tag</em>, copy the tag and paste it in <a href="/admin/settings/seo">SEO settings</a>, then click Verify.
            </li>
            <li>
              Under <em>Sitemaps</em>, submit <code data-copy-text>{origin}/sitemap.xml</code>
            </li>
          </ol>
          <p class="muted">
            Status: {s.seo.verifiedByDns ? 'verified with a DNS record ✓' : verificationCode(s.seo.googleVerification) ? 'verification tag added ✓' : 'not verified yet'}
          </p>
        </Card>
      </div>
      <Card title="Recent activity" actions={<a class="btn btn-ghost btn-sm" href="/admin/activity">Activity log</a>}>
        <ul class="list compact">
          {activity.results.map((a) => (
            <li>
              <div>
                <strong>{a.user_name || 'Visitor'}</strong> {a.action} <small>{a.detail}</small>
              </div>
              <small>{fmtDateTime(a.created_at)}</small>
            </li>
          ))}
        </ul>
      </Card>
    </AdminLayout>,
  );
});

// ---------------------------------------------------------------------------------------------
// Data the editor needs (fonts, icons, presets, bundled images) and markdown preview
// ---------------------------------------------------------------------------------------------
admin.get('/api/meta', (c) =>
  c.json({
    fonts: [SYSTEM_FONT, ...FONTS.map((f) => f.name)],
    fontKinds: Object.fromEntries(FONTS.map((f) => [f.name, f.kind])),
    fontWeights: Object.fromEntries(FONTS.map((f) => [f.name, f.weights])),
    presets: THEME_PRESETS,
    themeVars: THEME_VARS,
    builtin: BUILTIN_IMAGES,
  }),
);

admin.get('/api/icons', (c) => c.json(ICONS, 200, { 'cache-control': 'private, max-age=3600' }));

admin.post('/api/markdown', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { md?: string };
  return c.json({ html: renderMarkdown(String(body.md || '').slice(0, 100_000)) });
});

// ---------------------------------------------------------------------------------------------
// Settings sections (business info, home page, theme, festivals, SEO …)
// ---------------------------------------------------------------------------------------------
function settingsExtras(key: SettingsKey, c: Context<AppEnv>) {
  if (key === 'theme') {
    return (
      <Card title="Live preview" desc="Changes appear here instantly. Click Save to publish them." class="theme-preview-card">
        <div class="preview-toolbar">
          <button type="button" class="btn btn-ghost btn-sm is-active" data-preview-size="desktop">
            <Icon name="monitor" size={16} /> Desktop
          </button>
          <button type="button" class="btn btn-ghost btn-sm" data-preview-size="mobile">
            <Icon name="smartphone" size={16} /> Phone
          </button>
        </div>
        <div class="preview-frame" data-preview-wrap>
          <iframe src="/?preview=1" title="Website preview" data-theme-preview loading="lazy"></iframe>
        </div>
      </Card>
    );
  }
  if (key === 'festivals') {
    const s = c.get('s');
    const now = activeFestival(s);
    return (
      <Card title="Preview a festival" desc="Opens the website with that festival's look — the live site doesn't change until its dates arrive (or you switch on “Show now”).">
        <div class="chip-row">
          {s.festivals.items.map((f) => (
            <a class={`chip-link${now?.id === f.id ? ' is-live' : ''}`} href={`/?festival=${encodeURIComponent(f.id)}`} target="_blank" rel="noopener">
              <Icon name={now?.id === f.id ? 'sparkles' : 'eye'} size={14} /> {f.name}
              {now?.id === f.id ? <em>live</em> : null}
            </a>
          ))}
        </div>
      </Card>
    );
  }
  if (key === 'seo') {
    const origin = siteOrigin(c.get('s'), c.req.url);
    return (
      <Card title="Your SEO files" desc="Generated automatically from your content.">
        <ul class="list compact">
          <li>
            <span>Sitemap</span>
            <a href="/sitemap.xml" target="_blank" rel="noopener">
              {origin}/sitemap.xml
            </a>
          </li>
          <li>
            <span>Robots</span>
            <a href="/robots.txt" target="_blank" rel="noopener">
              {origin}/robots.txt
            </a>
          </li>
        </ul>
      </Card>
    );
  }
  return null;
}

admin.get('/settings/:key', (c) => {
  const key = c.req.param('key') as SettingsKey;
  const form = SETTINGS_FORMS[key];
  if (!form || !SETTINGS_KEYS.includes(key)) return c.notFound();
  if (form.owner && c.get('user').role !== 'owner') return c.text('Only the owner can change this.', 403);
  const ctx = ctxOf(c);
  const value = ctx.s[key];
  const extra = settingsExtras(key, c);
  return c.html(
    <AdminLayout ctx={ctx} title={form.title} active={key} wide={key === 'theme'} {...flash(c)}>
      <p class="page-desc">{form.desc}</p>
      <div class={key === 'theme' ? 'theme-layout' : ''}>
        {key !== 'theme' ? extra : null}
        <SchemaForm action={`/admin/settings/${key}`} csrf={ctx.csrf} schema={form.schema} value={value} meta={{ page: key }} />
        {key === 'theme' ? extra : null}
      </div>
      <div class="danger-zone">
        <PostButton action={`/admin/settings/${key}/reset`} csrf={ctx.csrf} label="Reset this section to defaults" icon="rotate-ccw" confirm="Reset this whole section to the original defaults? Your changes here will be lost." />
      </div>
    </AdminLayout>,
  );
});

admin.post('/settings/:key', async (c) => {
  const key = c.req.param('key') as SettingsKey;
  const form = SETTINGS_FORMS[key];
  if (!form || !SETTINGS_KEYS.includes(key)) return c.notFound();
  if (form.owner && c.get('user').role !== 'owner') return c.text('Only the owner can change this.', 403);
  const body = await c.req.parseBody();
  const payload = parseJson<unknown>(typeof body.payload === 'string' ? body.payload : '', null);
  if (!payload) return c.redirect(`/admin/settings/${key}?err=invalid`, 303);
  const value = coerce(form.schema, payload);
  if (missingRequired(form.schema, value).length) return c.redirect(`/admin/settings/${key}?err=required`, 303);
  if (key === 'festivals') {
    const seen = new Set<string>();
    for (const f of value.items as { id: string; name: string }[]) {
      let id = slugify(f.id || f.name);
      while (seen.has(id)) id += '-2';
      seen.add(id);
      f.id = id;
    }
  }
  if (key === 'seo') {
    value.siteUrl = String(value.siteUrl || '').replace(/\/+$/, '');
    value.ga4Id = String(value.ga4Id || '').toUpperCase();
  }
  await saveSetting(c.env.DB, key, value);
  await audit(c.env.DB, c.get('user'), 'settings.save', form.title, clientIp(c));
  return c.redirect(`/admin/settings/${key}?ok=saved`, 303);
});

admin.post('/settings/:key/reset', async (c) => {
  const key = c.req.param('key') as SettingsKey;
  const form = SETTINGS_FORMS[key];
  if (!form) return c.notFound();
  if (form.owner && c.get('user').role !== 'owner') return c.text('Only the owner can change this.', 403);
  await saveSetting(c.env.DB, key, DEFAULTS[key]);
  await audit(c.env.DB, c.get('user'), 'settings.reset', form.title, clientIp(c));
  return c.redirect(`/admin/settings/${key}?ok=saved`, 303);
});

// ---------------------------------------------------------------------------------------------
// Rooms, blog posts and pages share one editor
// ---------------------------------------------------------------------------------------------
type Entity = {
  key: 'rooms' | 'posts' | 'pages';
  title: string;
  singular: string;
  icon: string;
  schema: FormSchema;
  nameField: 'name' | 'title';
  publicPath: (slug: string) => string;
  blank: () => Record<string, unknown>;
  columns: (v: Record<string, unknown>) => Record<string, string | number | null>;
};

const ENTITIES: Record<string, Entity> = {
  rooms: {
    key: 'rooms', title: 'Rooms', singular: 'room', icon: 'bed-double', schema: ROOM_SCHEMA, nameField: 'name',
    publicPath: (slug) => `/rooms/${slug}`,
    blank: () => ({ status: 'draft', ac: 'ac', price: 1000, maxAdults: 2, maxChildren: 1, roomCount: 1, sort: 10, images: [], amenities: [], blocked: [] }),
    columns: (v) => ({
      name: String(v.name), status: String(v.status), featured: v.featured ? 1 : 0, sort: Number(v.sort) || 0,
      ac: v.ac === 'ac' ? 1 : 0, price: Number(v.price) || 0, max_guests: (Number(v.maxAdults) || 0) + (Number(v.maxChildren) || 0),
    }),
  },
  posts: {
    key: 'posts', title: 'Blog posts', singular: 'post', icon: 'newspaper', schema: POST_SCHEMA, nameField: 'title',
    publicPath: (slug) => `/blog/${slug}`,
    blank: () => ({ status: 'draft', author: '', tags: [], publishedAt: nowIst().replace(' ', 'T') }),
    columns: (v) => {
      let published = String(v.publishedAt || '').replace('T', ' ');
      if (!published && v.status === 'published') published = nowIst();
      return {
        title: String(v.title), status: String(v.status), published_at: published || null,
        tags: ((v.tags as string[]) || []).map((t) => t.toLowerCase().replace(/,/g, ' ')).join(','),
      };
    },
  },
  pages: {
    key: 'pages', title: 'Pages', singular: 'page', icon: 'files', schema: PAGE_SCHEMA, nameField: 'title',
    publicPath: (slug) => `/${slug}`,
    blank: () => ({ status: 'draft', sort: 20 }),
    columns: (v) => ({ title: String(v.title), status: String(v.status), sort: Number(v.sort) || 0 }),
  },
};

async function uniqueSlug(db: D1Database, ent: Entity, wanted: string, id: number | null): Promise<string> {
  let base = slugify(wanted);
  if (ent.key === 'pages' && RESERVED_SLUGS.has(base)) base = `${base}-page`;
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const row = await db.prepare(`SELECT id FROM ${ent.key} WHERE slug = ?`).bind(slug).first<{ id: number }>();
    if (!row || row.id === id) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

function entityValue(ent: Entity, row: RoomRow | PostRow | PageRow): Record<string, unknown> {
  const d = parseJson<Record<string, unknown>>(row.data, {});
  const v: Record<string, unknown> = { ...d, slug: row.slug, status: row.status };
  if (ent.key === 'rooms') {
    const r = row as RoomRow;
    Object.assign(v, { name: r.name, featured: !!r.featured, sort: r.sort, ac: r.ac ? 'ac' : 'nonac', price: r.price });
  } else if (ent.key === 'posts') {
    const p = row as PostRow;
    Object.assign(v, { title: p.title, publishedAt: (p.published_at || '').replace(' ', 'T'), tags: p.tags ? p.tags.split(',').filter(Boolean) : [] });
  } else {
    const p = row as PageRow;
    Object.assign(v, { title: p.title, sort: p.sort });
  }
  return v;
}

for (const ent of Object.values(ENTITIES)) {
  const base = `/${ent.key}`;

  admin.get(base, async (c) => {
    const ctx = ctxOf(c);
    const q = (c.req.query('q') || '').slice(0, 80);
    const order = ent.key === 'posts' ? 'COALESCE(published_at, created_at) DESC' : ent.key === 'rooms' ? 'sort, id' : 'sort, title';
    const where = q ? `WHERE ${ent.nameField === 'name' ? 'name' : 'title'} LIKE ?` : '';
    const stmt = c.env.DB.prepare(`SELECT * FROM ${ent.key} ${where} ORDER BY ${order} LIMIT 500`);
    const { results } = await (q ? stmt.bind(`%${q}%`) : stmt).all<RoomRow & PostRow & PageRow>();
    const now = nowIst();
    return c.html(
      <AdminLayout
        ctx={ctx}
        title={ent.title}
        active={ent.key}
        {...flash(c)}
        actions={
          <a class="btn btn-primary btn-sm" href={`/admin${base}/new`}>
            <Icon name="plus" size={16} /> New {ent.singular}
          </a>
        }
      >
        <form class="toolbar" method="get">
          <input type="search" name="q" value={q} placeholder={`Search ${ent.title.toLowerCase()}…`} />
          <button class="btn btn-ghost btn-sm" type="submit">
            <Icon name="search" size={16} /> Search
          </button>
        </form>
        {results.length ? (
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  {ent.key !== 'pages' ? <th class="th-thumb"></th> : null}
                  <th>{ent.key === 'rooms' ? 'Room' : 'Title'}</th>
                  {ent.key === 'rooms' ? (
                    <>
                      <th>Type</th>
                      <th>Price</th>
                      <th>Guests</th>
                    </>
                  ) : ent.key === 'posts' ? (
                    <th>Date</th>
                  ) : (
                    <th>Address</th>
                  )}
                  <th>Status</th>
                  <th class="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => {
                  const d = parseJson<Record<string, unknown>>(row.data, {});
                  const thumb = ent.key === 'rooms' ? ((d.images as string[]) || [])[0] : ent.key === 'posts' ? (d.cover as string) : '';
                  const name = ent.key === 'rooms' ? row.name : row.title;
                  const status = ent.key === 'posts' && row.status === 'published' && (row.published_at || '') > now ? 'scheduled' : row.status;
                  return (
                    <tr>
                      {ent.key !== 'pages' ? (
                        <td class="td-thumb">{thumb ? <img src={thumb} alt="" loading="lazy" /> : <span class="no-thumb"><Icon name="image" size={18} /></span>}</td>
                      ) : null}
                      <td>
                        <a class="row-title" href={`/admin${base}/${row.id}`}>
                          {name}
                        </a>
                        {ent.key === 'rooms' && row.featured ? <span class="chip chip-amber">featured</span> : null}
                      </td>
                      {ent.key === 'rooms' ? (
                        <>
                          <td>{row.ac ? 'AC' : 'Non-AC'}</td>
                          <td>₹{inr(row.price)}</td>
                          <td>{row.max_guests}</td>
                        </>
                      ) : ent.key === 'posts' ? (
                        <td>{fmtDate(row.published_at || row.created_at)}</td>
                      ) : (
                        <td>
                          <code>/{row.slug}</code>
                        </td>
                      )}
                      <td>
                        <StatusChip status={status} />
                      </td>
                      <td class="row-actions">
                        <a class="btn btn-ghost btn-sm" href={`/admin${base}/${row.id}`} title="Edit">
                          <Icon name="pencil" size={16} />
                        </a>
                        <a class="btn btn-ghost btn-sm" href={ent.publicPath(row.slug)} target="_blank" rel="noopener" title="View on site">
                          <Icon name="eye" size={16} />
                        </a>
                        <PostButton action={`/admin${base}/${row.id}/duplicate`} csrf={ctx.csrf} label="" icon="copy" title="Duplicate" />
                        <PostButton action={`/admin${base}/${row.id}/delete`} csrf={ctx.csrf} label="" icon="trash" title="Delete" class="btn btn-ghost btn-sm danger" confirm={`Delete “${name}”? This cannot be undone.`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div class="empty-state">
            <Icon name={ent.icon} size={36} />
            <p>No {ent.title.toLowerCase()} yet.</p>
            <a class="btn btn-primary" href={`/admin${base}/new`}>
              <Icon name="plus" size={16} /> New {ent.singular}
            </a>
          </div>
        )}
      </AdminLayout>,
    );
  });

  const editor = (c: Context<AppEnv>, value: Record<string, unknown>, id: number | null, slug: string) => {
    const ctx = ctxOf(c);
    return c.html(
      <AdminLayout
        ctx={ctx}
        title={id ? `Edit ${ent.singular}` : `New ${ent.singular}`}
        active={ent.key}
        {...flash(c)}
        actions={
          id ? (
            <a class="btn btn-ghost btn-sm" href={ent.publicPath(slug)} target="_blank" rel="noopener">
              <Icon name="eye" size={16} /> Preview
            </a>
          ) : null
        }
      >
        <p class="page-desc">
          <a href={`/admin${base}`}>← All {ent.title.toLowerCase()}</a>
        </p>
        <SchemaForm action={id ? `/admin${base}/${id}` : `/admin${base}/new`} csrf={ctx.csrf} schema={ent.schema} value={value} submit={id ? 'Save changes' : `Create ${ent.singular}`} meta={{ page: ent.key }} />
        {id ? (
          <div class="danger-zone">
            <PostButton action={`/admin${base}/${id}/delete`} csrf={ctx.csrf} label={`Delete this ${ent.singular}`} icon="trash" class="btn btn-ghost btn-sm danger" confirm="Delete permanently? This cannot be undone." />
          </div>
        ) : null}
      </AdminLayout>,
    );
  };

  admin.get(`${base}/new`, (c) => editor(c, ent.blank(), null, ''));

  admin.get(`${base}/:id{[0-9]+}`, async (c) => {
    const row = await c.env.DB.prepare(`SELECT * FROM ${ent.key} WHERE id = ?`).bind(Number(c.req.param('id'))).first<RoomRow & PostRow & PageRow>();
    if (!row) return c.redirect(`/admin${base}?err=notfound`);
    return editor(c, entityValue(ent, row), row.id, row.slug);
  });

  const save = async (c: Context<AppEnv>, id: number | null) => {
    const db = c.env.DB;
    const body = await c.req.parseBody();
    const payload = parseJson<unknown>(typeof body.payload === 'string' ? body.payload : '', null);
    const back = id ? `/admin${base}/${id}` : `/admin${base}/new`;
    if (!payload) return c.redirect(`${back}?err=invalid`, 303);
    const value = coerce(ent.schema, payload);
    if (missingRequired(ent.schema, value).length) return c.redirect(`${back}?err=required`, 303);
    const slug = await uniqueSlug(db, ent, String(value.slug || value[ent.nameField] || ent.singular), id);
    value.slug = slug;
    const cols = { slug, ...ent.columns(value), data: JSON.stringify(value) };
    const names = Object.keys(cols);
    if (id) {
      await db
        .prepare(`UPDATE ${ent.key} SET ${names.map((n) => `${n} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
        .bind(...Object.values(cols), id)
        .run();
    } else {
      const res = await db
        .prepare(`INSERT INTO ${ent.key} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
        .bind(...Object.values(cols))
        .run();
      id = Number(res.meta.last_row_id);
    }
    await audit(db, c.get('user'), `${ent.singular}.save`, String(value[ent.nameField]), clientIp(c));
    return c.redirect(`/admin${base}/${id}?ok=saved`, 303);
  };

  admin.post(`${base}/new`, (c) => save(c, null));
  admin.post(`${base}/:id{[0-9]+}`, (c) => save(c, Number(c.req.param('id'))));

  admin.post(`${base}/:id{[0-9]+}/delete`, async (c) => {
    const id = Number(c.req.param('id'));
    const row = await c.env.DB.prepare(`SELECT slug FROM ${ent.key} WHERE id = ?`).bind(id).first<{ slug: string }>();
    await c.env.DB.prepare(`DELETE FROM ${ent.key} WHERE id = ?`).bind(id).run();
    await audit(c.env.DB, c.get('user'), `${ent.singular}.delete`, row?.slug || String(id), clientIp(c));
    return c.redirect(`/admin${base}?ok=deleted`, 303);
  });

  admin.post(`${base}/:id{[0-9]+}/duplicate`, async (c) => {
    const db = c.env.DB;
    const row = await db.prepare(`SELECT * FROM ${ent.key} WHERE id = ?`).bind(Number(c.req.param('id'))).first<RoomRow & PostRow & PageRow>();
    if (!row) return c.redirect(`/admin${base}?err=notfound`, 303);
    const value = entityValue(ent, row);
    value[ent.nameField] = `${value[ent.nameField]} (copy)`;
    value.status = 'draft';
    const slug = await uniqueSlug(db, ent, `${row.slug}-copy`, null);
    value.slug = slug;
    const cols = { slug, ...ent.columns(value), data: JSON.stringify(value) };
    const names = Object.keys(cols);
    const res = await db
      .prepare(`INSERT INTO ${ent.key} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`)
      .bind(...Object.values(cols))
      .run();
    await audit(db, c.get('user'), `${ent.singular}.duplicate`, row.slug, clientIp(c));
    return c.redirect(`/admin${base}/${res.meta.last_row_id}?ok=duplicated`, 303);
  });
}

// ---------------------------------------------------------------------------------------------
// Media library (files live in R2)
// ---------------------------------------------------------------------------------------------
type MediaRow = { id: string; key: string; filename: string; mime: string; kind: string; size: number; width: number | null; height: number | null; alt: string; created_at: string };

const MEDIA_TYPES: { kind: string; mime: string; ext: string; max: number; test: (b: Uint8Array) => boolean }[] = [
  { kind: 'image', mime: 'image/jpeg', ext: 'jpg', max: 12e6, test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { kind: 'image', mime: 'image/png', ext: 'png', max: 12e6, test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { kind: 'image', mime: 'image/webp', ext: 'webp', max: 12e6, test: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP' },
  { kind: 'image', mime: 'image/gif', ext: 'gif', max: 8e6, test: (b) => ascii(b, 0, 4) === 'GIF8' },
  { kind: 'image', mime: 'image/avif', ext: 'avif', max: 12e6, test: (b) => ascii(b, 4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(b, 8, 12)) },
  { kind: 'video', mime: 'video/mp4', ext: 'mp4', max: 45e6, test: (b) => ascii(b, 4, 8) === 'ftyp' },
  { kind: 'video', mime: 'video/webm', ext: 'webm', max: 45e6, test: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  { kind: 'font', mime: 'font/woff2', ext: 'woff2', max: 3e6, test: (b) => ascii(b, 0, 4) === 'wOF2' },
  { kind: 'font', mime: 'font/woff', ext: 'woff', max: 3e6, test: (b) => ascii(b, 0, 4) === 'wOFF' },
  { kind: 'font', mime: 'font/ttf', ext: 'ttf', max: 5e6, test: (b) => b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0 },
  { kind: 'font', mime: 'font/otf', ext: 'otf', max: 5e6, test: (b) => ascii(b, 0, 4) === 'OTTO' },
  { kind: 'file', mime: 'application/pdf', ext: 'pdf', max: 12e6, test: (b) => ascii(b, 0, 4) === '%PDF' },
];

function ascii(b: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...b.slice(from, to));
}

const mediaUrl = (m: MediaRow) => `/media/${m.key}`;
const smKey = (key: string) => key.replace(/(\.[a-z0-9]+)$/, '-sm$1');

admin.get('/api/media', async (c) => {
  const kind = c.req.query('kind') || 'image';
  const { results } = await c.env.DB.prepare('SELECT * FROM media WHERE kind = ? ORDER BY created_at DESC LIMIT 500').bind(kind).all<MediaRow>();
  return c.json({
    items: results.map((m) => ({ id: m.id, url: mediaUrl(m), name: m.filename, alt: m.alt, width: m.width, height: m.height, size: m.size, mime: m.mime })),
    builtin: kind === 'image' ? BUILTIN_IMAGES : [],
  });
});

admin.post('/media/upload', async (c) => {
  const db = c.env.DB;
  if (!(await rateHit(db, `upload:${c.get('user').id}`, 300, 3600))) return c.json({ error: 'Upload limit reached for this hour.' }, 429);
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ error: 'No file received.' }, 400);
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const type = MEDIA_TYPES.find((t) => t.test(head));
  if (!type) return c.json({ error: 'This file type is not allowed. Use JPG, PNG, WebP, GIF, MP4, WOFF2/TTF fonts or PDF.' }, 415);
  if (file.size > type.max) return c.json({ error: `File is too large (max ${bytes(type.max)}).` }, 413);
  const id = crypto.randomUUID();
  const d = new Date();
  const folder = { image: 'img', video: 'video', font: 'font', file: 'file' }[type.kind] || 'file';
  const key = `${folder}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${id}.${type.ext}`;
  const store = mediaStore(c.env);
  const data = await file.arrayBuffer();
  await store.put(key, data, type.mime);
  if (type.kind === 'image') {
    // A smaller copy for phones (made in the browser); fall back to the original so -sm always exists.
    const thumb = body.thumb;
    const thumbOk = thumb instanceof File && thumb.size < 4e6 && MEDIA_TYPES.find((t) => t.kind === 'image' && t.mime === type.mime)?.test(new Uint8Array(await thumb.slice(0, 16).arrayBuffer()));
    await store.put(smKey(key), thumbOk ? await (thumb as File).arrayBuffer() : data, type.mime);
  }
  const filename = (file.name || `upload.${type.ext}`).replace(/[^\w.\- ]+/g, '').slice(0, 120) || `upload.${type.ext}`;
  const width = Math.min(20000, parseInt(str(body.width, 6), 10) || 0) || null;
  const height = Math.min(20000, parseInt(str(body.height, 6), 10) || 0) || null;
  await db
    .prepare('INSERT INTO media (id, key, filename, mime, kind, size, width, height, alt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, key, filename, type.mime, type.kind, file.size, width, height, str(body.alt, 200))
    .run();
  await audit(db, c.get('user'), 'media.upload', filename, clientIp(c));
  return c.json({ ok: true, item: { id, url: `/media/${key}`, name: filename, mime: type.mime, kind: type.kind, size: file.size, width, height } });
});

admin.get('/api/media/:id/usage', async (c) => {
  const m = await c.env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(c.req.param('id')).first<MediaRow>();
  if (!m) return c.json({ usage: [] });
  const like = `%${mediaUrl(m)}%`;
  const [settings, rooms, posts, pages] = await Promise.all([
    c.env.DB.prepare('SELECT key FROM settings WHERE value LIKE ?').bind(like).all<{ key: SettingsKey }>(),
    c.env.DB.prepare('SELECT id, name FROM rooms WHERE data LIKE ?').bind(like).all<{ id: number; name: string }>(),
    c.env.DB.prepare('SELECT id, title FROM posts WHERE data LIKE ?').bind(like).all<{ id: number; title: string }>(),
    c.env.DB.prepare('SELECT id, title FROM pages WHERE data LIKE ?').bind(like).all<{ id: number; title: string }>(),
  ]);
  return c.json({
    usage: [
      ...settings.results.map((r) => ({ label: SETTINGS_FORMS[r.key]?.title || r.key, href: `/admin/settings/${r.key}` })),
      ...rooms.results.map((r) => ({ label: `Room: ${r.name}`, href: `/admin/rooms/${r.id}` })),
      ...posts.results.map((r) => ({ label: `Post: ${r.title}`, href: `/admin/posts/${r.id}` })),
      ...pages.results.map((r) => ({ label: `Page: ${r.title}`, href: `/admin/pages/${r.id}` })),
    ],
  });
});

admin.post('/media/:id/alt', async (c) => {
  const body = await c.req.parseBody();
  await c.env.DB.prepare('UPDATE media SET alt = ? WHERE id = ?').bind(str(body.alt, 200), c.req.param('id')).run();
  return c.redirect(`/admin/media?kind=${encodeURIComponent(str(body.kind, 10) || 'image')}&ok=saved`, 303);
});

admin.post('/media/:id/delete', async (c) => {
  const m = await c.env.DB.prepare('SELECT * FROM media WHERE id = ?').bind(c.req.param('id')).first<MediaRow>();
  if (m) {
    await mediaStore(c.env).delete(m.kind === 'image' ? [m.key, smKey(m.key)] : [m.key]);
    await c.env.DB.prepare('DELETE FROM media WHERE id = ?').bind(m.id).run();
    await audit(c.env.DB, c.get('user'), 'media.delete', m.filename, clientIp(c));
  }
  return c.redirect(`/admin/media?kind=${m?.kind || 'image'}&ok=deleted`, 303);
});

admin.get('/media', async (c) => {
  const ctx = ctxOf(c);
  const kind = ['image', 'video', 'font', 'file'].includes(c.req.query('kind') || '') ? c.req.query('kind')! : 'image';
  const { results } = await c.env.DB.prepare('SELECT * FROM media WHERE kind = ? ORDER BY created_at DESC LIMIT 500').bind(kind).all<MediaRow>();
  const totals = await c.env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS b FROM media').first<{ n: number; b: number }>();
  const tabs = [
    { k: 'image', l: 'Photos', i: 'image' },
    { k: 'video', l: 'Videos', i: 'film' },
    { k: 'font', l: 'Fonts', i: 'type' },
    { k: 'file', l: 'Documents', i: 'file-text' },
  ];
  const accept = { image: 'image/jpeg,image/png,image/webp,image/gif,image/avif', video: 'video/mp4,video/webm', font: '.woff2,.woff,.ttf,.otf', file: 'application/pdf' }[kind];
  return c.html(
    <AdminLayout ctx={ctx} title="Media library" active="media" {...flash(c)}>
      <p class="page-desc">
        {totals?.n ?? 0} files · {bytes(totals?.b ?? 0)} used of the free {c.env.MEDIA ? '10 GB' : '500 MB'}. Photos are resized and converted to WebP in your browser before upload.
      </p>
      <div class="tabs">
        {tabs.map((t) => (
          <a class={t.k === kind ? 'is-active' : ''} href={`/admin/media?kind=${t.k}`}>
            <Icon name={t.i} size={16} /> {t.l}
          </a>
        ))}
      </div>
      <label class="dropzone" data-dropzone data-kind={kind}>
        <input type="file" multiple accept={accept} data-upload-input />
        <Icon name="upload" size={28} />
        <strong>Drop files here or click to upload</strong>
        <small>{kind === 'image' ? 'JPG, PNG, WebP or GIF — up to 12 MB each' : kind === 'video' ? 'MP4 or WebM — up to 45 MB' : kind === 'font' ? 'WOFF2, WOFF, TTF or OTF' : 'PDF — up to 12 MB'}</small>
        <span class="upload-progress" data-upload-progress hidden></span>
      </label>
      {results.length ? (
        <ul class="media-grid">
          {results.map((m) => (
            <li class="media-item">
              <button
                type="button"
                class="media-thumb"
                data-media-open
                data-id={m.id}
                data-url={mediaUrl(m)}
                data-name={m.filename}
                data-alt={m.alt}
                data-size={bytes(m.size)}
                data-dims={m.width && m.height ? `${m.width} × ${m.height}` : ''}
                data-kind={m.kind}
                data-date={fmtDate(m.created_at)}
              >
                {m.kind === 'image' ? (
                  <img src={`/media/${smKey(m.key)}`} alt={m.alt} loading="lazy" />
                ) : (
                  <span class="file-icon">
                    <Icon name={m.kind === 'video' ? 'film' : m.kind === 'font' ? 'type' : 'file-text'} size={34} />
                  </span>
                )}
              </button>
              <p title={m.filename}>{m.filename}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div class="empty-state">
          <Icon name="images" size={36} />
          <p>No {tabs.find((t) => t.k === kind)?.l.toLowerCase()} uploaded yet.</p>
        </div>
      )}
      <dialog class="media-dialog" data-media-dialog>
        <div class="md-body">
          <div class="md-preview" data-md-preview></div>
          <div class="md-info">
            <h2 data-md-name></h2>
            <p class="muted" data-md-meta></p>
            <label class="fld-label">Address (URL)</label>
            <div class="copy-row">
              <input type="text" readonly data-md-url />
              <button type="button" class="btn btn-ghost btn-sm" data-md-copy>
                <Icon name="copy" size={16} /> Copy
              </button>
            </div>
            <form method="post" data-md-alt-form>
              <input type="hidden" name="_csrf" value={ctx.csrf} />
              <input type="hidden" name="kind" value={kind} />
              <label class="fld-label">Description for search engines & screen readers</label>
              <input type="text" name="alt" maxlength={200} data-md-alt />
              <button class="btn btn-primary btn-sm" type="submit">
                Save description
              </button>
            </form>
            <p class="muted" data-md-usage></p>
            <form method="post" data-md-delete-form data-confirm="Delete this file? Pages using it will show a broken image.">
              <input type="hidden" name="_csrf" value={ctx.csrf} />
              <button class="btn btn-ghost btn-sm danger" type="submit">
                <Icon name="trash" size={16} /> Delete file
              </button>
            </form>
          </div>
          <button type="button" class="icon-btn md-close" data-md-close aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </div>
      </dialog>
    </AdminLayout>,
  );
});

// ---------------------------------------------------------------------------------------------
// Enquiries inbox
// ---------------------------------------------------------------------------------------------
type EnquiryRow = { id: number; name: string; phone: string; email: string; checkin: string | null; checkout: string | null; guests: number | null; room: string; message: string; status: string; ip: string; created_at: string };
const ENQ_STATUSES = ['new', 'contacted', 'booked', 'closed'];

admin.get('/enquiries', async (c) => {
  const ctx = ctxOf(c);
  const status = ENQ_STATUSES.includes(c.req.query('status') || '') ? c.req.query('status')! : c.req.query('status') === 'all' ? 'all' : 'new';
  const q = (c.req.query('q') || '').slice(0, 80);
  const where: string[] = [];
  const binds: string[] = [];
  if (status !== 'all') {
    where.push('status = ?');
    binds.push(status);
  }
  if (q) {
    where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR message LIKE ?)');
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const { results } = await c.env.DB.prepare(`SELECT * FROM enquiries ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 300`)
    .bind(...binds)
    .all<EnquiryRow>();
  const counts = await c.env.DB.prepare('SELECT status, COUNT(*) AS n FROM enquiries GROUP BY status').all<{ status: string; n: number }>();
  const count = (st: string) => (st === 'all' ? counts.results.reduce((a, r) => a + r.n, 0) : counts.results.find((r) => r.status === st)?.n || 0);
  const s = ctx.s;
  return c.html(
    <AdminLayout
      ctx={ctx}
      title="Enquiries"
      active="enquiries"
      {...flash(c)}
      actions={
        <a class="btn btn-ghost btn-sm" href="/admin/enquiries.csv">
          <Icon name="download" size={16} /> <span class="hide-sm">Export CSV</span>
        </a>
      }
    >
      <div class="tabs">
        {[...ENQ_STATUSES, 'all'].map((st) => (
          <a class={st === status ? 'is-active' : ''} href={`/admin/enquiries?status=${st}`}>
            {st[0].toUpperCase() + st.slice(1)} <em>{count(st)}</em>
          </a>
        ))}
      </div>
      <form class="toolbar" method="get">
        <input type="hidden" name="status" value={status} />
        <input type="search" name="q" value={q} placeholder="Search name, phone, message…" />
        <button class="btn btn-ghost btn-sm" type="submit">
          <Icon name="search" size={16} /> Search
        </button>
      </form>
      {results.length ? (
        <ul class="enquiry-list">
          {results.map((e) => (
            <li class={`enquiry is-${e.status}`}>
              <div class="enq-main">
                <div class="enq-head">
                  <strong>{e.name}</strong> <StatusChip status={e.status} />
                  <small>{fmtDateTime(e.created_at)}</small>
                </div>
                <p class="enq-meta">
                  <a href={telLink(e.phone)}>
                    <Icon name="phone" size={14} /> {e.phone}
                  </a>
                  {e.email ? (
                    <a href={`mailto:${e.email}`}>
                      <Icon name="mail" size={14} /> {e.email}
                    </a>
                  ) : null}
                  {e.room ? (
                    <span>
                      <Icon name="bed-double" size={14} /> {e.room}
                    </span>
                  ) : null}
                  {e.checkin ? (
                    <span>
                      <Icon name="calendar-days" size={14} /> {fmtDate(e.checkin)} → {fmtDate(e.checkout || '')}
                    </span>
                  ) : null}
                  {e.guests ? (
                    <span>
                      <Icon name="users" size={14} /> {e.guests}
                    </span>
                  ) : null}
                </p>
                {e.message ? <p class="enq-msg">{e.message}</p> : null}
              </div>
              <div class="enq-actions">
                <a class="btn btn-whatsapp btn-sm" href={waLink(e.phone, `Hi ${e.name}, thank you for your enquiry at ${s.site.name}.${e.checkin ? ` For ${fmtDate(e.checkin)} to ${fmtDate(e.checkout || '')}` : ''} `)} target="_blank" rel="noopener">
                  <Icon name="whatsapp" size={16} /> Reply
                </a>
                <form method="post" action={`/admin/enquiries/${e.id}/status`} class="inline-form" data-autosubmit>
                  <input type="hidden" name="_csrf" value={ctx.csrf} />
                  <select name="status" aria-label="Status">
                    {ENQ_STATUSES.map((st) => (
                      <option value={st} selected={st === e.status}>
                        {st[0].toUpperCase() + st.slice(1)}
                      </option>
                    ))}
                  </select>
                  <noscript>
                    <button class="btn btn-ghost btn-sm" type="submit">
                      Set
                    </button>
                  </noscript>
                </form>
                <PostButton action={`/admin/enquiries/${e.id}/delete`} csrf={ctx.csrf} label="" icon="trash" title="Delete" class="btn btn-ghost btn-sm danger" confirm="Delete this enquiry?" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div class="empty-state">
          <Icon name="inbox" size={36} />
          <p>Nothing here.</p>
        </div>
      )}
    </AdminLayout>,
  );
});

admin.post('/enquiries/:id{[0-9]+}/status', async (c) => {
  const body = await c.req.parseBody();
  const st = str(body.status, 20);
  if (ENQ_STATUSES.includes(st)) {
    await c.env.DB.prepare('UPDATE enquiries SET status = ? WHERE id = ?').bind(st, Number(c.req.param('id'))).run();
  }
  return c.redirect(safeBack(c.req.header('referer') ? new URL(c.req.header('referer')!).pathname + new URL(c.req.header('referer')!).search : '', '/admin/enquiries'), 303);
});

admin.post('/enquiries/:id{[0-9]+}/delete', async (c) => {
  await c.env.DB.prepare('DELETE FROM enquiries WHERE id = ?').bind(Number(c.req.param('id'))).run();
  await audit(c.env.DB, c.get('user'), 'enquiry.delete', c.req.param('id'), clientIp(c));
  return c.redirect('/admin/enquiries?status=all&ok=deleted', 303);
});

admin.get('/enquiries.csv', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM enquiries ORDER BY id DESC').all<EnquiryRow>();
  // Prefix cells that spreadsheet apps would treat as formulas.
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = ['id', 'created_at', 'status', 'name', 'phone', 'email', 'room', 'checkin', 'checkout', 'guests', 'message'];
  const lines = [head.join(','), ...results.map((r) => head.map((h) => cell((r as unknown as Record<string, unknown>)[h])).join(','))];
  await audit(c.env.DB, c.get('user'), 'enquiry.export', `${results.length} rows`, clientIp(c));
  return c.body('﻿' + lines.join('\r\n'), 200, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="enquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
  });
});

// ---------------------------------------------------------------------------------------------
// Users (owner only)
// ---------------------------------------------------------------------------------------------
admin.get('/users', ownerOnly, async (c) => {
  const ctx = ctxOf(c);
  const { results } = await c.env.DB.prepare('SELECT id, email, name, role, totp_enabled, created_at, last_login_at FROM users ORDER BY id').all<User & { created_at: string; last_login_at: string | null }>();
  return c.html(
    <AdminLayout ctx={ctx} title="Users" active="users" {...flash(c)}>
      <p class="page-desc">Owners can change everything. Editors can manage rooms, posts, pages, photos and enquiries, but not users, security or backups.</p>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>E-mail</th>
              <th>Role</th>
              <th>2-step</th>
              <th>Last sign-in</th>
              <th class="th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.map((u) => (
              <tr>
                <td>
                  <strong>{u.name}</strong>
                  {u.id === ctx.user.id ? <small> (you)</small> : null}
                </td>
                <td>{u.email}</td>
                <td>
                  <StatusChip status={u.role} />
                </td>
                <td>{u.totp_enabled ? <Icon name="shield-check" size={18} /> : '—'}</td>
                <td>{u.last_login_at ? fmtDateTime(u.last_login_at) : 'Never'}</td>
                <td class="row-actions">
                  {u.id !== ctx.user.id ? (
                    <>
                      <PostButton action={`/admin/users/${u.id}/role`} csrf={ctx.csrf} label={u.role === 'owner' ? 'Make editor' : 'Make owner'} fields={{ role: u.role === 'owner' ? 'editor' : 'owner' }} confirm="Change this user's role?" />
                      <details class="inline-details">
                        <summary class="btn btn-ghost btn-sm">Reset password</summary>
                        <form method="post" action={`/admin/users/${u.id}/reset`} class="mini-form">
                          <input type="hidden" name="_csrf" value={ctx.csrf} />
                          <input type="password" name="password" minlength={10} required placeholder="New password (10+)" autocomplete="new-password" />
                          <button class="btn btn-primary btn-sm" type="submit">
                            Set
                          </button>
                        </form>
                      </details>
                      <PostButton action={`/admin/users/${u.id}/delete`} csrf={ctx.csrf} label="" icon="trash" class="btn btn-ghost btn-sm danger" confirm={`Delete ${u.name}'s account?`} />
                    </>
                  ) : (
                    <a class="btn btn-ghost btn-sm" href="/admin/account">
                      My account
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Card title="Add a user">
        <form method="post" action="/admin/users" class="form-grid-admin">
          <input type="hidden" name="_csrf" value={ctx.csrf} />
          <label class="fld">
            <span class="fld-label">Name</span>
            <input type="text" name="name" required maxlength={80} />
          </label>
          <label class="fld">
            <span class="fld-label">E-mail</span>
            <input type="email" name="email" required maxlength={200} autocomplete="off" />
          </label>
          <label class="fld">
            <span class="fld-label">Role</span>
            <select name="role">
              <option value="editor">Editor</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <label class="fld">
            <span class="fld-label">Temporary password (10+ characters)</span>
            <input type="password" name="password" required minlength={10} maxlength={200} autocomplete="new-password" />
          </label>
          <div>
            <button class="btn btn-primary" type="submit">
              <Icon name="plus" size={16} /> Add user
            </button>
          </div>
        </form>
      </Card>
    </AdminLayout>,
  );
});

admin.post('/users', ownerOnly, async (c) => {
  const db = c.env.DB;
  const body = await c.req.parseBody();
  const name = str(body.name, 80);
  const email = str(body.email, 200).toLowerCase();
  const role = body.role === 'owner' ? 'owner' : 'editor';
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.redirect('/admin/users?err=invalid', 303);
  if (passwordProblem(password)) return c.redirect('/admin/users?err=weak', 303);
  const exists = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) return c.redirect('/admin/users?err=email', 303);
  await db.prepare('INSERT INTO users (email, name, role, password_hash) VALUES (?, ?, ?, ?)').bind(email, name, role, await hashPassword(password)).run();
  await audit(db, c.get('user'), 'user.create', `${email} (${role})`, clientIp(c));
  return c.redirect('/admin/users?ok=user', 303);
});

admin.post('/users/:id{[0-9]+}/role', ownerOnly, async (c) => {
  const id = Number(c.req.param('id'));
  if (id === c.get('user').id) return c.redirect('/admin/users?err=self', 303);
  const body = await c.req.parseBody();
  const role = body.role === 'owner' ? 'owner' : 'editor';
  await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();
  await audit(c.env.DB, c.get('user'), 'user.role', `${id} → ${role}`, clientIp(c));
  return c.redirect('/admin/users?ok=user', 303);
});

admin.post('/users/:id{[0-9]+}/reset', ownerOnly, async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  if (passwordProblem(password)) return c.redirect('/admin/users?err=weak', 303);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
  ]);
  await audit(c.env.DB, c.get('user'), 'user.reset-password', String(id), clientIp(c));
  return c.redirect('/admin/users?ok=user', 303);
});

admin.post('/users/:id{[0-9]+}/delete', ownerOnly, async (c) => {
  const id = Number(c.req.param('id'));
  if (id === c.get('user').id) return c.redirect('/admin/users?err=self', 303);
  const target = await c.env.DB.prepare('SELECT role, email FROM users WHERE id = ?').bind(id).first<{ role: string; email: string }>();
  if (target?.role === 'owner') {
    const owners = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'owner'").first<{ n: number }>();
    if ((owners?.n ?? 0) <= 1) return c.redirect('/admin/users?err=last', 303);
  }
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  await audit(c.env.DB, c.get('user'), 'user.delete', target?.email || String(id), clientIp(c));
  return c.redirect('/admin/users?ok=deleted', 303);
});

// ---------------------------------------------------------------------------------------------
// My account: name, password, two-step login, sessions
// ---------------------------------------------------------------------------------------------
admin.get('/account', async (c) => {
  const ctx = ctxOf(c);
  const db = c.env.DB;
  const me = await db.prepare('SELECT totp_secret, totp_enabled FROM users WHERE id = ?').bind(ctx.user.id).first<{ totp_secret: string | null; totp_enabled: number }>();
  const sessions = await db
    .prepare('SELECT id, ip, user_agent, last_seen_at, created_at FROM sessions WHERE user_id = ? AND mfa_pending = 0 ORDER BY last_seen_at DESC')
    .bind(ctx.user.id)
    .all<{ id: string; ip: string; user_agent: string; last_seen_at: number; created_at: number }>();
  const settingUp = !me?.totp_enabled && !!me?.totp_secret && c.req.query('setup') === '1';
  const otpauth = me?.totp_secret
    ? `otpauth://totp/${encodeURIComponent(`${ctx.s.site.name}:${ctx.user.email}`)}?secret=${me.totp_secret}&issuer=${encodeURIComponent(ctx.s.site.name)}`
    : '';
  const ts = (n: number) => fmtDateTime(new Date(n * 1000).toISOString());
  return c.html(
    <AdminLayout ctx={ctx} title="My account & security" active="" {...flash(c)}>
      <div class="grid-2">
        <Card title="Profile">
          <form method="post" action="/admin/account/profile" class="stack">
            <input type="hidden" name="_csrf" value={ctx.csrf} />
            <label class="fld">
              <span class="fld-label">Name</span>
              <input type="text" name="name" value={ctx.user.name} required maxlength={80} />
            </label>
            <label class="fld">
              <span class="fld-label">E-mail (sign-in)</span>
              <input type="email" value={ctx.user.email} disabled />
            </label>
            <div>
              <button class="btn btn-primary btn-sm" type="submit">
                Save
              </button>
            </div>
          </form>
        </Card>
        <Card title="Change password">
          <form method="post" action="/admin/account/password" class="stack">
            <input type="hidden" name="_csrf" value={ctx.csrf} />
            <label class="fld">
              <span class="fld-label">Current password</span>
              <input type="password" name="current" required autocomplete="current-password" />
            </label>
            <label class="fld">
              <span class="fld-label">New password (10+ characters)</span>
              <input type="password" name="password" required minlength={10} autocomplete="new-password" />
            </label>
            <label class="fld">
              <span class="fld-label">Repeat new password</span>
              <input type="password" name="confirm" required minlength={10} autocomplete="new-password" />
            </label>
            <div>
              <button class="btn btn-primary btn-sm" type="submit">
                Change password
              </button>
            </div>
          </form>
        </Card>
      </div>
      <Card title="Two-step login" desc="After your password, sign-in also asks for a 6-digit code from Google Authenticator, Microsoft Authenticator or similar.">
        {me?.totp_enabled ? (
          <>
            <p class="ok-line">
              <Icon name="shield-check" size={18} /> Two-step login is <strong>on</strong>.
            </p>
            <form method="post" action="/admin/account/2fa/disable" class="mini-form">
              <input type="hidden" name="_csrf" value={ctx.csrf} />
              <input type="password" name="password" placeholder="Your password" required autocomplete="current-password" />
              <input type="text" name="code" placeholder="6-digit code" inputmode="numeric" maxlength={7} required />
              <button class="btn btn-ghost btn-sm danger" type="submit">
                Turn off
              </button>
            </form>
          </>
        ) : settingUp ? (
          <div class="totp-setup">
            <div class="qr">{raw(renderSVG(otpauth, { border: 1 }))}</div>
            <ol class="steps">
              <li>Install Google Authenticator (or any authenticator app) on your phone.</li>
              <li>Tap “+” and scan this QR code, or type the key:</li>
              <li class="no-num">
                <code class="secret">{me!.totp_secret!.replace(/(.{4})/g, '$1 ').trim()}</code>
              </li>
              <li>Enter the 6-digit code the app shows:</li>
            </ol>
            <form method="post" action="/admin/account/2fa/enable" class="mini-form">
              <input type="hidden" name="_csrf" value={ctx.csrf} />
              <input type="text" name="code" placeholder="123456" inputmode="numeric" maxlength={7} required autofocus class="code-input" />
              <button class="btn btn-primary btn-sm" type="submit">
                Turn on
              </button>
            </form>
          </div>
        ) : (
          <PostButton action="/admin/account/2fa/start" csrf={ctx.csrf} label="Set up two-step login" icon="shield-check" class="btn btn-primary btn-sm" />
        )}
      </Card>
      <Card title="Signed-in devices" actions={<PostButton action="/admin/account/signout-others" csrf={ctx.csrf} label="Sign out other devices" icon="log-out" />}>
        <ul class="list compact">
          {sessions.results.map((se) => (
            <li>
              <div>
                <strong>{(se.user_agent || 'Unknown device').slice(0, 90)}</strong>
                <small>
                  {se.ip} · signed in {ts(se.created_at)}
                  {se.id === c.get('session').id ? ' · this device' : ''}
                </small>
              </div>
              <small>active {ts(se.last_seen_at)}</small>
            </li>
          ))}
        </ul>
      </Card>
    </AdminLayout>,
  );
});

admin.post('/account/profile', async (c) => {
  const body = await c.req.parseBody();
  const name = str(body.name, 80);
  if (name.length < 2) return c.redirect('/admin/account?err=invalid', 303);
  await c.env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, c.get('user').id).run();
  return c.redirect('/admin/account?ok=saved', 303);
});

admin.post('/account/password', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.parseBody();
  const current = typeof body.current === 'string' ? body.current : '';
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  if (password !== body.confirm) return c.redirect('/admin/account?err=mismatch', 303);
  if (passwordProblem(password)) return c.redirect('/admin/account?err=weak', 303);
  if (!(await rateHit(db, `pw:${user.id}`, 8, 900))) return c.redirect('/admin/account?err=password', 303);
  const row = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first<{ password_hash: string }>();
  if (!(await verifyPassword(current, row?.password_hash))) return c.redirect('/admin/account?err=password', 303);
  await db.batch([
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), user.id),
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(user.id, c.get('session').id),
  ]);
  await audit(db, user, 'account.password', '', clientIp(c));
  return c.redirect('/admin/account?ok=password', 303);
});

admin.post('/account/2fa/start', async (c) => {
  const user = c.get('user');
  if (user.totp_enabled) return c.redirect('/admin/account', 303);
  await c.env.DB.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').bind(newTotpSecret(), user.id).run();
  return c.redirect('/admin/account?setup=1', 303);
});

admin.post('/account/2fa/enable', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.parseBody();
  const row = await db.prepare('SELECT totp_secret FROM users WHERE id = ?').bind(user.id).first<{ totp_secret: string | null }>();
  if (!row?.totp_secret || !(await verifyTotp(row.totp_secret, str(body.code, 10)))) return c.redirect('/admin/account?setup=1&err=code', 303);
  await db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').bind(user.id).run();
  await audit(db, user, 'account.2fa-on', '', clientIp(c));
  return c.redirect('/admin/account?ok=2fa-on', 303);
});

admin.post('/account/2fa/disable', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.parseBody();
  const row = await db.prepare('SELECT password_hash, totp_secret FROM users WHERE id = ?').bind(user.id).first<{ password_hash: string; totp_secret: string | null }>();
  const okPw = await verifyPassword(typeof body.password === 'string' ? body.password : '', row?.password_hash);
  const okCode = !!row?.totp_secret && (await verifyTotp(row.totp_secret, str(body.code, 10)));
  if (!okPw || !okCode) return c.redirect('/admin/account?err=code', 303);
  await db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').bind(user.id).run();
  await audit(db, user, 'account.2fa-off', '', clientIp(c));
  return c.redirect('/admin/account?ok=2fa-off', 303);
});

admin.post('/account/signout-others', async (c) => {
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(c.get('user').id, c.get('session').id).run();
  return c.redirect('/admin/account?ok=signed-out', 303);
});

// ---------------------------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------------------------
admin.get('/activity', async (c) => {
  const ctx = ctxOf(c);
  const { results } = await c.env.DB.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 300').all<Record<string, string>>();
  return c.html(
    <AdminLayout ctx={ctx} title="Activity log" active="activity" {...flash(c)}>
      <p class="page-desc">The last 300 sign-ins and changes, newest first.</p>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>When (UTC)</th>
              <th>Who</th>
              <th>What</th>
              <th>Details</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {results.map((a) => (
              <tr class={a.action === 'login.failed' ? 'row-warn' : ''}>
                <td>{fmtDateTime(a.created_at)}</td>
                <td>{a.user_name || '—'}</td>
                <td>
                  <code>{a.action}</code>
                </td>
                <td>{a.detail}</td>
                <td>{a.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>,
  );
});

// ---------------------------------------------------------------------------------------------
// Backup & restore (owner only) — content as JSON; uploaded files stay in R2
// ---------------------------------------------------------------------------------------------
admin.get('/backup', ownerOnly, (c) => {
  const ctx = ctxOf(c);
  return c.html(
    <AdminLayout ctx={ctx} title="Backup & restore" active="backup" {...flash(c)}>
      <div class="grid-2">
        <Card title="Download a backup" desc="All settings, rooms, posts, pages, enquiries and the media list as one JSON file. Uploaded photos stay safely in storage.">
          <a class="btn btn-primary" href="/admin/backup/export">
            <Icon name="download" size={16} /> Download backup
          </a>
        </Card>
        <Card title="Restore from a backup" desc="Replaces all settings, rooms, posts and pages with the file's contents. Enquiries and users are not changed.">
          <form method="post" action="/admin/backup/import" enctype="multipart/form-data" class="stack" data-confirm="Restore this backup? Current content will be replaced.">
            <input type="hidden" name="_csrf" value={ctx.csrf} />
            <input type="file" name="file" accept="application/json,.json" required />
            <label class="check">
              <input type="checkbox" name="confirm" value="yes" /> I understand current content will be replaced
            </label>
            <div>
              <button class="btn btn-primary" type="submit">
                <Icon name="upload" size={16} /> Restore
              </button>
            </div>
          </form>
        </Card>
      </div>
    </AdminLayout>,
  );
});

admin.get('/backup/export', ownerOnly, async (c) => {
  const db = c.env.DB;
  const [settings, rooms, posts, pages, media, enquiries] = await Promise.all([
    db.prepare("SELECT key, value FROM settings WHERE key != '_seeded'").all<{ key: string; value: string }>(),
    db.prepare('SELECT * FROM rooms').all(),
    db.prepare('SELECT * FROM posts').all(),
    db.prepare('SELECT * FROM pages').all(),
    db.prepare('SELECT * FROM media').all(),
    db.prepare('SELECT * FROM enquiries').all(),
  ]);
  const data = {
    format: 'vp-residency-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: Object.fromEntries(settings.results.map((r) => [r.key, parseJson(r.value, null)])),
    rooms: rooms.results,
    posts: posts.results,
    pages: pages.results,
    media: media.results,
    enquiries: enquiries.results,
  };
  await audit(db, c.get('user'), 'backup.export', '', clientIp(c));
  return c.body(JSON.stringify(data, null, 1), 200, {
    'content-type': 'application/json; charset=utf-8',
    'content-disposition': `attachment; filename="vp-residency-backup-${new Date().toISOString().slice(0, 10)}.json"`,
  });
});

admin.post('/backup/import', ownerOnly, async (c) => {
  const db = c.env.DB;
  const body = await c.req.parseBody();
  if (body.confirm !== 'yes') return c.redirect('/admin/backup?err=confirm', 303);
  const file = body.file;
  if (!(file instanceof File) || file.size > 20e6) return c.redirect('/admin/backup?err=file', 303);
  const data = parseJson<{ format?: string; settings?: Record<string, unknown>; rooms?: Record<string, unknown>[]; posts?: Record<string, unknown>[]; pages?: Record<string, unknown>[] }>(await file.text(), {});
  if (data.format !== 'vp-residency-backup' || !data.settings) return c.redirect('/admin/backup?err=file', 303);
  const stmts: D1PreparedStatement[] = [];
  // Settings go through the same validation as the editor.
  for (const key of SETTINGS_KEYS) {
    if (data.settings[key] === undefined) continue;
    const value = coerce(SETTINGS_FORMS[key].schema, data.settings[key]);
    stmts.push(
      db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(key, JSON.stringify(value)),
    );
  }
  for (const ent of Object.values(ENTITIES)) {
    const rows = (data[ent.key] as Record<string, unknown>[] | undefined) || [];
    stmts.push(db.prepare(`DELETE FROM ${ent.key}`));
    for (const r of rows.slice(0, 2000)) {
      const value = coerce(ent.schema, { ...parseJson<Record<string, unknown>>(String(r.data || '{}'), {}), slug: r.slug, status: r.status });
      const slug = slugify(String(r.slug || value[ent.nameField] || ent.singular));
      value.slug = slug;
      const cols = { slug, ...ent.columns({ ...value, [ent.nameField]: value[ent.nameField] || r[ent.nameField] }), data: JSON.stringify(value) };
      const names = Object.keys(cols);
      stmts.push(db.prepare(`INSERT OR IGNORE INTO ${ent.key} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`).bind(...Object.values(cols)));
    }
  }
  await db.batch(stmts);
  await audit(db, c.get('user'), 'backup.import', file.name, clientIp(c));
  return c.redirect('/admin/backup?ok=imported', 303);
});

export default admin;
