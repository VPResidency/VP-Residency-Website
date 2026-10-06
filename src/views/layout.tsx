import { raw } from 'hono/html';
import type { Child } from 'hono/jsx';
import type { Settings } from '../lib/defaults';
import type { FestivalView } from '../lib/festivals';
import { googleFontsUrl } from '../lib/fonts';
import { Icon } from '../lib/icons';
import { themeCss } from '../lib/content';
import { absUrl, businessJsonLd, pageTitle, verificationCode, type Meta } from '../lib/seo';
import { scriptJson, telLink, waLink } from '../lib/util';
import { bookHref } from './components';

export const ASSET_VERSION = '8';

export type LayoutProps = {
  s: Settings;
  nonce: string;
  origin: string;
  meta: Meta;
  festival?: FestivalView | null;
  /** true inside the admin theme preview iframe: no cookie banner, analytics or intro */
  preview?: boolean;
  children?: Child;
};

function Brand({ s, footer }: { s: Settings; footer?: boolean }) {
  const site = s.site;
  const h = site.logoHeight || 48;
  const name = site.showNameWithLogo || !(site.logo || site.logoLight) ? (
    <span class="wordmark">
      <span class="wm-name">{site.name}</span>
      {site.tagline ? <span class="wm-sub">{site.tagline}</span> : null}
    </span>
  ) : null;
  if (!site.logo && !site.logoLight) return name;
  const dark = site.logo || site.logoLight;
  const light = site.logoLight || site.logo;
  if (footer) {
    return (
      <>
        <img class="logo" src={light} alt={site.name} height={h} style={`height:${h}px`} />
        {name}
      </>
    );
  }
  return (
    <>
      <span class="logo-wrap" style={`height:${h}px`}>
        <img class="logo logo-on-dark" src={light} alt={site.name} height={h} style={`height:${h}px`} />
        <img class="logo logo-on-light" src={dark} alt="" aria-hidden="true" height={h} style={`height:${h}px`} />
      </span>
      {name}
    </>
  );
}

function festiveCss(f: FestivalView): string {
  const ok = (c: string) => /^#[0-9A-Fa-f]{6}$/.test(c);
  if (!f.useColors) return '';
  const vars = [];
  if (ok(f.primary)) vars.push(`--c-primary:${f.primary}`);
  if (ok(f.accent)) vars.push(`--c-accent:${f.accent}`);
  if (ok(f.dark)) vars.push(`--c-dark:${f.dark}`);
  return vars.length ? `:root{${vars.join(';')}}` : '';
}

export function festivalCta(s: Settings, f: FestivalView): string {
  if (f.ctaLink) return f.ctaLink;
  if (/whatsapp/i.test(f.ctaText)) return waLink(s.site.whatsapp || s.site.phone, `Hi ${s.site.name}, I'd like to book a room for ${f.name}.`);
  return '/rooms';
}

