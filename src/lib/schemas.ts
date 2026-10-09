// Form schemas drive both the admin editor (rendered by public/assets/admin.js) and server-side
// validation (`coerce`). Adding a field here is all it takes to make something editable.
import { ICONS } from './icons-data';
import { FONT_NAME_RE, SYSTEM_FONT } from './fonts';
import { THEME_PRESETS, type SettingsKey } from './defaults';
import { FESTIVAL_ANIMATIONS, FESTIVAL_ART, FESTIVAL_GARLANDS } from './festivals';
import { isDate } from './util';

export type FieldType =
  | 'text' | 'textarea' | 'markdown' | 'code' | 'password' | 'number' | 'url' | 'email' | 'tel' | 'color'
  | 'toggle' | 'select' | 'date' | 'datetime' | 'tags' | 'strings' | 'image' | 'video' | 'fontfile'
  | 'images' | 'icon' | 'font' | 'list' | 'group';

export type Field = {
  k: string;
  t: FieldType;
  label: string;
  help?: string;
  placeholder?: string;
  max?: number;
  min?: number;
  step?: number;
  rows?: number;
  options?: { v: string; l: string }[];
  fields?: Field[];
  /** list: key of the sub-field used as each item's title */
  itemTitle?: string;
  maxItems?: number;
  /** list: only reorder/toggle, no add/remove */
  fixed?: boolean;
  /** list: show an "Add photos" button that creates one item per picked image in this sub-field */
  bulkImage?: string;
  /** text: auto-fill as a slug from this sibling field */
  slugFrom?: string;
  required?: boolean;
  w?: 'half' | 'third';
};

