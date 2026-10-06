import { raw } from 'hono/html';
import type { Child } from 'hono/jsx';
import type { Settings } from '../lib/defaults';
import { Icon } from '../lib/icons';
import type { FormSchema } from '../lib/schemas';
import { scriptJson } from '../lib/util';
import type { User } from '../types';

export const ADMIN_ASSET_VERSION = '5';

type NavItem = { key: string; label: string; icon: string; href: string; owner?: boolean; badge?: boolean };
const NAV: { group: string; items: NavItem[] }[] = [
  { group: '', items: [{ key: 'dashboard', label: 'Dashboard', icon: 'gauge', href: '/admin' }] },
  {
    group: 'Content',
    items: [
      { key: 'rooms', label: 'Rooms', icon: 'bed-double', href: '/admin/rooms' },
      { key: 'posts', label: 'Blog posts', icon: 'newspaper', href: '/admin/posts' },
      { key: 'pages', label: 'Pages', icon: 'files', href: '/admin/pages' },
      { key: 'gallery', label: 'Gallery', icon: 'images', href: '/admin/settings/gallery' },
      { key: 'media', label: 'Media library', icon: 'image', href: '/admin/media' },
    ],
  },
  {
    group: 'Homepage',
    items: [
      { key: 'home', label: 'Home page', icon: 'house', href: '/admin/settings/home' },
      { key: 'offers', label: 'Offers', icon: 'badge-percent', href: '/admin/settings/offers' },
      { key: 'testimonials', label: 'Guest reviews', icon: 'quote', href: '/admin/settings/testimonials' },
      { key: 'faqs', label: 'FAQs', icon: 'circle-question-mark', href: '/admin/settings/faqs' },
      { key: 'amenities', label: 'Amenities', icon: 'concierge-bell', href: '/admin/settings/amenities' },
    ],
  },
  {
    group: 'Appearance',
    items: [
      { key: 'theme', label: 'Theme & fonts', icon: 'palette', href: '/admin/settings/theme' },
      { key: 'festivals', label: 'Festival themes', icon: 'party-popper', href: '/admin/settings/festivals' },
      { key: 'nav', label: 'Menu & footer', icon: 'list', href: '/admin/settings/nav' },
      { key: 'announcement', label: 'Announcement bar', icon: 'megaphone', href: '/admin/settings/announcement' },
    ],
  },
  {
    group: 'Settings',
    items: [
      { key: 'site', label: 'Business info', icon: 'building', href: '/admin/settings/site' },
      { key: 'booking', label: 'Booking & prices', icon: 'calendar-days', href: '/admin/settings/booking' },
      { key: 'seo', label: 'SEO & Search Console', icon: 'globe', href: '/admin/settings/seo' },
      { key: 'cookies', label: 'Cookies & privacy', icon: 'cookie', href: '/admin/settings/cookies' },
    ],
  },
  { group: 'Inbox', items: [{ key: 'enquiries', label: 'Enquiries', icon: 'inbox', href: '/admin/enquiries', badge: true }] },
  {
    group: 'System',
    items: [
      { key: 'users', label: 'Users', icon: 'users', href: '/admin/users', owner: true },
      { key: 'security', label: 'Security', icon: 'shield-check', href: '/admin/settings/security', owner: true },
      { key: 'activity', label: 'Activity log', icon: 'rotate-ccw-clock', href: '/admin/activity' },
      { key: 'backup', label: 'Backup & restore', icon: 'database', href: '/admin/backup', owner: true },
    ],
  },
];

const FLASH_OK: Record<string, string> = {
  saved: 'Changes saved — they are live on the website now.',
  created: 'Created.',
  deleted: 'Deleted.',
  duplicated: 'Copy created as a draft.',
  uploaded: 'Uploaded.',
  password: 'Password changed. Other devices were signed out.',
  '2fa-on': 'Two-step login is now on.',
  '2fa-off': 'Two-step login is now off.',
  imported: 'Backup restored.',
  'signed-out': 'Signed out of all other devices.',
  user: 'User saved.',
  status: 'Status updated.',
};
const FLASH_ERR: Record<string, string> = {
  invalid: 'Something in the form was not valid. Please check and try again.',
  required: 'Please fill in the required fields.',
  slug: 'That web address is already used or reserved. Choose another.',
  password: 'Current password is incorrect.',
  weak: 'Choose a stronger password (at least 10 characters).',
  mismatch: 'The new passwords do not match.',
  code: 'That code was not correct. Try again.',
  email: 'That e-mail is already used by another account.',
  self: 'You cannot delete your own account.',
  last: 'There must always be at least one owner.',
  file: 'Please choose a valid backup file.',
  confirm: 'Tick the confirmation box first.',
  notfound: 'Not found — it may have been deleted.',
};