export function Layout({ s, nonce, origin, meta, festival, preview, children }: LayoutProps) {
  const title = pageTitle(s, meta);
  const description = meta.description || s.seo.description;
  const canonical = origin + meta.path;
  const image = absUrl(origin, meta.image || s.seo.ogImage || s.home.hero.images[0] || '');
  const fontsUrl = googleFontsUrl(s.theme);
  const gv = verificationCode(s.seo.googleVerification);
  const bv = verificationCode(s.seo.bingVerification);
  const noindex = meta.noindex || !s.seo.allowIndexing;
  const jsonLd = [businessJsonLd(s, origin), ...(meta.jsonLd || [])];
  const ga4 = /^G-[A-Z0-9]{4,20}$/.test(s.seo.ga4Id) ? s.seo.ga4Id : '';
  const fest = festival || null;
  const config = {
    ga4: preview ? '' : ga4,
    consent: s.cookies.enabled && !preview,
    preview: !!preview,
    parallax: s.theme.parallax,
    festival: fest
      ? { id: fest.id, animation: fest.animation, density: fest.density, seconds: s.festivals.animationSeconds, popup: fest.popup && !preview }
      : null,
  };
  const wa = s.site.whatsapp || s.site.phone;
  const year = new Date().getFullYear();
  const showAnnouncement = fest ? !!fest.greeting : s.announcement.enabled && !!s.announcement.text;
  const preloader = s.theme.preloader && !preview && (s.site.logo || s.site.logoLight);
  const icon = s.site.favicon || '/brand/icon-192.png';

  return (
    <>
      {raw('<!doctype html>')}
      <html lang="en-IN" data-anim={s.theme.animations ? 'on' : 'off'} data-kenburns={s.theme.kenBurns ? 'on' : 'off'} data-festival={fest?.id}>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <title>{title}</title>
          <meta name="description" content={description} />
          <link rel="canonical" href={canonical} />
          {noindex ? <meta name="robots" content="noindex, nofollow" /> : <meta name="robots" content="index, follow, max-image-preview:large" />}
          <meta property="og:site_name" content={s.site.name} />
          <meta property="og:type" content={meta.type || 'website'} />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={description} />
          <meta property="og:url" content={canonical} />
          <meta property="og:locale" content="en_IN" />
          {image ? <meta property="og:image" content={image} /> : null}
          {meta.publishedAt ? <meta property="article:published_time" content={meta.publishedAt} /> : null}
          <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
          <meta name="twitter:title" content={title} />
          <meta name="twitter:description" content={description} />
          {image ? <meta name="twitter:image" content={image} /> : null}
          {gv ? <meta name="google-site-verification" content={gv} /> : null}
          {bv ? <meta name="msvalidate.01" content={bv} /> : null}
          <meta name="theme-color" content={fest?.useColors ? fest.primary : s.theme.primary} />
          <meta name="format-detection" content="telephone=no" />
          <link rel="icon" href={icon} />
          <link rel="apple-touch-icon" href={s.site.favicon || '/brand/apple-touch-icon.png'} />
          <link rel="manifest" href="/site.webmanifest" />
          {fontsUrl ? (
            <>
              <link rel="preconnect" href="https://fonts.googleapis.com" />
              <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
              <link rel="stylesheet" href={fontsUrl} />
            </>
          ) : null}
          <link rel="stylesheet" href={`/assets/site.css?v=${ASSET_VERSION}`} />
          <style nonce={nonce} id="theme-vars">
            {raw(themeCss(s.theme))}
          </style>
          {fest ? (
            <style nonce={nonce} id="festival-vars">
              {raw(festiveCss(fest))}
            </style>
          ) : null}
          {preloader ? (
            <script nonce={nonce}>
              {raw("try{if(!sessionStorage.getItem('vp_intro')){document.documentElement.classList.add('show-intro')}}catch(e){}")}
            </script>
          ) : null}
          {jsonLd.map((ld) => (
            <script type="application/ld+json">{raw(scriptJson(ld))}</script>
          ))}
          <script type="application/json" id="site-config">
            {raw(scriptJson(config))}
          </script>
          <script src={`/assets/site.js?v=${ASSET_VERSION}`} defer></script>
        </head>
        <body class={s.nav.mobileBar ? 'has-mobile-bar' : ''}>
          {preloader ? (
            <div class="intro" data-intro aria-hidden="true">
              <img src={s.site.logo || s.site.logoLight} alt="" />
              <span class="intro-line"></span>
            </div>
          ) : null}
          <a class="skip-link" href="#main">
            Skip to content
          </a>
          <div class="topbar" data-topbar>
            {showAnnouncement ? (
              fest ? (
                <div class="announcement is-festive">
                  <div class="container announcement-inner">
                    <p>
                      <Icon name="sparkles" size={16} /> <span>{fest.greeting}</span>
                      {fest.offer ? <a href={fest.offerLink || festivalCta(s, fest)}>{fest.offer}</a> : null}
                    </p>
                  </div>
                </div>
              ) : (
                <div class="announcement" data-announcement data-dismissible={s.announcement.dismissible ? '1' : '0'}>
                  <div class="container announcement-inner">
                    <p>
                      <Icon name="sparkles" size={16} /> <span>{s.announcement.text}</span>
                      {s.announcement.link && s.announcement.linkText ? <a href={s.announcement.link}>{s.announcement.linkText}</a> : null}
                    </p>
                    {s.announcement.dismissible ? (
                      <button type="button" class="icon-btn" data-dismiss-announcement aria-label="Close announcement">
                        <Icon name="x" size={16} />
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            ) : null}
            <header class="site-header" data-header>
              <div class="container header-inner">
                <a class="brand" href="/" aria-label={`${s.site.name} home`}>
                  <Brand s={s} />
                </a>
                <nav class="main-nav" id="main-nav" aria-label="Main">
                  <ul>
                    {s.nav.links.map((l) => (
                      <li>
                        <a href={l.url} aria-current={l.url === meta.path || (l.url !== '/' && meta.path.startsWith(l.url + '/')) ? 'page' : undefined}>
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <div class="nav-drawer-extra">
                    <a class="btn btn-primary btn-block" href={bookHref(s)}>
                      {s.booking.bookButtonText}
                    </a>
                    {s.site.phone ? (
                      <a class="btn btn-outline btn-block" href={telLink(s.site.phone)}>
                        <Icon name="phone" size={18} /> {s.site.phone}
                      </a>
                    ) : null}
                  </div>
                </nav>
                <div class="header-actions">
                  {s.nav.showPhone && s.site.phone ? (
                    <a class="header-phone" href={telLink(s.site.phone)}>
                      <Icon name="phone" size={18} /> <span>{s.site.phone}</span>
                    </a>
                  ) : null}
                  <a class="btn btn-accent btn-sm header-book" href={bookHref(s)}>
                    {s.booking.bookButtonText}
                  </a>
                  <button type="button" class="icon-btn nav-toggle" aria-controls="main-nav" aria-expanded="false" data-nav-toggle>
                    <span class="sr-only">Menu</span>
                    <Icon name="menu" size={24} />
                  </button>
                </div>
              </div>
            </header>
            {fest?.garlandUrl ? <div class={`festive-garland garland-${fest.garland}`} style={`background-image:url('${fest.garlandUrl}')`} aria-hidden="true"></div> : null}
          </div>

          <main id="main">{children}</main>

          <footer class="site-footer">
            {s.theme.heroPattern ? <div class="pattern pattern-faint" aria-hidden="true"></div> : null}
            <div class="container footer-grid">
              <div class="footer-brand">
                <a class="brand brand-footer" href="/">
                  <Brand s={s} footer />
                </a>
                {s.site.footerAbout ? <p>{s.site.footerAbout}</p> : null}
                {s.site.googleRating ? (
                  <a class="footer-rating" href={s.site.googleReviewsUrl || '#'} target="_blank" rel="noopener">
                    <Icon name="google" size={16} /> <strong>{s.site.googleRating}</strong>
                    <Icon name="star" size={14} class="icon star-gold" /> {s.site.googleReviewCount} Google reviews
                  </a>
                ) : null}
                <div class="social">
                  {s.site.instagram ? (
                    <a href={s.site.instagram} target="_blank" rel="noopener" aria-label="Instagram">
                      <Icon name="instagram" />
                    </a>
                  ) : null}
                  {s.site.facebook ? (
                    <a href={s.site.facebook} target="_blank" rel="noopener" aria-label="Facebook">
                      <Icon name="facebook" />
                    </a>
                  ) : null}
                  {s.site.youtube ? (
                    <a href={s.site.youtube} target="_blank" rel="noopener" aria-label="YouTube">
                      <Icon name="youtube" />
                    </a>
                  ) : null}
                  {wa ? (
                    <a href={waLink(wa, `Hi ${s.site.name}`)} target="_blank" rel="noopener" aria-label="WhatsApp">
                      <Icon name="whatsapp" />
                    </a>
                  ) : null}
                </div>
              </div>
              <div>
                <h2 class="footer-title">Explore</h2>
                <ul class="footer-links">
                  {s.nav.links.map((l) => (
                    <li>
                      <a href={l.url}>{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 class="footer-title">Contact</h2>
                <ul class="footer-contact">
                  <li>
                    <Icon name="map-pin" size={18} />
                    <span>
                      {s.site.addressLine1}, {s.site.city}, {s.site.state} {s.site.pincode}
                    </span>
                  </li>
                  {s.site.phone ? (
                    <li>
                      <Icon name="phone" size={18} />
                      <a href={telLink(s.site.phone)}>{s.site.phone}</a>
                    </li>
                  ) : null}
                  {s.site.email ? (
                    <li>
                      <Icon name="mail" size={18} />
                      <a href={`mailto:${s.site.email}`}>{s.site.email}</a>
                    </li>
                  ) : null}
                  <li>
                    <Icon name="clock" size={18} />
                    <span>
                      Check-in {s.site.checkIn} · Check-out {s.site.checkOut}
                    </span>
                  </li>
                </ul>
              </div>
              <div>
                <h2 class="footer-title">Book your stay</h2>
                <p class="footer-note">Call or WhatsApp us for the best rate, or book online.</p>
                <div class="footer-cta">
                  {wa ? (
                    <a class="btn btn-whatsapp btn-sm" href={waLink(wa, `Hi ${s.site.name}, I'd like to book a room.`)} target="_blank" rel="noopener">
                      <Icon name="whatsapp" size={18} /> WhatsApp
                    </a>
                  ) : null}
                  {s.site.phone ? (
                    <a class="btn btn-outline-light btn-sm" href={telLink(s.site.phone)}>
                      <Icon name="phone" size={18} /> Call
                    </a>
                  ) : null}
                </div>
                {s.booking.showOtas && s.booking.otas.some((o) => o.url) ? (
                  <ul class="footer-otas">
                    {s.booking.otas
                      .filter((o) => o.url)
                      .map((o) => (
                        <li>
                          <a href={o.url} target="_blank" rel="noopener">
                            {o.name} <Icon name="external-link" size={14} />
                          </a>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <div class="container footer-bottom">
              <p>
                {s.site.copyright.replace('{year}', String(year))}
                {s.site.gstin ? <span class="gstin"> · GSTIN {s.site.gstin}</span> : null}
              </p>
              <ul>
                {s.nav.footerLinks.map((l) => (
                  <li>
                    <a href={l.url}>{l.label}</a>
                  </li>
                ))}
                {s.cookies.enabled ? (
                  <li>
                    <button type="button" class="link-btn" data-cookie-settings>
                      Cookie settings
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>
          </footer>

          {s.nav.mobileBar ? (
            <nav class="mobile-bar" aria-label="Quick contact">
              {s.site.phone ? (
                <a href={telLink(s.site.phone)}>
                  <Icon name="phone" /> <span>Call</span>
                </a>
              ) : null}
              {wa ? (
                <a href={waLink(wa, `Hi ${s.site.name}, I'd like to book a room.`)} target="_blank" rel="noopener" class="is-wa">
                  <Icon name="whatsapp" /> <span>WhatsApp</span>
                </a>
              ) : null}
              <a href="/rooms" class="is-book">
                <Icon name="bed-double" /> <span>Rooms</span>
              </a>
            </nav>
          ) : null}
          {s.nav.floatingWhatsapp && wa ? (
            <a class="float-wa" href={waLink(wa, `Hi ${s.site.name}, I'd like to book a room.`)} target="_blank" rel="noopener" aria-label="Chat on WhatsApp">
              <Icon name="whatsapp" size={28} />
            </a>
          ) : null}

          {fest && fest.animation !== 'none' ? <canvas class="festive-canvas" data-festive-canvas aria-hidden="true"></canvas> : null}
          {fest && fest.popup && !preview ? (
            <div class="festive-popup" data-festive-popup data-id={fest.id} hidden role="dialog" aria-modal="true" aria-labelledby="fp-title">
              <div class="fp-card">
                <button type="button" class="icon-btn fp-close" data-fp-close aria-label="Close">
                  <Icon name="x" size={22} />
                </button>
                {fest.popupImage || fest.artUrl ? (
                  <div class={`fp-art${fest.popupImage ? ' is-photo' : ''}`}>
                    <img src={fest.popupImage || fest.artUrl} alt="" />
                  </div>
                ) : null}
                <div class="fp-body">
                  <p class="eyebrow">{s.site.name}</p>
                  <h2 id="fp-title">{fest.popupTitle}</h2>
                  {fest.popupText ? <p>{fest.popupText}</p> : null}
                  <div class="fp-actions">
                    {fest.ctaText ? (
                      <a class="btn btn-primary" href={festivalCta(s, fest)}>
                        {fest.ctaText} <Icon name="arrow-right" size={16} />
                      </a>
                    ) : null}
                    <button type="button" class="btn btn-ghost" data-fp-close>
                      Maybe later
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {s.cookies.enabled && !preview ? (
            <div class="cookie-banner" role="dialog" aria-live="polite" aria-labelledby="cookie-title" data-cookie-banner hidden>
              <div class="cookie-main">
                <p class="cookie-title" id="cookie-title">
                  <Icon name="cookie" size={18} /> {s.cookies.title}
                </p>
                <p class="cookie-text">
                  {s.cookies.message} {s.cookies.policyLink ? <a href={s.cookies.policyLink}>Learn more</a> : null}
                </p>
                <div class="cookie-prefs" data-cookie-prefs hidden>
                  <label class="check">
                    <input type="checkbox" checked disabled /> <span>Essential — needed for the site to work.</span>
                  </label>
                  <label class="check">
                    <input type="checkbox" data-consent="analytics" /> <span>{s.cookies.analyticsLabel}</span>
                  </label>
                  <label class="check">
                    <input type="checkbox" data-consent="media" /> <span>{s.cookies.mediaLabel}</span>
                  </label>
                </div>
                <div class="cookie-actions">
                  <button type="button" class="btn btn-primary btn-sm" data-cookie-accept>
                    {s.cookies.acceptText}
                  </button>
                  <button type="button" class="btn btn-outline btn-sm" data-cookie-reject>
                    {s.cookies.rejectText}
                  </button>
                  <button type="button" class="btn btn-ghost btn-sm" data-cookie-customize>
                    {s.cookies.customizeText}
                  </button>
                  <button type="button" class="btn btn-primary btn-sm" data-cookie-save hidden>
                    Save choices
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div class="lightbox" data-lightbox hidden role="dialog" aria-modal="true" aria-label="Photo viewer">
            <button type="button" class="lb-close icon-btn" data-lb-close aria-label="Close">
              <Icon name="x" size={28} />
            </button>
            <button type="button" class="lb-prev icon-btn" data-lb-prev aria-label="Previous photo">
              <Icon name="chevron-left" size={32} />
            </button>
            <figure>
              <img alt="" data-lb-img />
              <figcaption>
                <span data-lb-cap></span> <span class="lb-count" data-lb-count></span>
              </figcaption>
            </figure>
            <button type="button" class="lb-next icon-btn" data-lb-next aria-label="Next photo">
              <Icon name="chevron-right" size={32} />
            </button>
          </div>
        </body>
      </html>
    </>
  );
}
