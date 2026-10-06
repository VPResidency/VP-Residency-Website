# VP Residency — website & admin panel

The official website of **VP Residency, Perambalur** (“Classy Comfort Living”) with a built-in admin panel at **`/admin`** where the owner can change everything: rooms, prices, photos, text, blog, pages, colours, fonts, festival themes, SEO and more — no developer needed.

Runs entirely on **Cloudflare’s free plan** (Workers + D1 database + R2 storage). No servers to manage, no monthly bill.

---

## What's inside

### Public website
- **Cinematic home page** — full-screen photo slideshow with slow Ken Burns zoom, word-by-word headline reveal, Google rating badge, floating booking search, scroll-reveal animations, parallax photos, scrolling amenities band.
- **Rooms & search** — filter by dates, guests, AC/Non-AC, budget, sort by price. Rooms marked fully booked for the chosen dates show as unavailable. Live “2 nights × ₹1,300 = ₹2,600” totals.
- **Room pages** — photo grid with lightbox (swipe & keyboard), amenities, house rules, sticky booking card: *Book on WhatsApp* (pre-filled message with dates & guests), *Call*, *Send enquiry*, optional Agoda / MakeMyTrip / Goibibo links.
- **Offers & services**, **gallery** with category filters, **guest reviews**, **FAQ**, **location** with Google Map + roadside-sign photo, **blog** with tags/search/sharing, **custom pages** (About, policies…).
- **Enquiry form** saved to the admin inbox (+ “send on WhatsApp” button). Spam traps, rate limiting, optional Cloudflare Turnstile.
- **Festival themes** — Navaratri, Deepavali, Karthigai Deepam, Christmas, New Year, Pongal, Republic Day, Valentine's, Ramzan, Tamil New Year, Independence Day. Each one switches on automatically by date and can recolour the site, hang a garland (mango-leaf thoranam, marigolds, lights, lanterns, tricolour bunting, hearts) under the menu, run an animation (falling petals, rising lamp glows, fireworks, snow, sparkles, lanterns, confetti, hearts), show festive artwork in the hero and a greeting popup. All artwork is original vector art (`scripts/build-festive-art.py`).
- Mobile-first: sticky Call / WhatsApp / Rooms bar on phones, floating WhatsApp button on computers.

### SEO & Google Search Console
- Per-page titles, descriptions and share images; Open Graph & Twitter cards.
- **Structured data** (schema.org Hotel, HotelRoom, BlogPosting, BreadcrumbList) for rich Google results.
- Automatic **`/sitemap.xml`** and **`/robots.txt`**, canonical URLs, `noindex` for drafts and admin.
- Paste the Search Console / Bing verification tag in *Admin → SEO*; Google Analytics 4 loads only after cookie consent.
- Responsive WebP images (800 px + 1600 px) for fast mobile loading.

### Security
- Admin passwords hashed with PBKDF2-SHA256; sessions stored hashed; `__Host-` HttpOnly Secure cookies.
- **Two-step login (TOTP)** with QR code — works with Google/Microsoft Authenticator.
- CSRF tokens + same-origin checks on every admin action; login lockout after repeated failures.
- Strict Content-Security-Policy with per-request nonce, HSTS, X-Frame-Options, Referrer & Permissions policies.
- Uploads checked by file signature (not file name); SVG/HTML blocked; files served with `nosniff` + sandbox CSP.
- Markdown rendering escapes raw HTML, so blog posts can't inject scripts.
- Owner / Editor roles, activity log, one-click backup & restore.

### Cookies & privacy
- Consent banner (Accept / Essential only / Choose) with Analytics and Maps categories; Google Maps and Analytics load only after consent. Banner text editable. Privacy, Cookie, Terms and House-rules pages included.

### Admin panel (`/admin`)
Dashboard (enquiries, setup checklist, festival status, Search Console steps) · Rooms · Blog · Pages · Gallery · Media library (drag-and-drop, photos auto-compressed to WebP in the browser) · Home-page sections (reorder / hide any section) · Offers · Reviews · FAQs · Amenities · **Theme & fonts with live preview** and 6 presets · **Festival themes** with preview links · Menu & footer · Announcement bar · Business info · Booking settings · SEO · Cookies · Enquiries inbox (status, WhatsApp reply, CSV export) · Users · Security · Activity log · Backup.

---