export type FormSection = { title: string; desc?: string; k?: string; fields: Field[] };
export type FormSchema = FormSection[];

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------
export const MEDIA_RE = /^(\/media\/[\w\-./]+|\/(placeholders|images|brand|assets)\/[\w\-./]+|https:\/\/[^\s"'<>()]+)$/;

function str(v: unknown, max: number, multiline = false): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  s = multiline ? s.replace(/\r\n?/g, '\n') : s.replace(/[\r\n]+/g, ' ');
  // strip control characters except newline/tab
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return s.trim().slice(0, max);
}

export function safeUrl(s: string): string {
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  if (s.startsWith('#')) return s;
  if (/^(https?:\/\/|mailto:|tel:)[^\s"'<>]+$/i.test(s)) return s;
  return '';
}

function coerceField(f: Field, v: unknown): unknown {
  switch (f.t) {
    case 'text':
    case 'tel':
    case 'password':
      return str(v, f.max ?? 300);
    case 'textarea':
    case 'code':
      return str(v, f.max ?? 5000, true);
    case 'markdown':
      return str(v, f.max ?? 100_000, true);
    case 'email': {
      const s = str(v, 200);
      return s === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
    }
    case 'url':
      return safeUrl(str(v, 1000));
    case 'number': {
      let n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
      if (!Number.isFinite(n)) n = f.min ?? 0;
      if (f.min !== undefined) n = Math.max(f.min, n);
      if (f.max !== undefined) n = Math.min(f.max, n);
      return f.step && f.step < 1 ? n : Math.round(n);
    }
    case 'color': {
      const s = str(v, 9);
      if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
      if (/^#[0-9a-fA-F]{3}$/.test(s)) return ('#' + [...s.slice(1)].map((c) => c + c).join('')).toUpperCase();
      return '#000000';
    }
    case 'toggle':
      return v === true || v === 'true' || v === 'on' || v === 1 || v === '1';
    case 'select': {
      const s = String(v ?? '');
      return f.options!.some((o) => o.v === s) ? s : f.options![0].v;
    }
    case 'date': {
      const s = str(v, 10);
      return isDate(s) ? s : '';
    }
    case 'datetime': {
      const s = str(v, 16);
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? s : '';
    }
    case 'tags': {
      const arr = Array.isArray(v) ? v : String(v ?? '').split(',');
      return [...new Set(arr.map((x) => str(x, 60)).filter(Boolean))].slice(0, 30);
    }
    case 'strings': {
      const arr = Array.isArray(v) ? v : String(v ?? '').split('\n');
      return arr.map((x) => str(x, f.max ?? 300)).filter(Boolean).slice(0, 50);
    }
    case 'image':
    case 'video':
    case 'fontfile': {
      const s = str(v, 1000);
      return s === '' || MEDIA_RE.test(s) ? s : '';
    }
    case 'images': {
      const arr = Array.isArray(v) ? v : [];
      return arr.map((x) => str(x, 1000)).filter((s) => MEDIA_RE.test(s)).slice(0, 60);
    }
    case 'icon': {
      const s = String(v ?? '');
      return ICONS[s] ? s : 'sparkle';
    }
    case 'font': {
      const s = str(v, 48);
      return s === SYSTEM_FONT || FONT_NAME_RE.test(s) ? s : 'Inter';
    }
    case 'list': {
      const arr = Array.isArray(v) ? v : [];
      return arr.slice(0, f.maxItems ?? 100).map((item) => coerceFields(f.fields!, item));
    }
    case 'group':
      return coerceFields(f.fields!, v);
  }
}

export function coerceFields(fields: Field[], input: unknown): Record<string, unknown> {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const f of fields) out[f.k] = coerceField(f, src[f.k]);
  return out;
}

export function coerce(schema: FormSchema, input: unknown): Record<string, unknown> {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const section of schema) {
    if (section.k) out[section.k] = coerceFields(section.fields, src[section.k]);
    else Object.assign(out, coerceFields(section.fields, src));
  }
  return out;
}

export function missingRequired(schema: FormSchema, value: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const section of schema) {
    const scope = (section.k ? value[section.k] : value) as Record<string, unknown>;
    for (const f of section.fields) if (f.required && !scope?.[f.k]) missing.push(f.label);
  }
  return missing;
}

// ---------------------------------------------------------------------------------------------
// Reusable field sets
// ---------------------------------------------------------------------------------------------
const linkList = (k: string, label: string): Field => ({
  k, t: 'list', label, itemTitle: 'label', maxItems: 20,
  fields: [
    { k: 'label', t: 'text', label: 'Label', w: 'half', max: 60 },
    { k: 'url', t: 'url', label: 'Link', w: 'half', placeholder: '/rooms or https://…' },
  ],
});
const iconItems = (k: string, label: string, textKey = 'label'): Field => ({
  k, t: 'list', label, itemTitle: textKey, maxItems: 40,
  fields: [
    { k: 'icon', t: 'icon', label: 'Icon', w: 'third' },
    { k: textKey, t: 'text', label: 'Text', w: 'half', max: 80 },
  ],
});
const sectionHead = (extra: Field[] = []): Field[] => [
  { k: 'eyebrow', t: 'text', label: 'Small heading', w: 'half', max: 80 },
  { k: 'title', t: 'text', label: 'Heading', w: 'half', max: 140 },
  ...extra,
];
const seoFields: Field[] = [
  { k: 'seoTitle', t: 'text', label: 'SEO title', max: 90, help: 'Shown in Google results. Leave empty to use the name/title.' },
  { k: 'seoDescription', t: 'textarea', label: 'SEO description', max: 300, rows: 3, help: '150–160 characters works best.' },
  { k: 'ogImage', t: 'image', label: 'Share image', help: 'Shown when the link is shared on WhatsApp / Facebook. Defaults to the first photo.' },
];
const HOME_SECTION_OPTIONS = [
  { v: 'hero', l: 'Hero banner' }, { v: 'highlights', l: 'Highlights strip' }, { v: 'rooms', l: 'Rooms' }, { v: 'offers', l: 'Offers & services' },
  { v: 'about', l: 'About' }, { v: 'marquee', l: 'Scrolling amenities band' }, { v: 'amenities', l: 'Amenities' }, { v: 'gallery', l: 'Gallery' },
  { v: 'testimonials', l: 'Guest reviews' }, { v: 'location', l: 'Location & map' }, { v: 'faq', l: 'FAQ' },
  { v: 'blog', l: 'Latest blog posts' }, { v: 'cta', l: 'Call-to-action band' },
];
const colour = (k: string, label: string, help?: string): Field => ({ k, t: 'color', label, w: 'third', help });

// ---------------------------------------------------------------------------------------------
// Settings forms
// ---------------------------------------------------------------------------------------------
export type SettingsForm = { title: string; desc: string; icon: string; group: string; owner?: boolean; schema: FormSchema };

export const SETTINGS_FORMS: Record<SettingsKey, SettingsForm> = {
  site: {
    title: 'Business info', desc: 'Name, logo, phone numbers, address and social links used across the site.', icon: 'building', group: 'Settings',
    schema: [
      { title: 'Identity', fields: [
        { k: 'name', t: 'text', label: 'Business name', w: 'half', required: true, max: 80 },
        { k: 'tagline', t: 'text', label: 'Tagline', w: 'half', max: 120 },
        { k: 'logo', t: 'image', label: 'Logo', w: 'half', help: 'Shown in the header. A transparent PNG works best. Leave empty to show the name as text.' },
        { k: 'logoLight', t: 'image', label: 'Logo for dark backgrounds', w: 'half', help: 'Optional white version, used over photos and in the footer.' },
        { k: 'logoHeight', t: 'number', label: 'Logo height (px)', min: 24, max: 96, w: 'third' },
        { k: 'showNameWithLogo', t: 'toggle', label: 'Show the name & tagline next to the logo', w: 'half' },
        { k: 'favicon', t: 'image', label: 'Browser icon (favicon)', w: 'half', help: 'Square image, at least 512 × 512.' },
      ] },
      { title: 'Contact', fields: [
        { k: 'phone', t: 'tel', label: 'Phone', w: 'half' },
        { k: 'phoneAlt', t: 'tel', label: 'Second phone (optional)', w: 'half' },
        { k: 'whatsapp', t: 'tel', label: 'WhatsApp number', w: 'half', help: 'Used for all "Book on WhatsApp" buttons.' },
        { k: 'email', t: 'email', label: 'E-mail', w: 'half' },
      ] },
      { title: 'Address & map', fields: [
        { k: 'addressLine1', t: 'text', label: 'Address line 1', w: 'half' },
        { k: 'addressLine2', t: 'text', label: 'Address line 2 / landmark', w: 'half' },
        { k: 'city', t: 'text', label: 'City', w: 'third' },
        { k: 'state', t: 'text', label: 'State', w: 'third' },
        { k: 'pincode', t: 'text', label: 'PIN code', w: 'third', max: 10 },
        { k: 'mapLink', t: 'url', label: 'Google Maps link', help: 'Open your listing in Google Maps → Share → Copy link, and paste it here.' },
        { k: 'mapEmbedQuery', t: 'text', label: 'What the embedded map should show', help: 'Usually your business name and full address.' },
        { k: 'lat', t: 'text', label: 'Latitude (optional)', w: 'half', max: 20, help: 'Improves your Google listing. Right-click your pin in Google Maps to copy it.' },
        { k: 'lng', t: 'text', label: 'Longitude (optional)', w: 'half', max: 20 },
        { k: 'streetPhoto', t: 'image', label: 'Photo of your roadside sign', help: 'Shown next to the map to help guests find you.' },
      ] },
      { title: 'Stay details', fields: [
        { k: 'checkIn', t: 'text', label: 'Check-in time', w: 'third', max: 20 },
        { k: 'checkOut', t: 'text', label: 'Check-out time', w: 'third', max: 20 },
        { k: 'frontDesk', t: 'text', label: 'Front desk hours', w: 'third', max: 60 },
      ] },
      { title: 'Google reviews', desc: 'Shown as a badge on the home page and in the reviews section.', fields: [
        { k: 'googleRating', t: 'text', label: 'Rating', w: 'third', max: 4 },
        { k: 'googleReviewCount', t: 'text', label: 'Number of reviews', w: 'third', max: 8 },
        { k: 'googleReviewsUrl', t: 'url', label: 'Link to your Google reviews', w: 'third' },
      ] },
      { title: 'Social media', fields: [
        { k: 'instagram', t: 'url', label: 'Instagram', w: 'third' },
        { k: 'facebook', t: 'url', label: 'Facebook', w: 'third' },
        { k: 'youtube', t: 'url', label: 'YouTube', w: 'third' },
      ] },
      { title: 'Footer', fields: [
        { k: 'footerAbout', t: 'textarea', label: 'Short description', rows: 3, max: 400 },
        { k: 'gstin', t: 'text', label: 'GSTIN (optional)', max: 20, help: 'Shown in the footer for business travellers who need GST invoices.' },
        { k: 'copyright', t: 'text', label: 'Copyright line', help: '{year} becomes the current year.' },
      ] },
    ],
  },

  booking: {
    title: 'Booking & prices', desc: 'How guests book, WhatsApp message text, currency and travel-site links.', icon: 'calendar-days', group: 'Settings',
    schema: [
      { title: 'What guests can see', desc: 'Switch these on only when you want them visible on the website.', fields: [
        { k: 'showPrices', t: 'toggle', label: 'Show room prices on the website', w: 'half' },
        { k: 'showCategories', t: 'toggle', label: 'Show room categories (Deluxe, Classic…)', w: 'half' },
      ] },
      { title: 'Booking buttons', fields: [
        { k: 'bookButtonText', t: 'text', label: '"Book" button text', w: 'half', max: 30 },
        { k: 'bookAction', t: 'select', label: 'What the main Book button does', w: 'half', options: [
          { v: 'whatsapp', l: 'Open WhatsApp chat' }, { v: 'call', l: 'Call the phone number' },
          { v: 'rooms', l: 'Go to the rooms page' }, { v: 'enquiry', l: 'Go to the enquiry form' },
        ] },
        { k: 'whatsappTemplate', t: 'textarea', label: 'WhatsApp booking message', rows: 3, max: 600, help: 'Placeholders: {room} {checkin} {checkout} {guests} {nights}' },
        { k: 'currency', t: 'text', label: 'Currency symbol', w: 'third', max: 4 },
        { k: 'priceSuffix', t: 'text', label: 'Price suffix', w: 'third', max: 20 },
        { k: 'taxNote', t: 'text', label: 'Price note', w: 'third', max: 120 },
      ] },
      { title: 'Website enquiries', desc: 'Enquiries are saved under Inbox → Enquiries.', fields: [
        { k: 'enquiryEnabled', t: 'toggle', label: 'Show the enquiry form' },
        { k: 'enquiryTitle', t: 'text', label: 'Form heading', w: 'half', max: 80 },
        { k: 'enquirySuccess', t: 'text', label: 'Thank-you message', w: 'half', max: 200 },
      ] },
      { title: 'Travel booking sites', desc: 'Buttons to your Agoda / MakeMyTrip / Goibibo pages. Items without a link are hidden.', fields: [
        { k: 'showOtas', t: 'toggle', label: 'Show travel-site buttons on room pages' },
        { k: 'otas', t: 'list', label: 'Sites', itemTitle: 'name', maxItems: 8, fields: [
          { k: 'name', t: 'text', label: 'Name', w: 'third', max: 40 },
          { k: 'url', t: 'url', label: 'Link to your listing', w: 'half' },
        ] },
      ] },
    ],
  },

  home: {
    title: 'Home page', desc: 'Every heading, text and photo on the home page, plus section order.', icon: 'house', group: 'Homepage',
    schema: [
      { title: 'Sections', desc: 'Drag or use the arrows to reorder; switch off what you don\'t need.', fields: [
        { k: 'sections', t: 'list', label: 'Order & visibility', fixed: true, itemTitle: 'key', fields: [
          { k: 'key', t: 'select', label: 'Section', options: HOME_SECTION_OPTIONS, w: 'half' },
          { k: 'enabled', t: 'toggle', label: 'Visible', w: 'third' },
        ] },
      ] },
      { title: 'Hero banner', k: 'hero', fields: [
        { k: 'eyebrow', t: 'text', label: 'Small line above the heading', max: 100 },
        { k: 'title', t: 'textarea', label: 'Main heading', rows: 2, max: 160 },
        { k: 'subtitle', t: 'textarea', label: 'Sub-heading', rows: 2, max: 300 },
        { k: 'images', t: 'images', label: 'Background photos', help: 'Add one photo, or several for a slideshow. Without photos the banner shows a coloured kolam pattern.' },
        { k: 'video', t: 'video', label: 'Background video (optional)', help: 'Short muted MP4. Plays instead of the photos on larger screens.' },
        { k: 'overlay', t: 'number', label: 'Photo darkness (%)', min: 0, max: 90, w: 'third' },
        { k: 'primaryCta', t: 'text', label: 'Main button text', w: 'third', max: 30 },
        { k: 'secondaryCta', t: 'text', label: 'Second button text', w: 'third', max: 30 },
        { k: 'showSearch', t: 'toggle', label: 'Show the room search box' },
      ] },
      { title: 'Highlights strip', k: 'highlights', fields: [
        { k: 'items', t: 'list', label: 'Highlights', itemTitle: 'title', maxItems: 8, fields: [
          { k: 'icon', t: 'icon', label: 'Icon', w: 'third' },
          { k: 'title', t: 'text', label: 'Title', w: 'third', max: 50 },
          { k: 'text', t: 'text', label: 'Text', w: 'third', max: 90 },
        ] },
      ] },
      { title: 'Rooms section', k: 'rooms', fields: sectionHead([
        { k: 'subtitle', t: 'text', label: 'Intro text', max: 200 },
        { k: 'limit', t: 'number', label: 'Rooms to show', min: 1, max: 12, w: 'third' },
      ]) },
      { title: 'About section', k: 'about', fields: sectionHead([
        { k: 'body', t: 'markdown', label: 'Text', rows: 8 },
        { k: 'image', t: 'image', label: 'Main photo', w: 'half' },
        { k: 'image2', t: 'image', label: 'Small overlapping photo', w: 'half' },
        { k: 'points', t: 'strings', label: 'Check-list points', help: 'One per line.', rows: 4 },
        { k: 'ctaText', t: 'text', label: 'Button text', w: 'half', max: 30 },
        { k: 'ctaLink', t: 'url', label: 'Button link', w: 'half' },
      ]) },
      { title: 'Offers section', k: 'offers', desc: 'The offers themselves are under Homepage → Offers.', fields: sectionHead() },
      { title: 'Amenities section', k: 'amenities', desc: 'The amenity list itself is under Homepage → Amenities.', fields: sectionHead([
        { k: 'subtitle', t: 'text', label: 'Intro text', max: 200 },
      ]) },
      { title: 'Gallery section', k: 'gallery', desc: 'Photos are managed under Content → Gallery.', fields: sectionHead([
        { k: 'limit', t: 'number', label: 'Photos to show', min: 3, max: 16, w: 'third' },
      ]) },
      { title: 'Reviews section', k: 'testimonials', fields: sectionHead() },
      { title: 'Location section', k: 'location', fields: sectionHead([
        { k: 'text', t: 'textarea', label: 'Directions text', rows: 3, max: 600 },
        { k: 'nearby', t: 'list', label: 'Nearby places', itemTitle: 'name', maxItems: 12, fields: [
          { k: 'icon', t: 'icon', label: 'Icon', w: 'third' },
          { k: 'name', t: 'text', label: 'Place', w: 'third', max: 80 },
          { k: 'distance', t: 'text', label: 'Distance', w: 'third', max: 40 },
        ] },
      ]) },
      { title: 'FAQ section', k: 'faq', desc: 'Questions are managed under Homepage → FAQs.', fields: sectionHead() },
      { title: 'Blog section', k: 'blog', fields: sectionHead([
        { k: 'limit', t: 'number', label: 'Posts to show', min: 1, max: 6, w: 'third' },
      ]) },
      { title: 'Call-to-action band', k: 'cta', fields: [
        { k: 'title', t: 'text', label: 'Heading', max: 100 },
        { k: 'text', t: 'textarea', label: 'Text', rows: 2, max: 300 },
        { k: 'image', t: 'image', label: 'Background photo (optional)' },
      ] },
    ],
  },

  testimonials: {
    title: 'Guest reviews', desc: 'Reviews shown on the home page.', icon: 'quote', group: 'Homepage',
    schema: [{ title: 'Reviews', desc: 'Copy your best Google reviews here. Stars are hidden when set to "—".', fields: [
      { k: 'items', t: 'list', label: 'Reviews', itemTitle: 'name', maxItems: 40, fields: [
        { k: 'name', t: 'text', label: 'Guest name', w: 'third', max: 60 },
        { k: 'source', t: 'text', label: 'Source', w: 'third', max: 40, placeholder: 'Google' },
        { k: 'rating', t: 'number', label: 'Stars (0 = hide)', min: 0, max: 5, w: 'third' },
        { k: 'text', t: 'textarea', label: 'Review', rows: 3, max: 800 },
      ] },
    ] }],
  },

  faqs: {
    title: 'FAQs', desc: 'Questions and answers on the home page.', icon: 'circle-question-mark', group: 'Homepage',
    schema: [{ title: 'Questions', fields: [
      { k: 'items', t: 'list', label: 'FAQs', itemTitle: 'q', maxItems: 40, fields: [
        { k: 'q', t: 'text', label: 'Question', max: 200 },
        { k: 'a', t: 'textarea', label: 'Answer', rows: 3, max: 1500 },
      ] },
    ] }],
  },

  amenities: {
    title: 'Amenities', desc: 'Facilities shown on the home page.', icon: 'concierge-bell', group: 'Homepage',
    schema: [{ title: 'Amenities', fields: [iconItems('items', 'Amenities')] }],
  },

  gallery: {
    title: 'Gallery', desc: 'Photos for the gallery page and the home-page gallery.', icon: 'images', group: 'Content',
    schema: [
      { title: 'Photos', desc: 'Use "Add photos" to pick several at once, then add captions.', fields: [
        { k: 'items', t: 'list', label: 'Photos', itemTitle: 'caption', bulkImage: 'image', maxItems: 200, fields: [
          { k: 'image', t: 'image', label: 'Photo', w: 'third' },
          { k: 'caption', t: 'text', label: 'Caption', w: 'third', max: 120 },
          { k: 'category', t: 'text', label: 'Category', w: 'third', max: 40 },
        ] },
      ] },
      { title: 'Categories', fields: [
        { k: 'categories', t: 'strings', label: 'Filter buttons on the gallery page', help: 'One per line, matching the photo categories.', rows: 4 },
      ] },
    ],
  },

  offers: {
    title: 'Offers', desc: 'Offers & services cards on the home page and rooms page.', icon: 'badge-percent', group: 'Homepage',
    schema: [{ title: 'Offers', fields: [
      { k: 'items', t: 'list', label: 'Offers', itemTitle: 'title', maxItems: 12, fields: [
        { k: 'image', t: 'image', label: 'Photo', w: 'third' },
        { k: 'title', t: 'text', label: 'Title', w: 'third', max: 80 },
        { k: 'badge', t: 'text', label: 'Badge', w: 'third', max: 30 },
        { k: 'text', t: 'textarea', label: 'Description', rows: 2, max: 400 },
        { k: 'ctaText', t: 'text', label: 'Button text', w: 'half', max: 30 },
        { k: 'ctaLink', t: 'url', label: 'Button link', w: 'half', help: 'Leave empty to open WhatsApp.' },
      ] },
    ] }],
  },

  festivals: {
    title: 'Festival themes', desc: 'Automatic festive looks with garlands, animations, colours and greeting popups.', icon: 'party-popper', group: 'Appearance',
    schema: [
      { title: 'How festival themes work', desc: 'Each festival switches on by itself between its start and end dates (India time). Use "Show now" to turn one on immediately, or Preview to see it without changing the live site. Festivals that follow the moon move every year — please check their dates.', fields: [
        { k: 'mode', t: 'select', label: 'Festival themes', w: 'half', options: [{ v: 'auto', l: 'On — follow the dates' }, { v: 'off', l: 'Off — never show festival themes' }] },
        { k: 'animationSeconds', t: 'number', label: 'Animation length (seconds, 0 = keep running)', min: 0, max: 120, w: 'half' },
      ] },
      { title: 'Festivals', fields: [
        { k: 'items', t: 'list', label: 'Festivals', itemTitle: 'name', maxItems: 40, fields: [
          { k: 'name', t: 'text', label: 'Festival name', w: 'half', max: 60 },
          { k: 'id', t: 'text', label: 'Short ID', slugFrom: 'name', w: 'half', max: 40, help: 'Used in the preview link.' },
          { k: 'enabled', t: 'toggle', label: 'Enabled', w: 'third' },
          { k: 'forceNow', t: 'toggle', label: 'Show now (ignore dates)', w: 'third' },
          { k: 'start', t: 'date', label: 'Starts', w: 'third' },
          { k: 'end', t: 'date', label: 'Ends', w: 'third' },
          { k: 'greeting', t: 'text', label: 'Greeting bar text', max: 160 },
          { k: 'offer', t: 'text', label: 'Festive offer (optional)', w: 'half', max: 120 },
          { k: 'offerLink', t: 'url', label: 'Offer link', w: 'half' },
          { k: 'art', t: 'select', label: 'Artwork', w: 'third', options: FESTIVAL_ART },
          { k: 'garland', t: 'select', label: 'Garland under the menu', w: 'third', options: FESTIVAL_GARLANDS },
          { k: 'animation', t: 'select', label: 'Animation', w: 'third', options: FESTIVAL_ANIMATIONS },
          { k: 'density', t: 'number', label: 'Animation amount (1–3)', min: 1, max: 3, w: 'third' },
          { k: 'popup', t: 'toggle', label: 'Greeting popup (once per visitor)', w: 'third' },
          { k: 'popupTitle', t: 'text', label: 'Popup title', w: 'half', max: 80 },
          { k: 'popupImage', t: 'image', label: 'Popup image (optional)', w: 'half', help: 'Leave empty to use the artwork.' },
          { k: 'popupText', t: 'textarea', label: 'Popup message', rows: 2, max: 400 },
          { k: 'ctaText', t: 'text', label: 'Popup button text', w: 'half', max: 30 },
          { k: 'ctaLink', t: 'url', label: 'Popup button link', w: 'half', help: 'Empty = rooms page.' },
          { k: 'useColors', t: 'toggle', label: 'Use festive colours', w: 'third' },
          { k: 'primary', t: 'color', label: 'Festive brand colour', w: 'third' },
          { k: 'accent', t: 'color', label: 'Festive accent', w: 'third' },
          { k: 'dark', t: 'color', label: 'Festive dark colour', w: 'third' },
          { k: 'heroImages', t: 'images', label: 'Festive hero photos (optional)', help: 'Replace the home-page banner photos during this festival.' },
        ] },
      ] },
    ],
  },

  theme: {
    title: 'Theme & fonts', desc: 'Colours, fonts, corner style and custom CSS — with a live preview.', icon: 'palette', group: 'Appearance',
    schema: [
      { title: 'Preset', fields: [
        { k: 'preset', t: 'select', label: 'Start from a preset', options: [
          ...Object.entries(THEME_PRESETS).map(([v, p]) => ({ v, l: p.label })), { v: 'custom', l: 'Custom' },
        ], help: 'Choosing a preset fills in the colours and fonts below. You can then fine-tune them.' },
      ] },
      { title: 'Colours', fields: [
        colour('primary', 'Brand colour', 'Buttons, banners, links'),
        colour('primaryInk', 'Text on brand colour'),
        colour('accent', 'Accent colour', 'Highlights, stars, small details'),
        colour('accentInk', 'Text on accent colour'),
        colour('bg', 'Page background'),
        colour('surface', 'Cards & boxes'),
        colour('text', 'Main text'),
        colour('muted', 'Secondary text'),
        colour('border', 'Borders & lines'),
        colour('dark', 'Dark sections & footer'),
        colour('darkInk', 'Text on dark sections'),
      ] },
      { title: 'Typography', fields: [
        { k: 'headingFont', t: 'font', label: 'Heading font', w: 'half' },
        { k: 'bodyFont', t: 'font', label: 'Body font', w: 'half' },
        { k: 'brandFont', t: 'font', label: 'Name / wordmark font', w: 'half', help: 'Used for the business name next to the logo.' },
        { k: 'headingWeight', t: 'select', label: 'Heading weight', w: 'third', options: [
          { v: '400', l: 'Regular' }, { v: '500', l: 'Medium' }, { v: '600', l: 'Semi-bold' }, { v: '700', l: 'Bold' },
        ] },
        { k: 'baseSize', t: 'number', label: 'Base text size (px)', min: 14, max: 20, w: 'third' },
      ] },
      { title: 'Shape & effects', fields: [
        { k: 'radius', t: 'number', label: 'Corner roundness (px)', min: 0, max: 32, w: 'third' },
        { k: 'buttonShape', t: 'select', label: 'Button shape', w: 'third', options: [
          { v: 'pill', l: 'Pill' }, { v: 'rounded', l: 'Rounded' }, { v: 'square', l: 'Square' },
        ] },
        { k: 'heroPattern', t: 'toggle', label: 'Kolam pattern on banners', w: 'third' },
        { k: 'animations', t: 'toggle', label: 'Scroll reveal animations', w: 'third' },
        { k: 'kenBurns', t: 'toggle', label: 'Slow zoom on hero photos', w: 'third' },
        { k: 'parallax', t: 'toggle', label: 'Parallax photos', w: 'third' },
        { k: 'preloader', t: 'toggle', label: 'Logo intro on first visit', w: 'third' },
      ] },
      { title: 'Your own fonts', desc: 'Upload a .woff2 / .ttf font, then type its family name into the font pickers above.', fields: [
        { k: 'customFonts', t: 'list', label: 'Uploaded fonts', itemTitle: 'family', maxItems: 8, fields: [
          { k: 'family', t: 'text', label: 'Family name', w: 'half', max: 48 },
          { k: 'url', t: 'fontfile', label: 'Font file', w: 'half' },
          { k: 'weight', t: 'select', label: 'Weight', w: 'third', options: [
            { v: '400', l: '400 Regular' }, { v: '500', l: '500 Medium' }, { v: '600', l: '600 Semi-bold' },
            { v: '700', l: '700 Bold' }, { v: '100 900', l: 'Variable (all weights)' },
          ] },
          { k: 'style', t: 'select', label: 'Style', w: 'third', options: [{ v: 'normal', l: 'Normal' }, { v: 'italic', l: 'Italic' }] },
        ] },
      ] },
      { title: 'Custom CSS', desc: 'Advanced: extra CSS added after the theme styles.', fields: [
        { k: 'customCss', t: 'code', label: 'CSS', rows: 8, max: 20000 },
      ] },
    ],
  },

  nav: {
    title: 'Menu & footer', desc: 'Header menu, footer links and floating buttons.', icon: 'list', group: 'Appearance',
    schema: [
      { title: 'Header menu', fields: [linkList('links', 'Menu links')] },
      { title: 'Footer links', fields: [linkList('footerLinks', 'Policy & extra links')] },
      { title: 'Buttons', fields: [
        { k: 'showPhone', t: 'toggle', label: 'Show the phone number in the header', w: 'half' },
        { k: 'mobileBar', t: 'toggle', label: 'Sticky Call / WhatsApp bar on phones', w: 'half' },
        { k: 'floatingWhatsapp', t: 'toggle', label: 'Floating WhatsApp button on computers', w: 'half' },
      ] },
    ],
  },

  announcement: {
    title: 'Announcement bar', desc: 'A thin bar above the header for offers and news.', icon: 'megaphone', group: 'Appearance',
    schema: [{ title: 'Announcement', fields: [
      { k: 'enabled', t: 'toggle', label: 'Show the announcement bar' },
      { k: 'text', t: 'text', label: 'Message', max: 160 },
      { k: 'linkText', t: 'text', label: 'Link text', w: 'half', max: 40 },
      { k: 'link', t: 'url', label: 'Link', w: 'half' },
      { k: 'dismissible', t: 'toggle', label: 'Visitors can close it' },
    ] }],
  },

  seo: {
    title: 'SEO & Search Console', desc: 'Google Search Console, Bing, Analytics, page titles and indexing.', icon: 'globe', group: 'Settings',
    schema: [
      { title: 'Website address', fields: [
        { k: 'siteUrl', t: 'url', label: 'Live website address', placeholder: 'https://www.vpresidency.in', help: 'Used for canonical links, the sitemap and share previews. No trailing slash.' },
      ] },
      { title: 'Google results', fields: [
        { k: 'homeTitle', t: 'text', label: 'Home page title', max: 90 },
        { k: 'titleTemplate', t: 'text', label: 'Title pattern for other pages', max: 90, help: '%s is replaced with the page name.' },
        { k: 'description', t: 'textarea', label: 'Default description', rows: 3, max: 300 },
        { k: 'ogImage', t: 'image', label: 'Default share image', help: '1200 × 630 works best on WhatsApp and Facebook.' },
        { k: 'businessType', t: 'select', label: 'Business type (for Google)', w: 'half', options: [
          { v: 'Hotel', l: 'Hotel' }, { v: 'LodgingBusiness', l: 'Lodge' }, { v: 'Motel', l: 'Motel' }, { v: 'Hostel', l: 'Hostel' },
        ] },
        { k: 'priceRange', t: 'text', label: 'Price range', w: 'half', max: 40 },
      ] },
      { title: 'Search Console & Bing verification', desc: 'Choose the "HTML tag" method and paste the whole tag or just its content value.', fields: [
        { k: 'googleVerification', t: 'text', label: 'Google Search Console code', max: 200 },
        { k: 'verifiedByDns', t: 'toggle', label: 'Already verified with a DNS (TXT) record — no code needed' },
        { k: 'bingVerification', t: 'text', label: 'Bing Webmaster code', max: 200 },
      ] },
      { title: 'Analytics', fields: [
        { k: 'ga4Id', t: 'text', label: 'Google Analytics 4 measurement ID', placeholder: 'G-XXXXXXXXXX', max: 20, help: 'Loads only after a visitor accepts analytics cookies.' },
      ] },
      { title: 'Indexing', fields: [
        { k: 'allowIndexing', t: 'toggle', label: 'Allow search engines to list this website', help: 'Switch off only for a test copy of the site.' },
        { k: 'robotsExtra', t: 'code', label: 'Extra robots.txt lines', rows: 3, max: 2000 },
      ] },
    ],
  },

  cookies: {
    title: 'Cookies & privacy', desc: 'Cookie banner text and consent options.', icon: 'cookie', group: 'Settings',
    schema: [{ title: 'Cookie banner', fields: [
      { k: 'enabled', t: 'toggle', label: 'Show the cookie banner' },
      { k: 'title', t: 'text', label: 'Heading', max: 80 },
      { k: 'message', t: 'textarea', label: 'Message', rows: 3, max: 600 },
      { k: 'acceptText', t: 'text', label: 'Accept button', w: 'third', max: 30 },
      { k: 'rejectText', t: 'text', label: 'Reject button', w: 'third', max: 30 },
      { k: 'customizeText', t: 'text', label: 'Choose button', w: 'third', max: 30 },
      { k: 'policyLink', t: 'url', label: 'Cookie policy link', w: 'half' },
      { k: 'analyticsLabel', t: 'text', label: 'Analytics option text', max: 200 },
      { k: 'mediaLabel', t: 'text', label: 'Maps option text', max: 200 },
    ] }],
  },

  security: {
    title: 'Security', desc: 'Bot protection for forms and admin session length.', icon: 'shield-check', group: 'System', owner: true,
    schema: [
      { title: 'Bot protection (Cloudflare Turnstile)', desc: 'Free. Create a widget at dash.cloudflare.com → Turnstile and paste both keys. Leave empty to rely on the built-in spam traps.', fields: [
        { k: 'turnstileSiteKey', t: 'text', label: 'Site key', w: 'half', max: 100 },
        { k: 'turnstileSecret', t: 'password', label: 'Secret key', w: 'half', max: 100 },
        { k: 'protectEnquiry', t: 'toggle', label: 'Protect the enquiry form', w: 'half' },
        { k: 'protectLogin', t: 'toggle', label: 'Protect the admin login', w: 'half' },
      ] },
      { title: 'Admin sessions', fields: [
        { k: 'sessionDays', t: 'number', label: 'Stay signed in for (days)', min: 1, max: 30, w: 'third' },
      ] },
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Rooms, posts, pages
// ---------------------------------------------------------------------------------------------
export const ROOM_SCHEMA: FormSchema = [
  { title: 'Basics', fields: [
    { k: 'name', t: 'text', label: 'Room name', required: true, w: 'half', max: 80 },
    { k: 'slug', t: 'text', label: 'Web address', slugFrom: 'name', w: 'half', max: 80, help: 'yoursite/rooms/…' },
    { k: 'category', t: 'text', label: 'Category', w: 'third', max: 40, placeholder: 'Deluxe' },
    { k: 'status', t: 'select', label: 'Status', w: 'third', options: [{ v: 'published', l: 'Published' }, { v: 'draft', l: 'Draft (hidden)' }] },
    { k: 'sort', t: 'number', label: 'Order', w: 'third', min: 0, max: 999, help: 'Lower shows first.' },
    { k: 'featured', t: 'toggle', label: 'Featured on the home page' },
  ] },
  { title: 'Price & capacity', fields: [
    { k: 'ac', t: 'select', label: 'Type', w: 'third', options: [{ v: 'ac', l: 'AC' }, { v: 'nonac', l: 'Non-AC' }] },
    { k: 'price', t: 'number', label: 'Price per night (₹)', w: 'third', min: 0, max: 1_000_000 },
    { k: 'originalPrice', t: 'number', label: 'Old price (optional)', w: 'third', min: 0, max: 1_000_000, help: 'Shown crossed out.' },
    { k: 'maxAdults', t: 'number', label: 'Adults', w: 'third', min: 1, max: 20 },
    { k: 'maxChildren', t: 'number', label: 'Children', w: 'third', min: 0, max: 10 },
    { k: 'roomCount', t: 'number', label: 'Rooms of this type', w: 'third', min: 1, max: 200 },
    { k: 'beds', t: 'text', label: 'Beds', w: 'half', max: 60, placeholder: '1 double bed' },
    { k: 'size', t: 'text', label: 'Room size', w: 'half', max: 30, placeholder: '180 sq.ft' },
  ] },
  { title: 'Photos', fields: [{ k: 'images', t: 'images', label: 'Photos', help: 'The first photo is the cover. Use the arrows to reorder.' }] },
  { title: 'Description', fields: [
    { k: 'shortDesc', t: 'textarea', label: 'Short description', rows: 2, max: 300 },
    { k: 'description', t: 'markdown', label: 'Full description', rows: 10 },
    { k: 'highlights', t: 'tags', label: 'Highlights', help: 'Short tags, comma separated — e.g. Balcony, Hot water, TV' },
  ] },
  { title: 'Room amenities', fields: [iconItems('amenities', 'Amenities')] },
  { title: 'Availability', desc: 'Mark dates when this room type is full. The search shows it as unavailable for those dates.', fields: [
    { k: 'soldOut', t: 'toggle', label: 'Sold out right now' },
    { k: 'blocked', t: 'list', label: 'Fully booked dates', itemTitle: 'note', maxItems: 100, fields: [
      { k: 'from', t: 'date', label: 'From', w: 'third' },
      { k: 'to', t: 'date', label: 'Until (check-out day)', w: 'third' },
      { k: 'note', t: 'text', label: 'Note', w: 'third', max: 80 },
    ] },
  ] },
  { title: 'Booking', fields: [
    { k: 'bookingUrl', t: 'url', label: 'Direct booking link (optional)', help: 'E.g. this room on Agoda. Adds a "Book online" button.' },
  ] },
  { title: 'SEO', fields: seoFields },
];

export const POST_SCHEMA: FormSchema = [
  { title: 'Post', fields: [
    { k: 'title', t: 'text', label: 'Title', required: true, max: 140 },
    { k: 'slug', t: 'text', label: 'Web address', slugFrom: 'title', max: 80, help: 'yoursite/blog/…' },
    { k: 'cover', t: 'image', label: 'Cover photo' },
    { k: 'excerpt', t: 'textarea', label: 'Summary', rows: 2, max: 300, help: 'Shown on the blog list and in Google.' },
    { k: 'body', t: 'markdown', label: 'Content', rows: 18 },
  ] },
  { title: 'Publishing', fields: [
    { k: 'status', t: 'select', label: 'Status', w: 'third', options: [{ v: 'draft', l: 'Draft' }, { v: 'published', l: 'Published' }] },
    { k: 'publishedAt', t: 'datetime', label: 'Publish date', w: 'third', help: 'A future date schedules the post.' },
    { k: 'author', t: 'text', label: 'Author', w: 'third', max: 60 },
    { k: 'tags', t: 'tags', label: 'Tags', help: 'Comma separated.' },
  ] },
  { title: 'SEO', fields: seoFields },
];

export const PAGE_SCHEMA: FormSchema = [
  { title: 'Page', fields: [
    { k: 'title', t: 'text', label: 'Title', required: true, w: 'half', max: 120 },
    { k: 'slug', t: 'text', label: 'Web address', slugFrom: 'title', w: 'half', max: 80, help: 'yoursite/…' },
    { k: 'subtitle', t: 'text', label: 'Subtitle', max: 200 },
    { k: 'cover', t: 'image', label: 'Banner photo (optional)' },
    { k: 'body', t: 'markdown', label: 'Content', rows: 18 },
  ] },
  { title: 'Settings', fields: [
    { k: 'status', t: 'select', label: 'Status', w: 'third', options: [{ v: 'published', l: 'Published' }, { v: 'draft', l: 'Draft (hidden)' }] },
    { k: 'sort', t: 'number', label: 'Order', w: 'third', min: 0, max: 999 },
    { k: 'showEnquiry', t: 'toggle', label: 'Show the enquiry form under the content', w: 'third' },
  ] },
  { title: 'SEO', fields: [...seoFields, { k: 'noindex', t: 'toggle', label: 'Hide this page from search engines' }] },
];

/** Paths the public site already uses, so a page can't take them over. */
export const RESERVED_SLUGS = new Set([
  'admin', 'rooms', 'blog', 'gallery', 'contact', 'media', 'assets', 'placeholders', 'enquiry', 'api',
  'sitemap.xml', 'robots.txt', 'favicon.ico', 'site.webmanifest', 'search', 'feed.xml',
]);
