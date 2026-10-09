import { raw } from 'hono/html';
import type { Child } from 'hono/jsx';
import type { Settings } from '../lib/defaults';
import { Icon } from '../lib/icons';
import { renderMarkdown } from '../lib/markdown';
import { roomCover, type Post, type Room } from '../lib/content';
import { fillTemplate, fmtDate, inr, telLink, waLink } from '../lib/util';

/** 800w + 1600w srcset for bundled photos and admin uploads (uploads always get a -sm copy). */
export function srcSet(src: string): string | undefined {
  const m = /^(\/(?:images|media\/img)\/[\w\-./]+?)(\.(?:webp|jpg|jpeg|png))$/.exec(src || '');
  if (!m || m[1].endsWith('-sm')) return undefined;
  return `${m[1]}-sm${m[2]} 800w, ${src} 1600w`;
}

export function Img(props: {
  src: string;
  alt?: string;
  class?: string;
  sizes?: string;
  eager?: boolean;
  width?: number;
  height?: number;
  attrs?: Record<string, string>;
}) {
  const ss = srcSet(props.src);
  return (
    <img
      src={props.src}
      srcset={ss}
      sizes={ss ? props.sizes || '100vw' : undefined}
      alt={props.alt || ''}
      class={props.class}
      loading={props.eager ? 'eager' : 'lazy'}
      fetchpriority={props.eager ? 'high' : undefined}
      decoding="async"
      width={props.width}
      height={props.height}
      {...(props.attrs || {})}
    />
  );
}

export function Markdown({ src, class: cls = 'prose' }: { src: string; class?: string }) {
  return <div class={cls}>{raw(renderMarkdown(src))}</div>;
}

export function SectionHead(props: { eyebrow?: string; title?: string; subtitle?: string; center?: boolean; light?: boolean }) {
  if (!props.eyebrow && !props.title && !props.subtitle) return null;
  return (
    <div class={`section-head${props.center ? ' is-center' : ''}${props.light ? ' is-light' : ''}`} data-reveal>
      {props.eyebrow ? <p class="eyebrow">{props.eyebrow}</p> : null}
      {props.title ? <h2>{props.title}</h2> : null}
      {props.subtitle ? <p class="section-sub">{props.subtitle}</p> : null}
    </div>
  );
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const full = Math.round(Math.max(0, Math.min(5, value)));
  return (
    <span class="stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span class={i <= full ? 'star is-on' : 'star'}>
          <Icon name="star" size={size} />
        </span>
      ))}
    </span>
  );
}

export function PageBanner(props: {
  title: string;
  subtitle?: string;
  image?: string;
  crumbs?: { name: string; href?: string }[];
  s: Settings;
  compact?: boolean;
}) {
  return (
    <section class={`page-banner${props.compact ? ' is-compact' : ''}${props.image ? ' has-image' : ''}`}>
      {props.image ? <Img class="banner-img" src={props.image} eager attrs={{ 'data-parallax': '0.25' }} /> : null}
      {!props.image && props.s.theme.heroPattern ? <div class="pattern" aria-hidden="true"></div> : null}
      <div class="banner-overlay" aria-hidden="true"></div>
      <div class="container banner-inner">
        {props.crumbs ? (
          <nav class="crumbs" aria-label="Breadcrumb">
            <ol>
              {props.crumbs.map((c) => (
                <li>{c.href ? <a href={c.href}>{c.name}</a> : <span aria-current="page">{c.name}</span>}</li>
              ))}
            </ol>
          </nav>
        ) : null}
        <h1>{props.title}</h1>
        {props.subtitle ? <p class="banner-sub">{props.subtitle}</p> : null}
      </div>
    </section>
  );
}

export function bookingMessage(s: Settings, vars: { room?: string; checkin?: string; checkout?: string; guests?: string | number; nights?: number }) {
  return fillTemplate(s.booking.whatsappTemplate, {
    room: vars.room || 'a room',
    checkin: vars.checkin ? fmtDate(vars.checkin) : '',
    checkout: vars.checkout ? fmtDate(vars.checkout) : '',
    guests: vars.guests ?? '',
    nights: vars.nights ?? '',
  });
}

export function bookHref(s: Settings): string {
  switch (s.booking.bookAction) {
    case 'call':
      return telLink(s.site.phone);
    case 'rooms':
      return '/rooms';
    case 'enquiry':
      return '/contact#enquiry';
    default:
      return waLink(s.site.whatsapp || s.site.phone, `Hi ${s.site.name}, I'd like to book a room.`);
  }
}