## Tech stack
- [Hono](https://hono.dev) on **Cloudflare Workers** (server-rendered JSX — fast, SEO-friendly, no client framework)
- **D1** (SQLite) for content, **R2** for uploads, **Workers Static Assets** for CSS/JS/photos
- Plain JavaScript for the site (`public/assets/site.js`) and the admin editor (`public/assets/admin.js`)

```
src/
  index.tsx          app entry: security headers, settings, routes
  public.tsx         public pages, enquiry form, media, sitemap, robots
  admin/routes.tsx   admin panel (auth, 2FA, editors, media, enquiries, users, backup)
  admin/ui.tsx       admin layout & components
  lib/               schemas (every editable field), defaults, festivals, security, auth, SEO…
  views/             public templates
public/              CSS/JS, client photos (images/), logo & icons (brand/), festival art
migrations/          D1 database schema
scripts/             icon + festival-art generators
```

---

## Run it on your computer
Requires Node 22.

```bash
npm install
cp .dev.vars.example .dev.vars        # then set your own ADMIN_SETUP_KEY
npm run db:migrate:local
npm run dev                            # http://127.0.0.1:8787
```
Open `/admin` → you'll be sent to `/admin/setup` to create the owner account using the setup key.

---

## Live site
**Live:** https://vpresidency.in (also https://vp-residency.vpresidency.workers.dev) — Cloudflare account *Vpresidency88@gmail.com*, D1 database `vp-residency-db`.
Search-engine indexing is switched **off** (Admin → SEO → “Allow search engines”) until room prices are confirmed. Domain registered at GoDaddy, DNS on Cloudflare.

### Redeploy after changes
A deploy token for the VP account lives in `.cloudflare-token` (git-ignored, never commit it):
```bash
export CLOUDFLARE_API_TOKEN="$(cat .cloudflare-token)" CLOUDFLARE_ACCOUNT_ID=739caaedda206e3343d369d3251acfa9
npm run db:migrate:remote   # only when migrations/ changed
npm run deploy
```

### Photo storage
Uploads are stored in the D1 database (500 MB free, no card needed). To use R2 instead (10 GB free): enable R2 in the
dashboard, run `npx wrangler r2 bucket create vp-residency-media`, uncomment `r2_buckets` in `wrangler.jsonc` and deploy.
(Files already uploaded to D1 would need re-uploading.)

## Deploy to a fresh Cloudflare account (free)
```bash
npx wrangler d1 create vp-residency-db          # copy the database_id into wrangler.jsonc
npm run db:migrate:remote
npm run deploy
npx wrangler secret put ADMIN_SETUP_KEY          # any long random text; needed once for /admin/setup
```
The site goes live at `https://vp-residency.<your-subdomain>.workers.dev`. Then:

1. Visit `/admin/setup`, enter the setup key and create the owner account.
2. **Custom domain:** Cloudflare dashboard → Workers → *vp-residency* → Settings → Domains → add e.g. `vpresidency.in` (the domain's DNS must be on Cloudflare).
3. *Admin → SEO*: set the live website address, paste the Search Console tag, submit `https://<domain>/sitemap.xml` in Search Console.
4. *Admin → My account*: turn on two-step login.

Updating later: `git pull && npm run deploy` (run `npm run db:migrate:remote` if a new migration was added).

### Free-plan limits (plenty for a lodge)
Workers 100k requests/day · D1 500 MB per database, 5M rows read/day · R2 (optional) 10 GB, zero egress fees. Static files (photos, CSS, JS) don't count against Worker requests.

---

## Owner's guide (short)
- **Change a price / photo:** Admin → Rooms → edit → Save. Changes are live immediately.
- **Room full on certain dates:** in the room, *Availability → Fully booked dates* (or switch on *Sold out*).
- **Festival look:** Admin → Festival themes. Check the dates each year (moon-calendar festivals move). Use *Preview* to see one any time, or *Show now* to switch it on.
- **New colours / fonts:** Admin → Theme & fonts — pick a preset, watch the live preview, Save.
- **Hide or reorder home-page sections:** Admin → Home page → Sections.
- **Enquiries:** Admin → Enquiries — reply on WhatsApp in one tap, mark Contacted / Booked.
- **Backups:** Admin → Backup & restore → Download backup (do this monthly).

## To confirm with the client before launch
- Room prices (₹1,300 Deluxe / ₹1,000 Classic are placeholders from public listings) and the number of rooms.
- Whether Non-AC and Family rooms exist (seeded as hidden drafts).
- Agoda / MakeMyTrip / Goibibo listing links, map coordinates, Facebook page link, GSTIN (optional, shown in footer).
- Cancellation policy wording on the *House Rules* page.
