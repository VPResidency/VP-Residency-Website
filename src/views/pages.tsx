import type { Settings } from '../lib/defaults';
import { Icon } from '../lib/icons';
import { roomAvailable, roomCover, type Page, type Post, type Room } from '../lib/content';
import { fmtDate, inr, nightsBetween, readingMinutes, telLink, todayIso, waLink } from '../lib/util';
import { Cta } from './home';
import {
  bookingMessage, ContactList, EnquiryForm, GuestOptions, Img, MapEmbed, Markdown, OfferCard, PageBanner, PostCard, Price, RoomCard, RoomRow, Section, SectionHead,
} from './components';

// ---------------------------------------------------------------------------------------------
// Rooms list + search
// ---------------------------------------------------------------------------------------------
export type RoomSearch = { checkin: string; checkout: string; guests: number; type: string; sort: string };

export function RoomsPage({ s, rooms, q }: { s: Settings; rooms: Room[]; q: RoomSearch }) {
  const nights = nightsBetween(q.checkin, q.checkout);
  const searching = !!(q.checkin || q.type || q.sort || q.guests > 1);
  let list = rooms.filter((r) => {
    if (q.type === 'ac' && !r.ac) return false;
    if (q.type === 'nonac' && r.ac) return false;
    if (q.guests && r.maxAdults + r.maxChildren < q.guests) return false;
    return true;
  });
  if (q.sort === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
  if (q.sort === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
  const available = list.filter((r) => roomAvailable(r, q.checkin, q.checkout));
  const unavailable = list.filter((r) => !roomAvailable(r, q.checkin, q.checkout));
  const keep = new URLSearchParams();
  if (q.checkin) keep.set('checkin', q.checkin);
  if (q.checkout) keep.set('checkout', q.checkout);
  if (q.guests) keep.set('guests', String(q.guests));
  const query = keep.toString() ? `?${keep}` : '';

  return (
    <>
      <PageBanner s={s} title={s.booking.showPrices ? 'Rooms & Prices' : 'Our Rooms'} subtitle="AC and Non-AC rooms with hot water, Wi-Fi and a 24-hour front desk." image="/images/deluxe-room-1.webp" crumbs={[{ name: 'Home', href: '/' }, { name: 'Rooms' }]} />
      <section class="section section-tight">
        <div class="container">
          <form class="filter-bar" action="/rooms" method="get" data-search>
            <label class="field">
              <span>Check-in</span>
              <input type="date" name="checkin" value={q.checkin} min={todayIso()} data-checkin />
            </label>
            <label class="field">
              <span>Check-out</span>
              <input type="date" name="checkout" value={q.checkout} min={todayIso()} data-checkout />
            </label>
            <label class="field">
              <span>Guests</span>
              <select name="guests">
                <GuestOptions selected={q.guests || 2} max={10} />
              </select>
            </label>
            <label class="field">
              <span>Type</span>
              <select name="type">
                <option value="">Any</option>
                <option value="ac" selected={q.type === 'ac'}>AC</option>
                <option value="nonac" selected={q.type === 'nonac'}>Non-AC</option>
              </select>
            </label>
            {s.booking.showPrices ? (
              <label class="field">
                <span>Sort</span>
                <select name="sort">
                  <option value="">Recommended</option>
                  <option value="price_asc" selected={q.sort === 'price_asc'}>Price: low to high</option>
                  <option value="price_desc" selected={q.sort === 'price_desc'}>Price: high to low</option>
                </select>
              </label>
            ) : null}
            <button class="btn btn-primary" type="submit">
              <Icon name="search" size={18} /> Search
            </button>
          </form>

          <div class="results-head" role="status">
            <p>
              <strong>{available.length}</strong> {available.length === 1 ? 'room type' : 'room types'} available
              {nights ? (
                <>
                  {' '}
                  for <strong>{nights}</strong> {nights === 1 ? 'night' : 'nights'} · {fmtDate(q.checkin)} → {fmtDate(q.checkout)}
                </>
              ) : null}
            </p>
            {searching ? (
              <a class="text-link" href="/rooms">
                <Icon name="rotate-ccw" size={14} /> Clear search
              </a>
            ) : null}
          </div>

          {available.length || unavailable.length ? (
            <div class="room-list">
              {available.map((r) => (
                <RoomRow s={s} room={r} query={query} nights={nights} />
              ))}
              {unavailable.map((r) => (
                <RoomRow s={s} room={r} query={query} nights={nights} unavailable />
              ))}
            </div>
          ) : (
            <div class="empty">
              <Icon name="bed-double" size={40} />
              <h2 class="h3">No rooms match your search</h2>
              <p>Try different dates or fewer filters — or call us, we'll find you a room.</p>
              <div class="empty-actions">
                <a class="btn btn-outline" href="/rooms">
                  Show all rooms
                </a>
                {s.site.phone ? (
                  <a class="btn btn-primary" href={telLink(s.site.phone)}>
                    <Icon name="phone" size={18} /> Call {s.site.phone}
                  </a>
                ) : null}
              </div>
            </div>
          )}
          {s.booking.showPrices && s.booking.taxNote ? <p class="fine-print">{s.booking.taxNote}</p> : null}
        </div>
      </section>
      {s.offers.items.length ? (
        <Section class="section-tint section-offers">
          <SectionHead eyebrow={s.home.offers.eyebrow} title={s.home.offers.title} center />
          <div class="offer-grid">
            {s.offers.items.map((o) => (
              <OfferCard s={s} offer={o} />
            ))}
          </div>
        </Section>
      ) : null}
      <Cta s={s} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Single room
// ---------------------------------------------------------------------------------------------
export function RoomPage(props: {
  s: Settings;
  room: Room;
  others: Room[];
  allRooms: Room[];
  checkin: string;
  checkout: string;
  guests: number;
  sent: boolean;
  error: string;
  back: string;
}) {
  const { s, room } = props;
  const nights = nightsBetween(props.checkin, props.checkout);
  const available = roomAvailable(room, props.checkin, props.checkout);
  const images = room.images.length ? room.images : [roomCover(room)];
  const wa = s.site.whatsapp || s.site.phone;
  const msg = bookingMessage(s, { room: room.name, checkin: props.checkin, checkout: props.checkout, guests: props.guests || '', nights });
  const guests = room.maxAdults + room.maxChildren;
  const otas = s.booking.showOtas ? s.booking.otas.filter((o) => o.url) : [];

  return (
    <>
      <div class="header-spacer" aria-hidden="true"></div>
      <section class="section section-tight room-top">
        <div class="container">
          <nav class="crumbs crumbs-dark" aria-label="Breadcrumb">
            <ol>
              <li>
                <a href="/">Home</a>
              </li>
              <li>
                <a href="/rooms">Rooms</a>
              </li>
              <li>
                <span aria-current="page">{room.name}</span>
              </li>
            </ol>
          </nav>
          <div class={`room-gallery count-${Math.min(images.length, 5)}`} data-gallery>
            {images.slice(0, 5).map((src, i) => (
              <a class={`rg-item${i === 0 ? ' is-main' : ''}`} href={src} data-lightbox-item data-caption={room.name}>
                <Img src={src} alt={i === 0 ? room.name : ''} eager={i === 0} sizes={i === 0 ? '(min-width: 900px) 60vw, 100vw' : '(min-width: 900px) 20vw, 50vw'} />
                {i === 4 && images.length > 5 ? <span class="rg-more">+{images.length - 5} photos</span> : null}
              </a>
            ))}
            {images.slice(5).map((src) => (
              <a href={src} data-lightbox-item data-caption={room.name} hidden></a>
            ))}
          </div>
        </div>
      </section>

      <section class="section section-tight">
        <div class="container room-layout">
          <div class="room-main">
            {s.booking.showCategories && room.category ? <p class="eyebrow">{room.category}</p> : null}
            <h1 class="room-title">{room.name}</h1>
            <ul class="room-facts">
              <li>
                <Icon name={room.ac ? 'snowflake' : 'fan'} /> {room.ac ? 'Air-conditioned' : 'Non-AC'}
              </li>
              <li>
                <Icon name="users" /> {room.maxAdults} {room.maxAdults === 1 ? 'adult' : 'adults'}{room.maxChildren ? ` + ${room.maxChildren} ${room.maxChildren === 1 ? 'child' : 'children'}` : ''}
              </li>
              {room.beds ? (
                <li>
                  <Icon name="bed-double" /> {room.beds}
                </li>
              ) : null}
              {room.size ? (
                <li>
                  <Icon name="layout-grid" /> {room.size}
                </li>
              ) : null}
            </ul>
            {room.shortDesc ? <p class="lead">{room.shortDesc}</p> : null}
            <Markdown src={room.description} />
            {room.highlights.length ? (
              <ul class="chips chips-lg">
                {room.highlights.map((h) => (
                  <li>{h}</li>
                ))}
              </ul>
            ) : null}
            {room.amenities.length ? (
              <>
                <h2 class="h3">Room amenities</h2>
                <ul class="amenity-list">
                  {room.amenities.map((a) => (
                    <li>
                      <Icon name={a.icon} /> {a.label}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <h2 class="h3">Good to know</h2>
            <ul class="info-grid">
              <li>
                <Icon name="clock" />
                <span>
                  <strong>Check-in</strong> {s.site.checkIn}
                </span>
              </li>
              <li>
                <Icon name="clock" />
                <span>
                  <strong>Check-out</strong> {s.site.checkOut}
                </span>
              </li>
              <li>
                <Icon name="id-card" />
                <span>
                  <strong>ID proof</strong> Valid photo ID for every adult
                </span>
              </li>
              <li>
                <Icon name="cigarette-off" />
                <span>
                  <strong>Smoke-free</strong> property
                </span>
              </li>
            </ul>
            <p>
              <a class="text-link" href="/house-rules">
                House rules & cancellation <Icon name="arrow-right" size={14} />
              </a>
            </p>
          </div>

          <aside class="booking-box" aria-label="Book this room">
            {s.booking.showPrices ? <Price s={s} room={room} large /> : <p class="booking-ask">Ask us for today's best rate</p>}
            {s.booking.showPrices && s.booking.taxNote ? <p class="fine-print">{s.booking.taxNote}</p> : null}
            <form class="booking-form" action={`/rooms/${room.slug}`} method="get" data-booking data-room={room.name} data-price={s.booking.showPrices ? room.price : undefined} data-currency={s.booking.currency} data-wa={wa} data-wa-template={s.booking.whatsappTemplate}>
              <label class="field">
                <span>Check-in</span>
                <input type="date" name="checkin" value={props.checkin} min={todayIso()} data-checkin />
              </label>
              <label class="field">
                <span>Check-out</span>
                <input type="date" name="checkout" value={props.checkout} min={todayIso()} data-checkout />
              </label>
              <label class="field field-full">
                <span>Guests</span>
                <select name="guests">
                  <GuestOptions selected={props.guests || Math.min(2, guests)} max={guests} />
                </select>
              </label>
              <noscript>
                <button class="btn btn-outline btn-block field-full" type="submit">
                  Check dates
                </button>
              </noscript>
            </form>
            <p class="booking-total" data-total hidden={!nights || !s.booking.showPrices}>
              {nights && s.booking.showPrices ? (
                <>
                  {nights} {nights === 1 ? 'night' : 'nights'} × {s.booking.currency}
                  {inr(room.price)} = <strong>{s.booking.currency}{inr(nights * room.price)}</strong>
                </>
              ) : null}
            </p>
            {!available ? (
              <div class="alert alert-warn" role="status">
                <Icon name="triangle-alert" /> {room.soldOut ? 'This room is sold out right now.' : 'Not available for the selected dates.'} Call us — we may still be able to help.
              </div>
            ) : null}
            <div class="booking-actions">
              {wa ? (
                <a class="btn btn-whatsapp btn-block btn-lg" href={waLink(wa, msg)} target="_blank" rel="noopener" data-wa-link>
                  <Icon name="whatsapp" size={20} /> Book on WhatsApp
                </a>
              ) : null}
              {s.site.phone ? (
                <a class="btn btn-outline btn-block" href={telLink(s.site.phone)}>
                  <Icon name="phone" size={18} /> Call {s.site.phone}
                </a>
              ) : null}
              {s.booking.enquiryEnabled ? (
                <a class="btn btn-ghost btn-block" href="#enquiry">
                  <Icon name="mail" size={18} /> Send an enquiry
                </a>
              ) : null}
              {room.bookingUrl ? (
                <a class="btn btn-primary btn-block" href={room.bookingUrl} target="_blank" rel="noopener">
                  Book online <Icon name="external-link" size={16} />
                </a>
              ) : null}
            </div>
            {otas.length ? (
              <div class="ota-row">
                <span>Also on</span>
                {otas.map((o) => (
                  <a href={o.url} target="_blank" rel="noopener">
                    {o.name}
                  </a>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      {s.booking.enquiryEnabled ? (
        <section class="section section-tint">
          <div class="container narrow">
            <EnquiryForm s={s} rooms={props.allRooms} back={props.back} room={room.name} checkin={props.checkin} checkout={props.checkout} guests={props.guests} sent={props.sent} error={props.error} />
          </div>
        </section>
      ) : null}

      {props.others.length ? (
        <Section class="section-rooms">
          <SectionHead eyebrow="More options" title="Other rooms you may like" />
          <div class="room-grid">
            {props.others.map((r) => (
              <RoomCard s={s} room={r} />
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------------------------
export function GalleryPage({ s }: { s: Settings }) {
  const items = s.gallery.items.filter((g) => g.image);
  const cats = s.gallery.categories.filter((c) => items.some((g) => g.category === c));
  return (
    <>
      <PageBanner s={s} title="Gallery" subtitle="A look inside VP Residency — rooms, lobby and more." image="/images/lobby-1.webp" crumbs={[{ name: 'Home', href: '/' }, { name: 'Gallery' }]} />
      <section class="section section-tight">
        <div class="container">
          {cats.length > 1 ? (
            <div class="filter-chips" role="toolbar" aria-label="Filter photos" data-gallery-filter>
              <button type="button" class="chip-btn is-active" data-filter="">
                All
              </button>
              {cats.map((c) => (
                <button type="button" class="chip-btn" data-filter={c}>
                  {c}
                </button>
              ))}
            </div>
          ) : null}
          {items.length ? (
            <div class="masonry" data-gallery>
              {items.map((g) => (
                <a class="masonry-item" href={g.image} data-lightbox-item data-caption={g.caption} data-category={g.category}>
                  <Img src={g.image} alt={g.caption} sizes="(min-width: 1100px) 33vw, (min-width: 700px) 50vw, 100vw" />
                  {g.caption ? <span class="mosaic-cap">{g.caption}</span> : null}
                </a>
              ))}
            </div>
          ) : (
            <div class="empty">
              <Icon name="images" size={40} />
              <p>Photos coming soon.</p>
            </div>
          )}
        </div>
      </section>
      <Cta s={s} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------------------------
export function BlogPage(props: { s: Settings; posts: Post[]; page: number; pages: number; tag: string; q: string; tags: string[] }) {
  const { s } = props;
  const link = (p: number) => {
    const u = new URLSearchParams();
    if (props.tag) u.set('tag', props.tag);
    if (props.q) u.set('q', props.q);
    if (p > 1) u.set('page', String(p));
    const qs = u.toString();
    return `/blog${qs ? `?${qs}` : ''}`;
  };
  return (
    <>
      <PageBanner s={s} title={props.tag ? `Posts tagged “${props.tag}”` : 'Blog'} subtitle="Travel tips, local guides and news from VP Residency." crumbs={[{ name: 'Home', href: '/' }, { name: 'Blog' }]} />
      <section class="section section-tight">
        <div class="container">
          <div class="blog-tools">
            <form class="search-inline" action="/blog" method="get" role="search">
              <label class="sr-only" for="blog-q">
                Search posts
              </label>
              <input id="blog-q" type="search" name="q" value={props.q} placeholder="Search posts…" maxlength={80} />
              <button class="btn btn-primary btn-sm" type="submit">
                <Icon name="search" size={16} /> Search
              </button>
            </form>
            {props.tags.length ? (
              <div class="filter-chips">
                <a class={`chip-btn${!props.tag ? ' is-active' : ''}`} href="/blog">
                  All
                </a>
                {props.tags.map((t) => (
                  <a class={`chip-btn${props.tag === t ? ' is-active' : ''}`} href={`/blog?tag=${encodeURIComponent(t)}`}>
                    {t}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          {props.posts.length ? (
            <div class="post-grid">
              {props.posts.map((p) => (
                <PostCard post={p} />
              ))}
            </div>
          ) : (
            <div class="empty">
              <Icon name="newspaper" size={40} />
              <p>No posts found.</p>
            </div>
          )}
          {props.pages > 1 ? (
            <nav class="pager" aria-label="Pagination">
              {props.page > 1 ? (
                <a class="btn btn-outline btn-sm" href={link(props.page - 1)} rel="prev">
                  <Icon name="arrow-left" size={16} /> Newer
                </a>
              ) : (
                <span></span>
              )}
              <span>
                Page {props.page} of {props.pages}
              </span>
              {props.page < props.pages ? (
                <a class="btn btn-outline btn-sm" href={link(props.page + 1)} rel="next">
                  Older <Icon name="arrow-right" size={16} />
                </a>
              ) : (
                <span></span>
              )}
            </nav>
          ) : null}
        </div>
      </section>
    </>
  );
}

export function PostPage({ s, post, related, url }: { s: Settings; post: Post; related: Post[]; url: string }) {
  const share = encodeURIComponent(url);
  const text = encodeURIComponent(post.title);
  return (
    <>
      <PageBanner s={s} title={post.title} subtitle={post.excerpt} image={post.cover || undefined} crumbs={[{ name: 'Home', href: '/' }, { name: 'Blog', href: '/blog' }, { name: post.title }]} />
      <article class="section section-tight">
        <div class="container narrow">
          <p class="post-meta post-meta-lg">
            <Icon name="calendar-days" size={16} /> <time datetime={post.publishedAt.slice(0, 10)}>{fmtDate(post.publishedAt)}</time>
            <span> · {readingMinutes(post.body)} min read</span>
            {post.author ? <span> · {post.author}</span> : null}
          </p>
          <Markdown src={post.body} class="prose prose-lg" />
          {post.tags.length ? (
            <ul class="chips">
              {post.tags.map((t) => (
                <li>
                  <a href={`/blog?tag=${encodeURIComponent(t)}`}>#{t}</a>
                </li>
              ))}
            </ul>
          ) : null}
          <div class="share">
            <span>Share:</span>
            <a href={`https://wa.me/?text=${text}%20${share}`} target="_blank" rel="noopener" aria-label="Share on WhatsApp">
              <Icon name="whatsapp" />
            </a>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${share}`} target="_blank" rel="noopener" aria-label="Share on Facebook">
              <Icon name="facebook" />
            </a>
            <a href={`https://twitter.com/intent/tweet?url=${share}&text=${text}`} target="_blank" rel="noopener" aria-label="Share on X">
              <Icon name="x" />
            </a>
            <button type="button" class="icon-btn" data-copy={url} aria-label="Copy link">
              <Icon name="link" />
            </button>
          </div>
        </div>
      </article>
      {related.length ? (
        <Section class="section-tint">
          <SectionHead eyebrow="Keep reading" title="More from our blog" />
          <div class="post-grid">
            {related.map((p) => (
              <PostCard post={p} />
            ))}
          </div>
        </Section>
      ) : null}
      <Cta s={s} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Contact, custom pages, 404
// ---------------------------------------------------------------------------------------------
export function ContactPage({ s, rooms, sent, error }: { s: Settings; rooms: Room[]; sent: boolean; error: string }) {
  return (
    <>
      <PageBanner s={s} title="Contact us" subtitle="Call, WhatsApp or send us an enquiry — our front desk is open 24 hours." image="/images/reception-2.webp" crumbs={[{ name: 'Home', href: '/' }, { name: 'Contact' }]} />
      <section class="section section-tight">
        <div class="container contact-layout">
          <div>
            <h2 class="h3">Get in touch</h2>
            <ContactList s={s} />
            <div class="contact-actions">
              {s.site.phone ? (
                <a class="btn btn-primary" href={telLink(s.site.phone)}>
                  <Icon name="phone" size={18} /> Call now
                </a>
              ) : null}
              {s.site.whatsapp ? (
                <a class="btn btn-whatsapp" href={waLink(s.site.whatsapp, `Hi ${s.site.name}`)} target="_blank" rel="noopener">
                  <Icon name="whatsapp" size={18} /> WhatsApp
                </a>
              ) : null}
              {s.site.mapLink ? (
                <a class="btn btn-outline" href={s.site.mapLink} target="_blank" rel="noopener">
                  <Icon name="navigation" size={18} /> Directions
                </a>
              ) : null}
            </div>
            <MapEmbed s={s} />
          </div>
          <EnquiryForm s={s} rooms={rooms} back="/contact" sent={sent} error={error} />
        </div>
      </section>
    </>
  );
}

export function CustomPage({ s, page, rooms, sent, error }: { s: Settings; page: Page; rooms: Room[]; sent: boolean; error: string }) {
  return (
    <>
      <PageBanner s={s} title={page.title} subtitle={page.subtitle} image={page.cover || undefined} crumbs={[{ name: 'Home', href: '/' }, { name: page.title }]} />
      <section class="section section-tight">
        <div class="container narrow">
          <Markdown src={page.body} class="prose prose-lg" />
        </div>
      </section>
      {page.showEnquiry ? (
        <section class="section section-tint">
          <div class="container narrow">
            <EnquiryForm s={s} rooms={rooms} back={`/${page.slug}`} sent={sent} error={error} />
          </div>
        </section>
      ) : null}
    </>
  );
}

export function NotFoundPage({ s }: { s: Settings }) {
  return (
    <>
      <PageBanner s={s} title="Page not found" subtitle="The page you're looking for has moved or doesn't exist." />
      <section class="section">
        <div class="container narrow empty">
          <Icon name="key-round" size={40} />
          <p>Let's get you back on track.</p>
          <div class="empty-actions">
            <a class="btn btn-primary" href="/">
              Go to the home page
            </a>
            <a class="btn btn-outline" href="/rooms">
              See our rooms
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
