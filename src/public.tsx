import { Hono, type Context } from 'hono';
import type { Child } from 'hono/jsx';
import type { AppEnv, PageRow, PostRow, RoomRow } from './types';
import { readSession } from './lib/auth';
import { parsePage, parsePost, parseRoom, publishedPages, publishedPosts, publishedRooms, roomCover, nowIst } from './lib/content';
import { absUrl, breadcrumbJsonLd, siteOrigin, type Meta } from './lib/seo';
import { activeFestival } from './lib/festivals';
import { clientIp, rateHit, verifyTurnstile } from './lib/security';
import { RESERVED_SLUGS } from './lib/schemas';
import { mediaStore } from './lib/storage';
import { digits, isDate, plainText, safeBack, truncate } from './lib/util';
import { Layout } from './views/layout';
import { HomePage } from './views/home';
import { BlogPage, ContactPage, CustomPage, GalleryPage, NotFoundPage, PostPage, RoomPage, RoomsPage, type RoomSearch } from './views/pages';

const pub = new Hono<AppEnv>();

export function festivalFor(c: Context<AppEnv>) {
  const preview = (c.req.query('festival') || '').slice(0, 40);
  return activeFestival(c.get('s'), preview || null);
}

export function renderPage(c: Context<AppEnv>, meta: Meta, body: Child, status: 200 | 404 = 200) {
  const s = c.get('s');
  const html = (
    <Layout s={s} nonce={c.get('nonce')} origin={siteOrigin(s, c.req.url)} meta={meta} festival={festivalFor(c)} preview={c.req.query('preview') === '1'}>
      {body}
    </Layout>
  );
  return c.html(html, status);
}

export function notFound(c: Context<AppEnv>) {
  return renderPage(c, { title: 'Page not found', path: c.req.path, noindex: true }, <NotFoundPage s={c.get('s')} />, 404);
}

const ENQUIRY_ERRORS: Record<string, string> = {
  name: 'Please enter your name.',
  phone: 'Please enter a valid phone number (10 digits).',
  dates: 'Check-out must be after check-in.',
  captcha: 'Please complete the security check and try again.',
  rate: 'Too many enquiries from your connection. Please call or WhatsApp us instead.',
  closed: 'Online enquiries are paused. Please call or WhatsApp us.',
};

function withParam(path: string, key: string, value: string): string {
  const u = new URL(path, 'http://x');
  u.searchParams.delete('sent');
  u.searchParams.delete('err');
  u.searchParams.set(key, value);
  return u.pathname + u.search;
}

async function isAdmin(c: Context<AppEnv>): Promise<boolean> {
  const auth = await readSession(c);
  return !!auth && !auth.session.mfa_pending;
}

// ---------------------------------------------------------------------------------------------
pub.get('/', async (c) => {
  const s = c.get('s');
  const [rooms, { posts }] = await Promise.all([publishedRooms(c.env.DB), publishedPosts(c.env.DB, { limit: s.home.blog.limit })]);
  return renderPage(c, { title: s.seo.homeTitle, rawTitle: true, path: '/' }, <HomePage s={s} rooms={rooms} posts={posts} festival={festivalFor(c)} />);
});

pub.get('/rooms', async (c) => {
  const s = c.get('s');
  const qp = c.req.query();
  const q: RoomSearch = {
    checkin: isDate(qp.checkin) ? qp.checkin : '',
    checkout: isDate(qp.checkout) ? qp.checkout : '',
    guests: Math.min(20, Math.max(0, parseInt(qp.guests || '0', 10) || 0)),
    type: qp.type === 'ac' || qp.type === 'nonac' ? qp.type : '',
    sort: s.booking.showPrices && (qp.sort === 'price_asc' || qp.sort === 'price_desc') ? qp.sort : '',
  };
  if (q.checkin && q.checkout && q.checkout <= q.checkin) q.checkout = '';
  const rooms = await publishedRooms(c.env.DB);
  const origin = siteOrigin(s, c.req.url);
  return renderPage(
    c,
    {
      title: s.booking.showPrices ? 'Rooms & Prices' : 'Our Rooms',
      description: `AC and Non-AC rooms at ${s.site.name}, ${s.site.city}. Check prices and availability, then book on WhatsApp or by phone.`,
      path: '/rooms',
      jsonLd: [breadcrumbJsonLd(origin, [{ name: 'Home', path: '/' }, { name: 'Rooms', path: '/rooms' }])],
    },
    <RoomsPage s={s} rooms={rooms} q={q} />,
  );
});

