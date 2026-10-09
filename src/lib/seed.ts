// Starter content inserted the first time the site runs. Everything here is editable in the admin.
// Room prices are placeholders based on public listings (₹900–₹1,500) — confirm them with the owner.

const amenity = (icon: string, label: string) => ({ icon, label });

const ROOMS = [
  {
    slug: 'ac-room', name: 'AC Room', status: 'published', featured: 1, sort: 1, ac: 'ac', price: 1300,
    data: {
      category: '', originalPrice: 0, maxAdults: 2, maxChildren: 1, roomCount: 1, beds: '1 double bed', size: '',
      images: [
        '/images/deluxe-room-1.webp', '/images/classic-room-1.webp', '/images/deluxe-room-2.webp', '/images/classic-room-2.webp',
        '/images/deluxe-room-3.webp', '/images/classic-room-3.webp', '/images/classic-room-4.webp', '/images/bathroom-2.webp', '/images/bathroom-1.webp',
      ],
      shortDesc: 'Clean, comfortable air-conditioned rooms with a double bed, attached marble-finish bathroom, 24-hour hot water and free Wi-Fi.',
      description:
        'Unwind in a quiet, air-conditioned room after a long day on the road. Each AC room has a comfortable double bed with crisp white linen and a fresh duvet, a ceiling fan, and an attached bathroom finished in marble-look tiles with a western toilet, health faucet and a geyser for hot water any time.\n\nMany rooms also have an LED TV, a work desk and a full-height wardrobe — ask us when you book.\n\n**Good for:** business trips, family visits, hospital visits and overnight halts on the Trichy–Chennai highway.',
      highlights: ['Air-conditioned', 'Hot water', 'Free Wi-Fi'],
      amenities: [
        amenity('snowflake', 'Inverter air conditioner'), amenity('wifi', 'Free Wi-Fi'), amenity('fan', 'Ceiling fan'),
        amenity('flame', 'Geyser — hot water 24 h'), amenity('shower-head', 'Marble-finish bathroom'), amenity('tv', 'LED TV (most rooms)'),
        amenity('sparkles', 'Daily housekeeping'), amenity('concierge-bell', 'Room service'), amenity('square-parking', 'Free parking'),
      ],
      soldOut: false, blocked: [], bookingUrl: '', seoTitle: '', seoDescription: '', ogImage: '',
    },
  },
  {
    slug: 'non-ac-room', name: 'Non-AC Room', status: 'published', featured: 1, sort: 2, ac: 'nonac', price: 800,
    data: {
      category: '', originalPrice: 0, maxAdults: 2, maxChildren: 1, roomCount: 1, beds: '1 double bed', size: '',
      images: [],
      shortDesc: 'A clean, airy and budget-friendly room with a ceiling fan, double bed and attached bathroom with hot water.',
      description:
        'Our budget-friendly option — a neat, well-ventilated room with a comfortable double bed, ceiling fan and an attached bathroom with hot water. Everything you need for a good night\'s sleep.',
      highlights: ['Budget friendly', 'Ceiling fan', 'Hot water'],
      amenities: [
        amenity('fan', 'Ceiling fan'), amenity('wifi', 'Free Wi-Fi'), amenity('shower-head', 'Attached bathroom'),
        amenity('flame', 'Hot water'), amenity('sparkles', 'Daily housekeeping'), amenity('square-parking', 'Free parking'),
      ],
      soldOut: false, blocked: [], bookingUrl: '', seoTitle: '', seoDescription: '', ogImage: '',
    },
  },
  {
    slug: 'family-ac-room', name: 'Family AC Room', status: 'draft', featured: 0, sort: 3, ac: 'ac', price: 1800,
    data: {
      category: '', originalPrice: 0, maxAdults: 4, maxChildren: 2, roomCount: 1, beds: '2 double beds', size: '',
      images: [],
      shortDesc: 'A spacious air-conditioned room for families and small groups travelling together.',
      description: 'Add photos and details, then set the status to Published to show this room on the website.',
      highlights: ['Sleeps 4', 'Air-conditioned'],
      amenities: [amenity('snowflake', 'Air conditioning'), amenity('users', 'Space for families'), amenity('wifi', 'Free Wi-Fi'), amenity('flame', 'Hot water')],
      soldOut: false, blocked: [], bookingUrl: '', seoTitle: '', seoDescription: '', ogImage: '',
    },
  },
];