export function Price({ s, room, large }: { s: Settings; room: Room; large?: boolean }) {
  return (
    <div class={`price${large ? ' is-large' : ''}`}>
      {room.originalPrice > room.price ? (
        <s class="price-old">
          {s.booking.currency}
          {inr(room.originalPrice)}
        </s>
      ) : null}
      <span class="price-now">
        {s.booking.currency}
        {inr(room.price)}
      </span>
      <span class="price-suffix">{s.booking.priceSuffix}</span>
    </div>
  );
}

export function RoomCard({ s, room, query = '', unavailable = false }: { s: Settings; room: Room; query?: string; unavailable?: boolean }) {
  const href = `/rooms/${room.slug}${query}`;
  const guests = room.maxAdults + room.maxChildren;
  return (
    <article class={`room-card${unavailable ? ' is-unavailable' : ''}`} data-reveal>
      <a class="room-card-media" href={href} tabindex={-1} aria-hidden="true">
        <Img src={roomCover(room)} sizes="(min-width: 1100px) 400px, (min-width: 700px) 50vw, 100vw" width={800} height={600} />
        <span class={`badge ${room.ac ? 'badge-ac' : 'badge-nonac'}`}>
          <Icon name={room.ac ? 'snowflake' : 'fan'} size={14} /> {room.ac ? 'AC' : 'Non-AC'}
        </span>
        {room.soldOut ? <span class="badge badge-soldout">Sold out</span> : unavailable ? <span class="badge badge-soldout">Not available for your dates</span> : null}
      </a>
      <div class="room-card-body">
        {s.booking.showCategories && room.category ? <p class="room-cat">{room.category}</p> : null}
        <h3>
          <a href={href}>{room.name}</a>
        </h3>
        <ul class="room-meta">
          <li>
            <Icon name="users" size={16} /> Up to {guests} guests
          </li>
          {room.beds ? (
            <li>
              <Icon name="bed-double" size={16} /> {room.beds}
            </li>
          ) : null}
          {room.size ? (
            <li>
              <Icon name="layout-grid" size={16} /> {room.size}
            </li>
          ) : null}
        </ul>
        {room.highlights.length ? (
          <ul class="chips">
            {room.highlights.slice(0, 3).map((h) => (
              <li>{h}</li>
            ))}
          </ul>
        ) : null}
        <div class={`room-card-foot${s.booking.showPrices ? '' : ' no-price'}`}>
          {s.booking.showPrices ? <Price s={s} room={room} /> : null}
          <a class="btn btn-primary btn-sm" href={href}>
            View room <Icon name="arrow-right" size={16} />
          </a>
        </div>
      </div>
    </article>
  );
}