pub.get('/rooms/:slug', async (c) => {
  const s = c.get('s');
  const row = await c.env.DB.prepare('SELECT * FROM rooms WHERE slug = ?').bind(c.req.param('slug')).first<RoomRow>();
  if (!row || (row.status !== 'published' && !(await isAdmin(c)))) return notFound(c);
  const room = parseRoom(row);
  const all = await publishedRooms(c.env.DB);
  const qp = c.req.query();
  let checkin = isDate(qp.checkin) ? qp.checkin : '';
  let checkout = isDate(qp.checkout) ? qp.checkout : '';
  if (checkin && checkout && checkout <= checkin) checkout = '';
  const origin = siteOrigin(s, c.req.url);
  const description = room.seoDescription || room.shortDesc || truncate(plainText(room.description), 160);
  return renderPage(
    c,
    {
      title: room.seoTitle || `${room.name} in ${s.site.city}`,
      description,
      image: room.ogImage || roomCover(room),
      path: `/rooms/${room.slug}`,
      noindex: room.status !== 'published',
      jsonLd: [
        breadcrumbJsonLd(origin, [{ name: 'Home', path: '/' }, { name: 'Rooms', path: '/rooms' }, { name: room.name, path: `/rooms/${room.slug}` }]),
        {
          '@context': 'https://schema.org',
          '@type': 'HotelRoom',
          name: room.name,
          description,
          image: room.images.map((i) => absUrl(origin, i)),
          bed: room.beds || undefined,
          occupancy: { '@type': 'QuantitativeValue', maxValue: room.maxAdults + room.maxChildren },
          amenityFeature: room.amenities.map((a) => ({ '@type': 'LocationFeatureSpecification', name: a.label, value: true })),
          containedInPlace: { '@id': origin + '/#business' },
        },
      ],
    },
    <RoomPage
      s={s}
      room={room}
      others={all.filter((r) => r.id !== room.id).slice(0, 3)}
      allRooms={all}
      checkin={checkin}
      checkout={checkout}
      guests={Math.min(20, parseInt(qp.guests || '0', 10) || 0)}
      sent={qp.sent === '1'}
      error={ENQUIRY_ERRORS[qp.err || ''] || ''}
      back={`/rooms/${room.slug}`}
    />,
  );
});

pub.get('/gallery', (c) => {
  const s = c.get('s');
  return renderPage(c, { title: 'Photo Gallery', description: `Photos of rooms and facilities at ${s.site.name}, ${s.site.city}.`, path: '/gallery' }, <GalleryPage s={s} />);
});

pub.get('/blog', async (c) => {
  const s = c.get('s');
  const perPage = 9;
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const tag = (c.req.query('tag') || '').slice(0, 60).toLowerCase();
  const q = (c.req.query('q') || '').slice(0, 80).trim();
  const { posts, total } = await publishedPosts(c.env.DB, { limit: perPage, offset: (page - 1) * perPage, tag, q });
  const tagRows = await c.env.DB.prepare("SELECT tags FROM posts WHERE status = 'published' AND published_at <= ?").bind(nowIst()).all<{ tags: string }>();
  const tags = [...new Set(tagRows.results.flatMap((r) => r.tags.split(',').filter(Boolean)))].sort();
  return renderPage(
    c,
    { title: tag ? `Blog: ${tag}` : 'Blog', description: `Travel tips, local guides and news from ${s.site.name}, ${s.site.city}.`, path: '/blog', noindex: !!(q || page > 1 && !posts.length) },
    <BlogPage s={s} posts={posts} page={page} pages={Math.max(1, Math.ceil(total / perPage))} tag={tag} q={q} tags={tags} />,
  );
});