const POSTS = [
  {
    slug: 'welcome-to-vp-residency-perambalur',
    title: 'Welcome to VP Residency, Perambalur',
    published_at: '2026-10-01 10:00',
    tags: 'news,perambalur',
    data: {
      cover: '/images/building.webp',
      excerpt: 'Spotless air-conditioned rooms on Trichy Main Road, close to Perambalur New Bus Stand — here is what to expect when you stay with us.',
      author: 'VP Residency',
      body:
        "Looking for a clean, safe and affordable place to stay in Perambalur? VP Residency is on **Trichy Main Road in Sungu Pettai**, beside the Royal Enfield service centre and close to the New Bus Stand.\n\n## Rooms for every trip\nOur **AC and Non-AC rooms** come with fresh white linen, an attached marble-finish bathroom with hot water, and free Wi-Fi. Every room is cleaned daily.\n\n## What's included\n- Free Wi-Fi\n- Free parking\n- 24-hour front desk and room service\n- Laundry service\n- A smoke-free, family-friendly environment\n\n## Check-in made easy\nCheck-in and check-out are at **12:00 PM**. Need to arrive early or leave late? Just ask — early check-in and late check-out are available on request.\n\n## How to book\nCall or WhatsApp us on **+91 93426 56588**, send an enquiry from the [Rooms page](/rooms), or book through your favourite travel site. We look forward to hosting you!",
      seoTitle: '', seoDescription: '', ogImage: '',
    },
  },
  {
    slug: 'places-to-visit-around-perambalur',
    title: 'Places to visit in and around Perambalur',
    published_at: '2026-10-03 10:00',
    tags: 'travel guide,perambalur',
    data: {
      cover: '/images/street-view.webp',
      excerpt: 'Temples, a historic fort and a park full of ancient fossil trees — ideas for your free time while you stay in Perambalur.',
      author: 'VP Residency',
      body:
        "Perambalur is more than a stop on the highway. If you have a few spare hours during your stay, here are some places guests enjoy.\n\n## Siruvachur Madhura Kaliamman Temple\nOne of the best-known temples in the district, a short drive from town. It draws large crowds on festival days — check the opening days before you set out.\n\n## Ranjankudi Fort\nA historic fort on a rocky hill, popular with history lovers and photographers. Go early in the morning or late afternoon to avoid the heat.\n\n## National Fossil Wood Park, Sathanur\nSee fossilised tree trunks that are millions of years old — a fascinating stop for children and adults alike.\n\n## Chettikulam\nKnown for its hill temple and the walk up with views over the surrounding countryside.\n\n---\n\n**Tip:** our front desk is open 24 hours. Ask us for directions, local food recommendations or help arranging an auto or taxi.",
      seoTitle: '', seoDescription: '', ogImage: '',
    },
  },
];

