import type { Settings } from './defaults';
import { digits } from './util';

export type Meta = {
  title: string;
  /** use the exact title without applying the template */
  rawTitle?: boolean;
  description?: string;
  image?: string;
  path: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  jsonLd?: object[];
  publishedAt?: string;
};

export function siteOrigin(s: Settings, requestUrl: string): string {
  const configured = (s.seo.siteUrl || '').replace(/\/+$/, '');
  return /^https?:\/\//.test(configured) ? configured : new URL(requestUrl).origin;
}

export function absUrl(origin: string, pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  return /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : origin + (pathOrUrl.startsWith('/') ? '' : '/') + pathOrUrl;
}

export function pageTitle(s: Settings, meta: Meta): string {
  if (meta.rawTitle) return meta.title;
  const tpl = s.seo.titleTemplate || '%s';
  return tpl.includes('%s') ? tpl.replace('%s', meta.title) : `${meta.title} | ${tpl}`;
}

/** Accepts either the bare code or the whole <meta …content="code"> tag pasted from Search Console. */
export function verificationCode(input: string): string {
  const m = /content\s*=\s*["']([^"']+)["']/i.exec(input || '');
  const code = (m ? m[1] : input || '').trim();
  return /^[A-Za-z0-9_\-.:=+/]{6,120}$/.test(code) ? code : '';
}

export function businessJsonLd(s: Settings, origin: string): object {
  const site = s.site;
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': s.seo.businessType || 'Hotel',
    '@id': origin + '/#business',
    name: site.name,
    url: origin + '/',
    description: s.seo.description,
    telephone: site.phone ? '+' + (digits(site.phone).length === 10 ? '91' + digits(site.phone) : digits(site.phone)) : undefined,
    email: site.email || undefined,
    image: absUrl(origin, s.seo.ogImage || site.logo || s.home.hero.images[0] || '') || undefined,
    logo: site.logo ? absUrl(origin, site.logo) : undefined,
    priceRange: s.seo.priceRange || undefined,
    checkinTime: to24h(site.checkIn),
    checkoutTime: to24h(site.checkOut),
    address: {
      '@type': 'PostalAddress',
      streetAddress: [site.addressLine1, site.addressLine2].filter(Boolean).join(', '),
      addressLocality: site.city,
      addressRegion: site.state,
      postalCode: site.pincode,
      addressCountry: 'IN',
    },
    amenityFeature: s.amenities.items.map((a) => ({ '@type': 'LocationFeatureSpecification', name: a.label, value: true })),
    sameAs: [site.instagram, site.facebook, site.youtube, site.mapLink].filter(Boolean),
  };
  if (site.lat && site.lng && !Number.isNaN(Number(site.lat)) && !Number.isNaN(Number(site.lng))) {
    ld.geo = { '@type': 'GeoCoordinates', latitude: Number(site.lat), longitude: Number(site.lng) };
  }
  return ld;
}

export function breadcrumbJsonLd(origin: string, items: { name: string; path: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: origin + it.path })),
  };
}

function to24h(t: string): string | undefined {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec((t || '').trim());
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = m[2] || '00';
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}
