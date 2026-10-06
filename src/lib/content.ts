import type { PageRow, PostRow, RoomRow } from '../types';
import type { Settings } from './defaults';
import { fontStack } from './fonts';
import { isDate, parseJson } from './util';

type Json = Record<string, any>;

export function parseRoom(row: RoomRow) {
  const d = parseJson<Json>(row.data, {});
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    featured: !!row.featured,
    sort: row.sort,
    ac: row.ac === 1,
    price: row.price,
    maxGuests: row.max_guests,
    category: String(d.category || ''),
    originalPrice: Number(d.originalPrice || 0),
    maxAdults: Number(d.maxAdults || 2),
    maxChildren: Number(d.maxChildren || 0),
    roomCount: Number(d.roomCount || 1),
    beds: String(d.beds || ''),
    size: String(d.size || ''),
    images: (Array.isArray(d.images) ? d.images : []) as string[],
    shortDesc: String(d.shortDesc || ''),
    description: String(d.description || ''),
    highlights: (Array.isArray(d.highlights) ? d.highlights : []) as string[],
    amenities: (Array.isArray(d.amenities) ? d.amenities : []) as { icon: string; label: string }[],
    soldOut: !!d.soldOut,
    blocked: (Array.isArray(d.blocked) ? d.blocked : []) as { from: string; to: string; note: string }[],
    bookingUrl: String(d.bookingUrl || ''),
    seoTitle: String(d.seoTitle || ''),
    seoDescription: String(d.seoDescription || ''),
    ogImage: String(d.ogImage || ''),
    updatedAt: row.updated_at,
  };
}
export type Room = ReturnType<typeof parseRoom>;

export function parsePost(row: PostRow) {
  const d = parseJson<Json>(row.data, {});
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    publishedAt: row.published_at || '',
    tags: row.tags ? row.tags.split(',').filter(Boolean) : [],
    cover: String(d.cover || ''),
    excerpt: String(d.excerpt || ''),
    body: String(d.body || ''),
    author: String(d.author || ''),
    seoTitle: String(d.seoTitle || ''),
    seoDescription: String(d.seoDescription || ''),
    ogImage: String(d.ogImage || ''),
    updatedAt: row.updated_at,
  };
}
export type Post = ReturnType<typeof parsePost>;

export function parsePage(row: PageRow) {
  const d = parseJson<Json>(row.data, {});
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    subtitle: String(d.subtitle || ''),
    cover: String(d.cover || ''),
    body: String(d.body || ''),
    showEnquiry: !!d.showEnquiry,
    seoTitle: String(d.seoTitle || ''),
    seoDescription: String(d.seoDescription || ''),
    ogImage: String(d.ogImage || ''),
    noindex: !!d.noindex,
    updatedAt: row.updated_at,
  };
}
export type Page = ReturnType<typeof parsePage>;

/** "YYYY-MM-DD HH:MM" in India time — post publish dates are entered in IST. */
export function nowIst(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

export async function publishedRooms(db: D1Database): Promise<Room[]> {
  const { results } = await db
    .prepare("SELECT * FROM rooms WHERE status = 'published' ORDER BY sort ASC, id ASC")
    .all<RoomRow>();
  return results.map(parseRoom);
}

export async function publishedPosts(db: D1Database, opts: { limit?: number; offset?: number; tag?: string; q?: string } = {}) {
  const where = ["status = 'published'", 'published_at <= ?'];
  const binds: unknown[] = [nowIst()];
  if (opts.tag) {
    where.push("(',' || tags || ',') LIKE ?");
    binds.push(`%,${opts.tag.toLowerCase()},%`);
  }
  if (opts.q) {
    where.push('(title LIKE ? OR data LIKE ?)');
    binds.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  const sqlWhere = where.join(' AND ');
  const total = await db.prepare(`SELECT COUNT(*) AS n FROM posts WHERE ${sqlWhere}`).bind(...binds).first<{ n: number }>();
  const { results } = await db
    .prepare(`SELECT * FROM posts WHERE ${sqlWhere} ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(...binds, opts.limit ?? 10, opts.offset ?? 0)
    .all<PostRow>();
  return { posts: results.map(parsePost), total: total?.n ?? 0 };
}

export async function publishedPages(db: D1Database): Promise<Page[]> {
  const { results } = await db.prepare("SELECT * FROM pages WHERE status = 'published' ORDER BY sort, id").all<PageRow>();
  return results.map(parsePage);
}

/** A room type is unavailable when it's marked sold out or any blocked range overlaps the stay. */
export function roomAvailable(room: Room, checkin?: string, checkout?: string): boolean {
  if (room.soldOut) return false;
  if (!isDate(checkin) || !isDate(checkout)) return true;
  return !room.blocked.some((b) => {
    if (!isDate(b.from)) return false;
    const to = isDate(b.to) && b.to > b.from ? b.to : nextDay(b.from);
    return b.from < checkout && to > checkin;
  });
}

function nextDay(d: string): string {
  return new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10);
}

export function roomCover(room: Room): string {
  return room.images[0] || '/images/corridor-1.webp';
}

// ---------------------------------------------------------------------------------------------
// Theme → CSS custom properties. admin.js mirrors THEME_VARS for the live preview.
// ---------------------------------------------------------------------------------------------
export const THEME_VARS: Record<string, string> = {
  primary: '--c-primary', primaryInk: '--c-primary-ink', accent: '--c-accent', accentInk: '--c-accent-ink',
  bg: '--c-bg', surface: '--c-surface', text: '--c-text', muted: '--c-muted', border: '--c-border',
  dark: '--c-dark', darkInk: '--c-dark-ink',
};

export function buttonRadius(t: Settings['theme']): string {
  return t.buttonShape === 'pill' ? '999px' : t.buttonShape === 'square' ? '3px' : `${Math.min(t.radius, 12)}px`;
}

export function themeCss(t: Settings['theme']): string {
  const vars: string[] = [];
  for (const [k, v] of Object.entries(THEME_VARS)) {
    const val = (t as unknown as Record<string, string>)[k];
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) vars.push(`${v}:${val}`);
  }
  vars.push(`--f-heading:${fontStack(t.headingFont, 'serif')}`);
  vars.push(`--f-body:${fontStack(t.bodyFont, 'sans')}`);
  vars.push(`--f-brand:${fontStack(t.brandFont, 'serif')}`);
  vars.push(`--fw-heading:${Number(t.headingWeight) || 600}`);
  vars.push(`--fs-base:${Math.min(20, Math.max(14, Number(t.baseSize) || 16))}px`);
  vars.push(`--radius:${Math.min(32, Math.max(0, Number(t.radius) || 0))}px`);
  vars.push(`--radius-btn:${buttonRadius(t)}`);
  let css = `:root{${vars.join(';')}}`;
  for (const f of t.customFonts) {
    if (!f.family || !f.url || !/^[A-Za-z0-9 ]+$/.test(f.family) || !/^\/media\/[\w\-./]+$/.test(f.url)) continue;
    css += `@font-face{font-family:'${f.family}';src:url('${f.url}');font-weight:${/^[\d ]+$/.test(f.weight) ? f.weight : '400'};font-style:${f.style === 'italic' ? 'italic' : 'normal'};font-display:swap}`;
  }
  if (t.customCss) css += '\n' + t.customCss.replace(/<\/?(style|script)/gi, '').replace(/</g, '');
  return css;
}