export function RoomRow({ s, room, query = '', unavailable = false, nights = 0 }: { s: Settings; room: Room; query?: string; unavailable?: boolean; nights?: number }) {
  const href = `/rooms/${room.slug}${query}`;
  const guests = room.maxAdults + room.maxChildren;
  const wa = s.site.whatsapp || s.site.phone;
  return (
    <article class={`room-row${unavailable ? ' is-unavailable' : ''}`} data-reveal>
      <a class="room-row-media" href={href} tabindex={-1} aria-hidden="true">
        <Img src={roomCover(room)} sizes="(min-width: 900px) 420px, 100vw" width={800} height={600} />
        <span class={`badge ${room.ac ? 'badge-ac' : 'badge-nonac'}`}>
          <Icon name={room.ac ? 'snowflake' : 'fan'} size={14} /> {room.ac ? 'AC' : 'Non-AC'}
        </span>
        {room.images.length > 1 ? (
          <span class="photo-count">
            <Icon name="images" size={14} /> {room.images.length}
          </span>
        ) : null}
      </a>
      <div class="room-row-body">
        {s.booking.showCategories && room.category ? <p class="room-cat">{room.category}</p> : null}
        <h2 class="h3">
          <a href={href}>{room.name}</a>
        </h2>
        <ul class="room-meta">
          <li>
            <Icon name="users" size={16} /> Up to {guests} guests
          </li>
          {room.beds ? (
            <li>
              <Icon name="bed-double" size={16} /> {room.beds}
            </li>
          ) : null}
          {room.size ? (
            <li>
              <Icon name="layout-grid" size={16} /> {room.size}
            </li>
          ) : null}
        </ul>
        {room.shortDesc ? <p class="room-row-desc">{room.shortDesc}</p> : null}
        {room.amenities.length ? (
          <ul class="mini-amenities">
            {room.amenities.slice(0, 6).map((a) => (
              <li>
                <Icon name={a.icon} size={16} /> {a.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div class="room-row-side">
        {room.soldOut ? <span class="avail is-no">Sold out</span> : unavailable ? <span class="avail is-no">Not available for your dates</span> : <span class="avail">Available</span>}
        {s.booking.showPrices ? <Price s={s} room={room} large /> : null}
        {s.booking.showPrices && nights ? (
          <p class="row-total">
            {s.booking.currency}
            {inr(room.price * nights)} for {nights} {nights === 1 ? 'night' : 'nights'}
          </p>
        ) : null}
        <a class="btn btn-primary btn-block" href={href}>
          View & book <Icon name="arrow-right" size={16} />
        </a>
        {wa ? (
          <a class="btn btn-whatsapp btn-block btn-sm" href={waLink(wa, bookingMessage(s, { room: room.name }))} target="_blank" rel="noopener">
            <Icon name="whatsapp" size={16} /> WhatsApp
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function PostCard({ post }: { post: Post }) {
  return (
    <article class="post-card" data-reveal>
      <a class="post-card-media" href={`/blog/${post.slug}`} tabindex={-1} aria-hidden="true">
        <Img src={post.cover || '/images/building.webp'} sizes="(min-width: 1100px) 400px, (min-width: 700px) 50vw, 100vw" width={800} height={500} />
      </a>
      <div class="post-card-body">
        <p class="post-meta">
          <time datetime={post.publishedAt.slice(0, 10)}>{fmtDate(post.publishedAt)}</time>
          {post.tags[0] ? <span> · {post.tags[0]}</span> : null}
        </p>
        <h3>
          <a href={`/blog/${post.slug}`}>{post.title}</a>
        </h3>
        {post.excerpt ? <p class="post-excerpt">{post.excerpt}</p> : null}
        <a class="text-link" href={`/blog/${post.slug}`}>
          Read more <Icon name="arrow-right" size={16} />
        </a>
      </div>
    </article>
  );
}

export function OfferCard({ s, offer }: { s: Settings; offer: Settings['offers']['items'][number] }) {
  const wa = s.site.whatsapp || s.site.phone;
  const href = offer.ctaLink || waLink(wa, `Hi ${s.site.name}, I'd like to know more about: ${offer.title}`);
  const external = /^https?:/.test(href);
  return (
    <article class="offer-card" data-reveal>
      <div class="offer-media">
        <Img src={offer.image || '/images/lounge.webp'} sizes="(min-width: 1100px) 400px, 100vw" width={800} height={600} />
        {offer.badge ? <span class="offer-badge">{offer.badge}</span> : null}
      </div>
      <div class="offer-body">
        <h3>{offer.title}</h3>
        <p>{offer.text}</p>
        {offer.ctaText ? (
          <a class="text-link" href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener' : undefined}>
            {offer.ctaText} <Icon name="arrow-right" size={16} />
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function GuestOptions({ selected, max = 10 }: { selected?: number; max?: number }) {
  const opts = [];
  for (let i = 1; i <= max; i++)
    opts.push(
      <option value={String(i)} selected={selected === i}>
        {i} {i === 1 ? 'guest' : 'guests'}
      </option>,
    );
  return <>{opts}</>;
}

export function EnquiryForm(props: {
  s: Settings;
  rooms: Room[];
  back: string;
  room?: string;
  checkin?: string;
  checkout?: string;
  guests?: number;
  sent?: boolean;
  error?: string;
  title?: string;
}) {
  const { s } = props;
  if (!s.booking.enquiryEnabled) return null;
  const turnstile = s.security.protectEnquiry && s.security.turnstileSiteKey && s.security.turnstileSecret;
  return (
    <div class="enquiry-card" id="enquiry">
      <h2 class="h3">{props.title || s.booking.enquiryTitle}</h2>
      {props.sent ? (
        <div class="alert alert-success" role="status">
          <Icon name="circle-check" /> {s.booking.enquirySuccess}
        </div>
      ) : null}
      {props.error ? (
        <div class="alert alert-error" role="alert">
          <Icon name="triangle-alert" /> {props.error}
        </div>
      ) : null}
      <form class="form-grid" method="post" action="/enquiry" data-enquiry data-wa={s.site.whatsapp || s.site.phone} data-wa-template={s.booking.whatsappTemplate}>
        <input type="hidden" name="_back" value={props.back} />
        <input type="hidden" name="ft" value={String(Date.now())} data-ft />
        <div class="hp" aria-hidden="true">
          <label>
            Leave this empty <input type="text" name="website" tabindex={-1} autocomplete="off" />
          </label>
        </div>
        <label class="field">
          <span>Your name *</span>
          <input type="text" name="name" required maxlength={80} autocomplete="name" />
        </label>
        <label class="field">
          <span>Phone / WhatsApp *</span>
          <input type="tel" name="phone" required maxlength={20} autocomplete="tel" inputmode="tel" pattern="[0-9+ ()-]{10,20}" />
        </label>
        <label class="field">
          <span>E-mail (optional)</span>
          <input type="email" name="email" maxlength={120} autocomplete="email" />
        </label>
        <label class="field">
          <span>Room</span>
          <select name="room">
            <option value="">Any room</option>
            {props.rooms.map((r) => (
              <option value={r.name} selected={props.room === r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label class="field">
          <span>Check-in</span>
          <input type="date" name="checkin" value={props.checkin || ''} data-checkin />
        </label>
        <label class="field">
          <span>Check-out</span>
          <input type="date" name="checkout" value={props.checkout || ''} data-checkout />
        </label>
        <label class="field">
          <span>Guests</span>
          <select name="guests">
            <GuestOptions selected={props.guests || 2} />
          </select>
        </label>
        <label class="field field-full">
          <span>Message</span>
          <textarea name="message" rows={3} maxlength={1000} placeholder="Arrival time, special requests…"></textarea>
        </label>
        {turnstile ? <div class="field-full cf-turnstile" data-sitekey={s.security.turnstileSiteKey}></div> : null}
        <div class="field-full form-actions">
          <button class="btn btn-primary" type="submit">
            <Icon name="mail" size={18} /> Send enquiry
          </button>
          <button class="btn btn-whatsapp" type="button" data-wa-send>
            <Icon name="whatsapp" size={18} /> Send on WhatsApp
          </button>
        </div>
        <p class="form-note field-full">
          We use these details only to reply to your enquiry. See our <a href="/privacy-policy">privacy policy</a>.
        </p>
      </form>
      {turnstile ? <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script> : null}
    </div>
  );
}

export function ContactList({ s }: { s: Settings }) {
  const site = s.site;
  return (
    <ul class="contact-list">
      <li>
        <Icon name="map-pin" />
        <span>
          {site.addressLine1}
          {site.addressLine2 ? <br /> : null}
          {site.addressLine2}
          <br />
          {site.city}, {site.state} {site.pincode}
        </span>
      </li>
      {site.phone ? (
        <li>
          <Icon name="phone" />
          <a href={telLink(site.phone)}>{site.phone}</a>
          {site.phoneAlt ? (
            <>
              {' · '}
              <a href={telLink(site.phoneAlt)}>{site.phoneAlt}</a>
            </>
          ) : null}
        </li>
      ) : null}
      {site.whatsapp ? (
        <li>
          <Icon name="whatsapp" />
          <a href={waLink(site.whatsapp, `Hi ${site.name}`)} target="_blank" rel="noopener">
            WhatsApp {site.whatsapp}
          </a>
        </li>
      ) : null}
      {site.email ? (
        <li>
          <Icon name="mail" />
          <a href={`mailto:${site.email}`}>{site.email}</a>
        </li>
      ) : null}
      <li>
        <Icon name="clock" />
        <span>
          Check-in {site.checkIn} · Check-out {site.checkOut}
          {site.frontDesk ? (
            <>
              <br />
              {site.frontDesk}
            </>
          ) : null}
        </span>
      </li>
    </ul>
  );
}

export function MapEmbed({ s }: { s: Settings }) {
  const q = s.site.lat && s.site.lng ? `${s.site.lat},${s.site.lng}` : s.site.mapEmbedQuery;
  const src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
  return (
    <div class="map-embed" data-consent-embed="media" data-src={src}>
      <div class="map-placeholder">
        <Icon name="map" size={32} />
        <p>The map is provided by Google and may set cookies.</p>
        <button type="button" class="btn btn-primary btn-sm" data-load-embed>
          Show map
        </button>
        {s.site.mapLink ? (
          <a class="text-link" href={s.site.mapLink} target="_blank" rel="noopener">
            Open in Google Maps <Icon name="external-link" size={14} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function Section(props: { id?: string; class?: string; children?: Child }) {
  return (
    <section id={props.id} class={`section ${props.class || ''}`}>
      <div class="container">{props.children}</div>
    </section>
  );
}