export type AdminCtx = { user: User; csrf: string; s: Settings; newEnquiries: number; nonce: string };

export function AdminLayout(props: {
  ctx: AdminCtx;
  title: string;
  active: string;
  ok?: string;
  err?: string;
  actions?: Child;
  wide?: boolean;
  children?: Child;
}) {
  const { ctx } = props;
  const okMsg = props.ok ? FLASH_OK[props.ok] : '';
  const errMsg = props.err ? FLASH_ERR[props.err] || props.err : '';
  return (
    <>
      {raw('<!doctype html>')}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex, nofollow" />
          <meta name="csrf-token" content={ctx.csrf} />
          <title>{props.title} · Admin · {ctx.s.site.name}</title>
          <link rel="icon" href={ctx.s.site.favicon || '/brand/icon-192.png'} />
          <link rel="stylesheet" href={`/assets/admin.css?v=${ADMIN_ASSET_VERSION}`} />
          <script src={`/assets/admin.js?v=${ADMIN_ASSET_VERSION}`} defer></script>
        </head>
        <body class="admin">
          <aside class="sidebar" id="sidebar" data-sidebar>
            <a class="side-brand" href="/admin">
              {ctx.s.site.logo ? <img src={ctx.s.site.logo} alt="" /> : <Icon name="hotel" size={26} />}
              <span>
                <strong>{ctx.s.site.name}</strong>
                <small>Admin panel</small>
              </span>
            </a>
            <nav class="side-nav" aria-label="Admin">
              {NAV.map((g) => {
                const items = g.items.filter((i) => !i.owner || ctx.user.role === 'owner');
                if (!items.length) return null;
                return (
                  <div class="side-group">
                    {g.group ? <p class="side-title">{g.group}</p> : null}
                    <ul>
                      {items.map((i) => (
                        <li>
                          <a href={i.href} class={props.active === i.key ? 'is-active' : ''} aria-current={props.active === i.key ? 'page' : undefined}>
                            <Icon name={i.icon} size={18} /> <span>{i.label}</span>
                            {i.badge && ctx.newEnquiries ? <em class="badge">{ctx.newEnquiries}</em> : null}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </nav>
          </aside>
          <div class="side-scrim" data-side-scrim></div>
          <div class="main">
            <header class="topbar">
              <button type="button" class="icon-btn side-toggle" data-side-toggle aria-label="Menu">
                <Icon name="menu" size={22} />
              </button>
              <h1>{props.title}</h1>
              <div class="top-actions">
                {props.actions}
                <a class="btn btn-ghost btn-sm" href="/" target="_blank" rel="noopener">
                  <Icon name="external-link" size={16} /> <span class="hide-sm">View site</span>
                </a>
                <details class="user-menu">
                  <summary>
                    <span class="avatar">{ctx.user.name.charAt(0).toUpperCase()}</span>
                    <span class="hide-sm">{ctx.user.name}</span>
                    <Icon name="chevron-down" size={16} />
                  </summary>
                  <div class="menu">
                    <p class="menu-head">
                      {ctx.user.email}
                      <small>{ctx.user.role === 'owner' ? 'Owner' : 'Editor'}</small>
                    </p>
                    <a href="/admin/account">
                      <Icon name="key" size={16} /> My account & security
                    </a>
                    <form method="post" action="/admin/logout">
                      <input type="hidden" name="_csrf" value={ctx.csrf} />
                      <button type="submit">
                        <Icon name="log-out" size={16} /> Sign out
                      </button>
                    </form>
                  </div>
                </details>
              </div>
            </header>
            <main class={`content${props.wide ? ' is-wide' : ''}`}>
              {okMsg ? (
                <div class="flash flash-ok" role="status" data-flash>
                  <Icon name="circle-check" size={18} /> {okMsg}
                </div>
              ) : null}
              {errMsg ? (
                <div class="flash flash-err" role="alert">
                  <Icon name="triangle-alert" size={18} /> {errMsg}
                </div>
              ) : null}
              {props.children}
            </main>
          </div>
          <div class="toast" data-toast hidden></div>
        </body>
      </html>
    </>
  );
}

/** A form whose fields are drawn by admin.js from the schema; posts the result as JSON in `payload`. */
export function SchemaForm(props: {
  action: string;
  csrf: string;
  schema: FormSchema;
  value: unknown;
  submit?: string;
  extra?: Child;
  meta?: Record<string, unknown>;
}) {
  return (
    <form method="post" action={props.action} class="schema-form" data-schema-form novalidate>
      <input type="hidden" name="_csrf" value={props.csrf} />
      <input type="hidden" name="payload" value="" />
      <script type="application/json" data-schema>
        {raw(scriptJson(props.schema))}
      </script>
      <script type="application/json" data-value>
        {raw(scriptJson(props.value))}
      </script>
      {props.meta ? (
        <script type="application/json" data-meta>
          {raw(scriptJson(props.meta))}
        </script>
      ) : null}
      <div class="form-root" data-form-root>
        <p class="loading">Loading editor…</p>
        <noscript>
          <p class="flash flash-err">The editor needs JavaScript. Please enable it in your browser.</p>
        </noscript>
      </div>
      <div class="form-bar">
        <span class="dirty-note" data-dirty-note hidden>
          Unsaved changes
        </span>
        {props.extra}
        <button class="btn btn-primary" type="submit">
          <Icon name="check" size={18} /> {props.submit || 'Save changes'}
        </button>
      </div>
    </form>
  );
}

export function PostButton(props: {
  action: string;
  csrf: string;
  label: string;
  icon?: string;
  confirm?: string;
  class?: string;
  fields?: Record<string, string>;
  title?: string;
}) {
  return (
    <form method="post" action={props.action} class="inline-form" data-confirm={props.confirm}>
      <input type="hidden" name="_csrf" value={props.csrf} />
      {Object.entries(props.fields || {}).map(([k, v]) => (
        <input type="hidden" name={k} value={v} />
      ))}
      <button type="submit" class={props.class || 'btn btn-ghost btn-sm'} title={props.title}>
        {props.icon ? <Icon name={props.icon} size={16} /> : null}
        {props.label ? <span>{props.label}</span> : null}
      </button>
    </form>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: 'chip-green', draft: 'chip-grey', new: 'chip-blue', contacted: 'chip-amber', booked: 'chip-green', closed: 'chip-grey',
    scheduled: 'chip-amber', owner: 'chip-maroon', editor: 'chip-grey', live: 'chip-green', upcoming: 'chip-blue', off: 'chip-grey',
  };
  return <span class={`chip ${map[status] || 'chip-grey'}`}>{status}</span>;
}

export function Card(props: { title?: string; desc?: string; actions?: Child; class?: string; children?: Child }) {
  return (
    <section class={`card ${props.class || ''}`}>
      {props.title || props.actions ? (
        <div class="card-head">
          <div>
            {props.title ? <h2>{props.title}</h2> : null}
            {props.desc ? <p>{props.desc}</p> : null}
          </div>
          {props.actions}
        </div>
      ) : null}
      {props.children}
    </section>
  );
}

export function AuthShell(props: { s: Settings; title: string; children?: Child }) {
  return (
    <>
      {raw('<!doctype html>')}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex, nofollow" />
          <title>{props.title} · {props.s.site.name}</title>
          <link rel="icon" href={props.s.site.favicon || '/brand/icon-192.png'} />
          <link rel="stylesheet" href={`/assets/admin.css?v=${ADMIN_ASSET_VERSION}`} />
        </head>
        <body class="auth">
          <div class="auth-bg" aria-hidden="true"></div>
          <main class="auth-card">
            <a class="auth-brand" href="/">
              {props.s.site.logo ? <img src={props.s.site.logo} alt={props.s.site.name} /> : <strong>{props.s.site.name}</strong>}
            </a>
            {props.children}
          </main>
        </body>
      </html>
    </>
  );
}