const PAGES = [
  {
    slug: 'about', title: 'About Us', sort: 1,
    data: {
      subtitle: 'A clean, friendly and affordable stay on Trichy Main Road, Perambalur.',
      cover: '/images/lobby-1.webp',
      body:
        "VP Residency is a family-friendly lodge in **Sungu Pettai, Perambalur**, on Trichy Main Road near the New Bus Stand.\n\nWe opened with a simple idea: travellers deserve a spotless room, a warm welcome and honest prices. Our guests tell us it's the cleanliness, the friendly staff and the convenient location that bring them back — and we're proud of our **4.8-star rating on Google**.\n\n## Why guests choose us\n- Neat, clean AC and Non-AC rooms, refreshed every day\n- Marble-finish bathrooms with 24-hour hot water\n- 24-hour front desk and room service\n- Free Wi-Fi and free parking\n- Laundry service\n- Safe for families, smoke-free\n- Walkable to the New Bus Stand and close to SPT Hospital\n\nWhether you're visiting for business, a family function, a hospital visit or a temple trip, we'll make sure you rest well.",
      showEnquiry: true, seoTitle: 'About VP Residency, Perambalur', seoDescription: '', ogImage: '', noindex: false,
    },
  },
  {
    slug: 'privacy-policy', title: 'Privacy Policy', sort: 10,
    data: {
      subtitle: 'How we handle your personal information.', cover: '',
      body:
        "_Last updated: 5 October 2026_\n\nVP Residency (\"we\", \"us\") runs this website. This policy explains what personal information we collect through the website and how we use it, in line with India's Digital Personal Data Protection Act, 2023.\n\n## Information we collect\n- **Booking enquiries** — when you send an enquiry we collect your name, phone number, e-mail address (optional), stay dates, number of guests and your message.\n- **Technical information** — our hosting provider, Cloudflare, processes your IP address and browser details to deliver the website securely and block abuse. We store the IP address with an enquiry to help prevent spam.\n- **Cookies** — see our [Cookie Policy](/cookie-policy).\n\n## How we use it\nWe use your information only to answer your enquiry, arrange and manage your stay, and keep the website secure. We do not sell or rent your personal information.\n\n## Who we share it with\n- **Cloudflare** — hosts this website and stores enquiries.\n- **Google Analytics** — only if you accept analytics cookies.\n- **Google Maps** — only if you allow maps to load.\n\nIf you contact us on WhatsApp or by phone, WhatsApp's and your mobile provider's own terms also apply. Travel sites you visit from our pages (such as Agoda, MakeMyTrip or Goibibo) have their own privacy policies.\n\n## How long we keep it\nWe keep enquiries only as long as needed to handle your stay and for our records, and then delete them.\n\n## Your rights\nYou can ask us to access, correct or delete your personal information, or withdraw your consent, at any time. Contact us using the details below.\n\n## Contact\nVP Residency, 40/40/1, Trichy Main Road, Sungu Pettai, Perambalur, Tamil Nadu 621212\nPhone: +91 93426 56588 · E-mail: vpresidency88@gmail.com",
      showEnquiry: false, seoTitle: '', seoDescription: '', ogImage: '', noindex: false,
    },
  },
  {
    slug: 'terms', title: 'Terms & Conditions', sort: 11,
    data: {
      subtitle: 'Terms for using this website.', cover: '',
      body:
        "_Last updated: 5 October 2026_\n\nBy using this website you agree to these terms.\n\n## Rooms, prices and bookings\n- Room photos and descriptions are for guidance. Prices shown are indicative and may change by date, season and availability.\n- An enquiry or WhatsApp message is **not** a confirmed booking. A booking is confirmed only when VP Residency confirms it to you.\n- Bookings made through travel websites (Agoda, MakeMyTrip, Goibibo and others) follow that website's terms, prices and cancellation rules.\n- Our [House Rules](/house-rules) apply to every stay.\n\n## Using this website\nPlease don't misuse the website — for example by sending spam, attempting to break its security, or copying its content for commercial use without permission.\n\n## Links to other websites\nWe link to third-party websites for your convenience. We are not responsible for their content or policies.\n\n## Liability\nWe work hard to keep the information on this website accurate, but we cannot guarantee it is always complete or up to date.\n\n## Governing law\nThese terms are governed by the laws of India. Courts in Perambalur, Tamil Nadu, have jurisdiction.\n\n## Contact\nPhone: +91 93426 56588 · E-mail: vpresidency88@gmail.com",
      showEnquiry: false, seoTitle: '', seoDescription: '', ogImage: '', noindex: false,
    },
  },
  {
    slug: 'cookie-policy', title: 'Cookie Policy', sort: 12,
    data: {
      subtitle: 'What cookies we use and how to control them.', cover: '',
      body:
        "_Last updated: 5 October 2026_\n\nCookies are small files a website stores in your browser. We keep them to a minimum.\n\n## Essential (always on)\n| Name | Purpose | Duration |\n|---|---|---|\n| `vp_consent` | Remembers your cookie choices | 6 months |\n| `__Host-vp_admin` | Keeps staff signed in to the admin panel (staff only) | Up to 7 days |\n\n## Analytics (only if you accept)\nGoogle Analytics sets `_ga` and `_ga_*` cookies to count visits and see which pages are useful. They last up to 2 years. They are only set after you choose **Accept all** or switch on Analytics.\n\n## Maps & media (only if you allow)\nThe Google Map of our location loads only after you allow it. Google may then set its own cookies, as described in Google's privacy policy.\n\n## Changing your choice\nUse the **Cookie settings** link at the bottom of any page to change your choice at any time. You can also delete cookies in your browser settings.",
      showEnquiry: false, seoTitle: '', seoDescription: '', ogImage: '', noindex: false,
    },
  },
  {
    slug: 'house-rules', title: 'House Rules & Cancellation', sort: 13,
    data: {
      subtitle: 'Good to know before you arrive.', cover: '',
      body:
        "## Check-in & check-out\n- Check-in: **12:00 PM** · Check-out: **12:00 PM**\n- Early check-in and late check-out are available on request, subject to availability.\n- Our front desk is open 24 hours.\n\n## ID proof\nEvery adult guest must show a valid government photo ID at check-in (Aadhaar, driving licence, passport or voter ID).\n\n## During your stay\n- VP Residency is a smoke-free property.\n- Please take care of the room and its fittings; damage may be charged.\n- Keep noise low, especially at night, so all guests can rest.\n\n## Changes & cancellation\nIf your plans change, please call or WhatsApp us on **+91 93426 56588** as early as possible. For bookings made through Agoda, MakeMyTrip, Goibibo or other travel sites, that site's cancellation policy applies.",
      showEnquiry: false, seoTitle: '', seoDescription: '', ogImage: '', noindex: false,
    },
  },
];