pub.get('/blog/:slug', async (c) => {
  const s = c.get('s');
  const row = await c.env.DB.prepare('SELECT * FROM posts WHERE slug = ?').bind(c.req.param('slug')).first<PostRow>();
  const live = row && row.status === 'published' && (row.published_at || '') <= nowIst();
  if (!row || (!live && !(await isAdmin(c)))) return notFound(c);
  const post = parsePost(row);
  const { posts: latest } = await publishedPosts(c.env.DB, { limit: 4 });
  const related = latest.filter((p) => p.id !== post.id).slice(0, 3);
  const origin = siteOrigin(s, c.req.url);
  const url = `${origin}/blog/${post.slug}`;
  const description = post.seoDescription || post.excerpt || truncate(plainText(post.body), 160);
  return renderPage(
    c,
    {
      title: post.seoTitle || post.title,
      description,
      image: post.ogImage || post.cover,
      path: `/blog/${post.slug}`,
      type: 'article',
      noindex: !live,
      publishedAt: post.publishedAt ? post.publishedAt.replace(' ', 'T') + ':00+05:30' : undefined,
      jsonLd: [
        breadcrumbJsonLd(origin, [{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: post.title, path: `/blog/${post.slug}` }]),
        {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description,
          image: post.cover ? [absUrl(origin, post.cover)] : undefined,
          datePublished: post.publishedAt ? post.publishedAt.replace(' ', 'T') + ':00+05:30' : undefined,
          dateModified: post.updatedAt.replace(' ', 'T') + 'Z',
          author: { '@type': post.author && post.author !== s.site.name ? 'Person' : 'Organization', name: post.author || s.site.name },
          publisher: { '@id': origin + '/#business' },
          mainEntityOfPage: url,
        },
      ],
    },
    <PostPage s={s} post={post} related={related} url={url} />,
  );
});

pub.get('/contact', async (c) => {
  const s = c.get('s');
  const rooms = await publishedRooms(c.env.DB);
  return renderPage(
    c,
    { title: 'Contact & Directions', description: `Call ${s.site.phone}, WhatsApp or visit ${s.site.name} at ${s.site.addressLine1}, ${s.site.city}.`, path: '/contact' },
    <ContactPage s={s} rooms={rooms} sent={c.req.query('sent') === '1'} error={ENQUIRY_ERRORS[c.req.query('err') || ''] || ''} />,
  );
});

pub.post('/enquiry', async (c) => {
  const s = c.get('s');
  const db = c.env.DB;
  const form = await c.req.parseBody();
  const field = (k: string, max: number) => (typeof form[k] === 'string' ? (form[k] as string).trim().slice(0, max) : '');
  const back = safeBack(field('_back', 300), '/contact');
  const fail = (code: string) => c.redirect(withParam(back, 'err', code) + '#enquiry', 303);
  const ok = () => c.redirect(withParam(back, 'sent', '1') + '#enquiry', 303);

  if (!s.booking.enquiryEnabled) return fail('closed');
  // Spam traps: a hidden field humans never fill, and forms submitted faster than a person can type.
  if (field('website', 200)) return ok();
  const ft = Number(field('ft', 20));
  if (ft && Date.now() - ft < 2500) return ok();

  const name = field('name', 80);
  const phone = field('phone', 20);
  const email = field('email', 120);
  let checkin = field('checkin', 10);
  let checkout = field('checkout', 10);
  if (!isDate(checkin)) checkin = '';
  if (!isDate(checkout)) checkout = '';
  if (name.length < 2) return fail('name');
  const d = digits(phone);
  if (d.length < 10 || d.length > 15) return fail('phone');
  if (checkin && checkout && checkout <= checkin) return fail('dates');

  if (s.security.protectEnquiry && s.security.turnstileSiteKey && s.security.turnstileSecret) {
    const passed = await verifyTurnstile(s.security.turnstileSecret, field('cf-turnstile-response', 2048), clientIp(c));
    if (!passed) return fail('captcha');
  }
  if (!(await rateHit(db, `enq:${clientIp(c)}`, 5, 3600))) return fail('rate');

  await db
    .prepare('INSERT INTO enquiries (name, phone, email, checkin, checkout, guests, room, message, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(
      name, phone, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '', checkin || null, checkout || null,
      Math.min(50, parseInt(field('guests', 3), 10) || 0) || null, field('room', 80), field('message', 1000), clientIp(c),
    )
    .run();
  return ok();
});

// ---------------------------------------------------------------------------------------------
// Files served from R2 (uploads).
// ---------------------------------------------------------------------------------------------
pub.get('/media/*', async (c) => {
  const key = decodeURIComponent(c.req.path.slice('/media/'.length));
  if (!/^[\w\-./]+$/.test(key) || key.includes('..')) return c.text('Not found', 404);
  const rangeHeader = c.req.header('range') || '';
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  let range: { offset: number; length?: number; suffix?: number } | null = null;
  if (m && (m[1] || m[2])) {
    if (m[1]) range = { offset: Number(m[1]), length: m[2] ? Number(m[2]) - Number(m[1]) + 1 : undefined };
    else range = { offset: 0, suffix: Number(m[2]) };
  }
  const file = await mediaStore(c.env).get(key, range);
  if (!file) return c.text('Not found', 404);
  const headers = new Headers({
    'content-type': file.mime,
    etag: file.etag,
    'cache-control': 'public, max-age=31536000, immutable',
    'accept-ranges': 'bytes',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'content-length': String(file.length),
  });
  if (!range && c.req.header('if-none-match') === file.etag) return new Response(null, { status: 304, headers });
  if (range) {
    headers.set('content-range', `bytes ${file.offset}-${file.offset + file.length - 1}/${file.size}`);
    return new Response(file.body, { status: 206, headers });
  }
  return new Response(file.body, { headers });
});

