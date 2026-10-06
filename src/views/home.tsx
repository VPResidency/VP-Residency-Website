import type { Settings } from '../lib/defaults';
import type { FestivalView } from '../lib/festivals';
import { Icon } from '../lib/icons';
import type { Post, Room } from '../lib/content';
import { telLink, todayIso, waLink } from '../lib/util';
import { festivalCta } from './layout';
import {
  ContactList, GuestOptions, Img, MapEmbed, Markdown, OfferCard, PostCard, RoomCard, Section, SectionHead, Stars,
} from './components';

type HomeData = { s: Settings; rooms: Room[]; posts: Post[]; festival?: FestivalView | null };

function Words({ text }: { text: string }) {
  // Each word fades up in turn (pure CSS, see .hero h1 .w).
  return (
    <>
      {text.split(/\s+/).filter(Boolean).map((w, i) => (
        <>
          <span class="w" style={`--i:${i}`}>
            {w}
          </span>{' '}
        </>
      ))}
    </>
  );
}

function Hero({ s, festival }: HomeData) {
  const h = s.home.hero;
  const images = (festival?.heroImages?.length ? festival.heroImages : h.images).filter(Boolean);
  const overlay = Math.min(90, Math.max(0, h.overlay)) / 100;
  const media = images.length > 0 || !!h.video;
  return (
    <section class={`hero${media ? ' has-media' : ''}`} data-hero>
      <div class="hero-media" aria-hidden="true">
        {images.map((src, i) => (
          <Img class={`hero-slide${i === 0 ? ' is-active' : ''}`} src={src} eager={i === 0} />
        ))}
        {h.video ? (
          <video class="hero-video" autoplay muted loop playsinline preload="metadata" poster={images[0] || undefined} data-hero-video>
            <source src={h.video} type="video/mp4" />
          </video>
        ) : null}
        {!media && s.theme.heroPattern ? <div class="pattern"></div> : null}
        <div class="hero-overlay" style={`--overlay:${media ? overlay : 0}`}></div>
      </div>
      <div class="container hero-content">
        {festival ? (
          <p class="festive-chip">
            <Icon name="sparkles" size={15} /> {festival.popupTitle || festival.name}
          </p>
        ) : h.eyebrow ? (
          <p class="eyebrow eyebrow-light hero-eyebrow">
            <span class="eyebrow-line" aria-hidden="true"></span> {h.eyebrow}
          </p>
        ) : null}
        <h1>
          <Words text={h.title} />
        </h1>
        {h.subtitle ? <p class="hero-sub">{h.subtitle}</p> : null}
        <div class="hero-ctas">
          {h.primaryCta ? (
            <a class="btn btn-accent btn-lg" href="/rooms">
              {h.primaryCta} <Icon name="arrow-right" size={18} />
            </a>
          ) : null}
          {h.secondaryCta && s.site.phone ? (
            <a class="btn btn-glass btn-lg" href={telLink(s.site.phone)}>
              <Icon name="phone" size={18} /> {h.secondaryCta}
            </a>
          ) : null}
        </div>
        {s.site.googleRating ? (
          <a class="hero-rating" href={s.site.googleReviewsUrl || '#'} target="_blank" rel="noopener">
            <span class="hr-score">{s.site.googleRating}</span>
            <span>
              <Stars value={Number(s.site.googleRating)} size={14} />
              <small>{s.site.googleReviewCount} reviews on Google</small>
            </span>
          </a>
        ) : null}
      </div>
      {festival?.artUrl ? (
        <a class="festive-badge" href={festivalCta(s, festival)} aria-label={festival.popupTitle || festival.name}>
          <img src={festival.artUrl} alt="" />
        </a>
      ) : null}
      {images.length > 1 ? (
        <div class="hero-dots" aria-hidden="true">
          {images.map((_, i) => (
            <span class={i === 0 ? 'is-active' : ''}></span>
          ))}
        </div>
      ) : null}
      {h.showSearch ? (
        <div class="container hero-search-wrap">
          <form class="search-card" action="/rooms" method="get" data-search>
            <label class="field">
              <span>
                <Icon name="calendar-days" size={16} /> Check-in
              </span>
              <input type="date" name="checkin" min={todayIso()} data-checkin />
            </label>
            <label class="field">
              <span>
                <Icon name="calendar-days" size={16} /> Check-out
              </span>
              <input type="date" name="checkout" min={todayIso()} data-checkout />
            </label>
            <label class="field">
              <span>
                <Icon name="users" size={16} /> Guests
              </span>
              <select name="guests">
                <GuestOptions selected={2} max={8} />
              </select>
            </label>
            <label class="field">
              <span>
                <Icon name="snowflake" size={16} /> Room type
              </span>
              <select name="type">
                <option value="">Any room</option>
                <option value="ac">AC</option>
                <option value="nonac">Non-AC</option>
              </select>
            </label>
            <button class="btn btn-primary btn-lg search-submit" type="submit">
              <Icon name="search" size={18} /> <span>Check availability</span>
            </button>
          </form>
        </div>
      ) : (
        <a class="scroll-cue" href="#main-after-hero" aria-label="Scroll down">
          <span></span>
        </a>
      )}
    </section>
  );
}