export async function seedContent(db: D1Database): Promise<void> {
  const stmts: D1PreparedStatement[] = [];
  for (const r of ROOMS) {
    const maxGuests = r.data.maxAdults + r.data.maxChildren;
    stmts.push(
      db
        .prepare(
          'INSERT OR IGNORE INTO rooms (slug, name, status, featured, sort, ac, price, max_guests, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(r.slug, r.name, r.status, r.featured, r.sort, r.ac === 'ac' ? 1 : 0, r.price, maxGuests,
          JSON.stringify({ ...r.data, name: r.name, slug: r.slug, status: r.status, featured: !!r.featured, sort: r.sort, ac: r.ac, price: r.price })),
    );
  }
  for (const p of POSTS) {
    stmts.push(
      db
        .prepare("INSERT OR IGNORE INTO posts (slug, title, status, published_at, tags, data) VALUES (?, ?, 'published', ?, ?, ?)")
        .bind(p.slug, p.title, p.published_at, p.tags,
          JSON.stringify({ ...p.data, title: p.title, slug: p.slug, status: 'published', publishedAt: p.published_at.replace(' ', 'T'), tags: p.tags.split(',') })),
    );
  }
  for (const p of PAGES) {
    stmts.push(
      db
        .prepare("INSERT OR IGNORE INTO pages (slug, title, status, sort, data) VALUES (?, ?, 'published', ?, ?)")
        .bind(p.slug, p.title, p.sort, JSON.stringify({ ...p.data, title: p.title, slug: p.slug, status: 'published', sort: p.sort })),
    );
  }
  await db.batch(stmts);
}