// ---------------------------------------------------------------------------------------------
// SEO files
// ---------------------------------------------------------------------------------------------
pub.get('/robots.txt', (c) => {
  const s = c.get('s');
  const origin = siteOrigin(s, c.req.url);
  const lines = ['User-agent: *', s.seo.allowIndexing ? 'Allow: /' : 'Disallow: /', 'Disallow: /admin', ''];
  if (s.seo.robotsExtra) lines.push(s.seo.robotsExtra.replace(/\r/g, ''), '');
  lines.push(`Sitemap: ${origin}/sitemap.xml`, '');
  return c.text(lines.join('\n'), 200, { 'cache-control': 'public, max-age=3600' });
});

pub.get('/sitemap.xml', async (c) => {
  const s = c.get('s');
  const origin = siteOrigin(s, c.req.url);
  const [rooms, posts, pages] = await Promise.all([
    publishedRooms(c.env.DB),
    publishedPosts(c.env.DB, { limit: 1000 }),
    publishedPages(c.env.DB),
  ]);
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const day = (v: string) => (v || '').slice(0, 10);
  const urls: { loc: string; lastmod?: string; priority: string }[] = [
    { loc: '/', priority: '1.0' },
    { loc: '/rooms', priority: '0.9' },
    { loc: '/gallery', priority: '0.6' },
    { loc: '/blog', priority: '0.6' },
    { loc: '/contact', priority: '0.8' },
    ...rooms.map((r) => ({ loc: `/rooms/${r.slug}`, lastmod: day(r.updatedAt), priority: '0.8' })),
    ...posts.posts.map((p) => ({ loc: `/blog/${p.slug}`, lastmod: day(p.updatedAt), priority: '0.5' })),
    ...pages.filter((p) => !p.noindex).map((p) => ({ loc: `/${p.slug}`, lastmod: day(p.updatedAt), priority: '0.4' })),
  ];
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map((u) => `  <url><loc>${esc(origin + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`)
      .join('\n') +
    '\n</urlset>\n';
  return c.body(xml, 200, { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' });
});

pub.get('/site.webmanifest', (c) => {
  const s = c.get('s');
  const icon = s.site.favicon || '/assets/favicon.svg';
  return c.json(
    {
      name: s.site.name,
      short_name: s.site.name.slice(0, 12),
      start_url: '/',
      display: 'browser',
      background_color: s.theme.bg,
      theme_color: s.theme.primary,
      icons: [{ src: icon, sizes: 'any', type: icon.endsWith('.svg') ? 'image/svg+xml' : undefined }],
    },
    200,
    { 'content-type': 'application/manifest+json' },
  );
});

// ---------------------------------------------------------------------------------------------
// Custom pages (/about, /privacy-policy …) — keep last.
// ---------------------------------------------------------------------------------------------
pub.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  if (RESERVED_SLUGS.has(slug)) return notFound(c);
  const row = await c.env.DB.prepare('SELECT * FROM pages WHERE slug = ?').bind(slug).first<PageRow>();
  if (!row || (row.status !== 'published' && !(await isAdmin(c)))) return notFound(c);
  const s = c.get('s');
  const page = parsePage(row);
  const rooms = page.showEnquiry ? await publishedRooms(c.env.DB) : [];
  return renderPage(
    c,
    {
      title: page.seoTitle || page.title,
      description: page.seoDescription || page.subtitle || truncate(plainText(page.body), 160),
      image: page.ogImage || page.cover,
      path: `/${page.slug}`,
      noindex: page.noindex || page.status !== 'published',
    },
    <CustomPage s={s} page={page} rooms={rooms} sent={c.req.query('sent') === '1'} error={ENQUIRY_ERRORS[c.req.query('err') || ''] || ''} />,
  );
});

export default pub;