function Highlights({ s }: HomeData) {
  const items = s.home.highlights.items;
  if (!items.length) return null;
  return (
    <section class="highlights" id="main-after-hero">
      <div class="container">
        <ul class="highlight-grid">
          {items.map((it, i) => (
            <li data-reveal style={`--d:${i * 80}ms`}>
              <span class="hl-icon">
                <Icon name={it.icon} size={22} />
              </span>
              <span>
                <strong>{it.title}</strong>
                <small>{it.text}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RoomsSection({ s, rooms }: HomeData) {
  if (!rooms.length) return null;
  const sec = s.home.rooms;
  const list = [...rooms].sort((a, b) => Number(b.featured) - Number(a.featured) || a.sort - b.sort).slice(0, sec.limit);
  return (
    <Section id="rooms" class="section-rooms">
      <div class="section-head-row">
        <SectionHead eyebrow={sec.eyebrow} title={sec.title} subtitle={sec.subtitle} />
        <a class="btn btn-outline" href="/rooms">
          All rooms <Icon name="arrow-right" size={16} />
        </a>
      </div>
      <div class={`room-grid${list.length === 2 ? ' is-two' : ''}`}>
        {list.map((r) => (
          <RoomCard s={s} room={r} />
        ))}
      </div>
    </Section>
  );
}

function Offers({ s }: HomeData) {
  const items = s.offers.items.filter((o) => o.title);
  if (!items.length) return null;
  return (
    <Section id="offers" class="section-offers section-tint">
      <SectionHead eyebrow={s.home.offers.eyebrow} title={s.home.offers.title} center />
      <div class="offer-grid">
        {items.map((o) => (
          <OfferCard s={s} offer={o} />
        ))}
      </div>
    </Section>
  );
}

function About({ s }: HomeData) {
  const a = s.home.about;
  return (
    <Section id="about" class="section-about">
      <div class="split">
        <div class="split-media about-media" data-reveal>
          <div class="framed">
            <Img src={a.image || '/images/reception-1.webp'} sizes="(min-width: 900px) 50vw, 100vw" width={900} height={700} attrs={{ 'data-parallax': '0.08' }} />
          </div>
          {a.image2 ? (
            <div class="framed framed-small">
              <Img src={a.image2} sizes="(min-width: 900px) 25vw, 50vw" width={600} height={400} />
            </div>
          ) : null}
          {s.site.googleRating ? (
            <a class="rating-badge" href={s.site.googleReviewsUrl || '#'} target="_blank" rel="noopener">
              <strong data-count={s.site.googleRating}>{s.site.googleRating}</strong>
              <Stars value={Number(s.site.googleRating)} size={14} />
              <span>{s.site.googleReviewCount} Google reviews</span>
            </a>
          ) : null}
        </div>
        <div class="split-body" data-reveal>
          <SectionHead eyebrow={a.eyebrow} title={a.title} />
          <Markdown src={a.body} />
          {a.points.length ? (
            <ul class="checklist">
              {a.points.map((p) => (
                <li>
                  <Icon name="circle-check" size={20} /> {p}
                </li>
              ))}
            </ul>
          ) : null}
          {a.ctaText && a.ctaLink ? (
            <a class="btn btn-primary" href={a.ctaLink}>
              {a.ctaText} <Icon name="arrow-right" size={16} />
            </a>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function Marquee({ s }: HomeData) {
  const items = s.amenities.items.map((a) => a.label).filter(Boolean);
  if (!items.length) return null;
  const row = (hidden: boolean) => (
    <ul class="marquee-row" aria-hidden={hidden ? 'true' : undefined}>
      {items.map((t) => (
        <li>
          <span class="mq-dot" aria-hidden="true">✦</span> {t}
        </li>
      ))}
    </ul>
  );
  return (
    <section class="marquee" aria-label="Amenities">
      <div class="marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}

function Amenities({ s }: HomeData) {
  const items = s.amenities.items;
  if (!items.length) return null;
  const sec = s.home.amenities;
  return (
    <Section id="amenities" class="section-amenities">
      <SectionHead eyebrow={sec.eyebrow} title={sec.title} subtitle={sec.subtitle} center />
      <ul class="amenity-grid">
        {items.map((it, i) => (
          <li data-reveal style={`--d:${(i % 4) * 70}ms`}>
            <span class="am-icon">
              <Icon name={it.icon} size={26} />
            </span>
            <span>{it.label}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Gallery({ s }: HomeData) {
  const items = s.gallery.items.filter((g) => g.image).slice(0, s.home.gallery.limit);
  if (!items.length) return null;
  const sec = s.home.gallery;
  return (
    <Section id="gallery" class="section-gallery">
      <div class="section-head-row">
        <SectionHead eyebrow={sec.eyebrow} title={sec.title} />
        <a class="btn btn-outline" href="/gallery">
          Full gallery <Icon name="arrow-right" size={16} />
        </a>
      </div>
      <div class="mosaic" data-gallery>
        {items.map((g, i) => (
          <a class={`mosaic-item m${i}`} href={g.image} data-lightbox-item data-caption={g.caption} data-reveal style={`--d:${(i % 4) * 60}ms`}>
            <Img src={g.image} alt={g.caption} sizes={i === 0 ? '(min-width: 900px) 50vw, 100vw' : '(min-width: 900px) 25vw, 50vw'} />
            {g.caption ? <span class="mosaic-cap">{g.caption}</span> : null}
          </a>
        ))}
      </div>
    </Section>
  );
}

function Testimonials({ s }: HomeData) {
  const items = s.testimonials.items.filter((t) => t.text);
  if (!items.length) return null;
  const sec = s.home.testimonials;
  return (
    <Section id="reviews" class="section-reviews section-dark">
      <div class="pattern pattern-faint" aria-hidden="true"></div>
      <div class="reviews-layout">
        <div class="reviews-summary" data-reveal>
          <SectionHead eyebrow={sec.eyebrow} title={sec.title} light />
          {s.site.googleRating ? (
            <div class="score-card">
              <div class="score" data-count={s.site.googleRating}>
                {s.site.googleRating}
              </div>
              <div>
                <Stars value={Number(s.site.googleRating)} size={18} />
                <p>
                  Based on {s.site.googleReviewCount} reviews on <Icon name="google" size={14} /> Google
                </p>
                {s.site.googleReviewsUrl ? (
                  <a class="text-link text-link-light" href={s.site.googleReviewsUrl} target="_blank" rel="noopener">
                    Read all reviews <Icon name="external-link" size={14} />
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        <div class="review-track" data-carousel>
          {items.map((t, i) => (
            <figure class="review-card" data-reveal style={`--d:${i * 90}ms`}>
              <Icon name="quote" size={30} class="icon quote-icon" />
              {t.rating > 0 ? <Stars value={t.rating} size={15} /> : null}
              <blockquote>{t.text}</blockquote>
              <figcaption>
                <span class="avatar" aria-hidden="true">
                  {t.name.trim().charAt(0).toUpperCase()}
                </span>
                <span>
                  <strong>{t.name}</strong>
                  {t.source ? <small>via {t.source}</small> : null}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Location({ s }: HomeData) {
  const l = s.home.location;
  return (
    <Section id="location" class="section-location">
      <div class="split split-location">
        <div class="split-body" data-reveal>
          <SectionHead eyebrow={l.eyebrow} title={l.title} subtitle={l.text} />
          <ContactList s={s} />
          {l.nearby.length ? (
            <ul class="nearby">
              {l.nearby.map((n) => (
                <li>
                  <Icon name={n.icon} size={18} />
                  <span>{n.name}</span>
                  <small>{n.distance}</small>
                </li>
              ))}
            </ul>
          ) : null}
          {s.site.mapLink ? (
            <a class="btn btn-primary" href={s.site.mapLink} target="_blank" rel="noopener">
              <Icon name="navigation" size={18} /> Get directions
            </a>
          ) : null}
        </div>
        <div class="location-media" data-reveal>
          <MapEmbed s={s} />
          {s.site.streetPhoto ? (
            <figure class="street-photo">
              <Img src={s.site.streetPhoto} sizes="(min-width: 900px) 40vw, 100vw" alt="Our roadside sign on Trichy Main Road" />
              <figcaption>
                <Icon name="map-pin" size={14} /> Look for this sign on Trichy Main Road
              </figcaption>
            </figure>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function Faq({ s }: HomeData) {
  const items = s.faqs.items.filter((f) => f.q);
  if (!items.length) return null;
  return (
    <Section id="faq" class="section-faq section-tint">
      <SectionHead eyebrow={s.home.faq.eyebrow} title={s.home.faq.title} center />
      <div class="faq-list">
        {items.map((f, i) => (
          <details class="faq-item" open={i === 0} data-reveal>
            <summary>
              {f.q}
              <Icon name="plus" size={20} class="icon faq-icon" />
            </summary>
            <div class="faq-a">
              <p>{f.a}</p>
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}

function Blog({ s, posts }: HomeData) {
  if (!posts.length) return null;
  return (
    <Section id="blog" class="section-blog">
      <div class="section-head-row">
        <SectionHead eyebrow={s.home.blog.eyebrow} title={s.home.blog.title} />
        <a class="btn btn-outline" href="/blog">
          All posts <Icon name="arrow-right" size={16} />
        </a>
      </div>
      <div class="post-grid">
        {posts.map((p) => (
          <PostCard post={p} />
        ))}
      </div>
    </Section>
  );
}

export function Cta({ s }: { s: Settings }) {
  const c = s.home.cta;
  const wa = s.site.whatsapp || s.site.phone;
  return (
    <section class={`cta-band${c.image ? ' has-image' : ''}`}>
      {c.image ? <Img class="cta-img" src={c.image} attrs={{ 'data-parallax': '0.18' }} /> : null}
      {s.theme.heroPattern && !c.image ? <div class="pattern" aria-hidden="true"></div> : null}
      <div class="container cta-inner" data-reveal>
        <div>
          <h2>{c.title}</h2>
          {c.text ? <p>{c.text}</p> : null}
        </div>
        <div class="cta-actions">
          {s.site.phone ? (
            <a class="btn btn-accent btn-lg" href={telLink(s.site.phone)}>
              <Icon name="phone" size={18} /> {s.site.phone}
            </a>
          ) : null}
          {wa ? (
            <a class="btn btn-whatsapp btn-lg" href={waLink(wa, `Hi ${s.site.name}, I'd like to book a room.`)} target="_blank" rel="noopener">
              <Icon name="whatsapp" size={18} /> WhatsApp us
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const SECTIONS: Record<string, (d: HomeData) => unknown> = {
  hero: Hero,
  highlights: Highlights,
  rooms: RoomsSection,
  offers: Offers,
  about: About,
  marquee: Marquee,
  amenities: Amenities,
  gallery: Gallery,
  testimonials: Testimonials,
  location: Location,
  faq: Faq,
  blog: Blog,
  cta: ({ s }) => <Cta s={s} />,
};

export function HomePage(data: HomeData) {
  const seen = new Set<string>();
  const order = data.s.home.sections.filter((sec) => sec.enabled && SECTIONS[sec.key] && !seen.has(sec.key) && seen.add(sec.key));
  // Without the hero first, the transparent header needs a dark strip behind it.
  const hasHero = order[0]?.key === 'hero';
  return (
    <>
      {!hasHero ? <div class="header-spacer" aria-hidden="true"></div> : null}
      {order.map((sec) => SECTIONS[sec.key](data))}
    </>
  );
}
