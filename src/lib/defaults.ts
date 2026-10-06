import { FESTIVAL_DEFAULTS } from './festivals';

// Default content for every editable settings section. Whatever the admin saves is merged on top,
// so new fields added here appear automatically for existing sites.
// Business facts come from VP Residency's public Google Business profile (Oct 2026).

export type Festival = {
  id: string; name: string; enabled: boolean; forceNow: boolean; start: string; end: string;
  greeting: string; offer: string; offerLink: string;
  popup: boolean; popupTitle: string; popupText: string; popupImage: string; ctaText: string; ctaLink: string;
  art: string; garland: string; animation: string; density: number;
  useColors: boolean; primary: string; accent: string; dark: string; heroImages: string[];
};

export const DEFAULTS = {
  site: {
    name: 'VP Residency',
    tagline: 'Classy Comfort Living',
    logo: '/brand/logo.png',
    logoLight: '/brand/logo-light.png',
    logoHeight: 52,
    showNameWithLogo: true,
    favicon: '/brand/icon-192.png',
    gstin: '',
    phone: '+91 93426 56588',
    phoneAlt: '',
    whatsapp: '+91 93426 56588',
    email: 'vpresidency88@gmail.com',
    addressLine1: '40/40/1, Trichy Main Road, Sungu Pettai',
    addressLine2: 'Near New Bus Stand & Royal Enfield Service Centre',
    city: 'Perambalur',
    state: 'Tamil Nadu',
    pincode: '621212',
    mapLink: 'https://www.google.com/maps/search/?api=1&query=VP+Residency+Trichy+Main+Rd+Sungu+Pettai+Perambalur',
    mapEmbedQuery: 'VP Residency, Trichy Main Rd, Sungu Pettai, Perambalur, Tamil Nadu 621212',
    lat: '',
    lng: '',
    checkIn: '12:00 PM',
    checkOut: '12:00 PM',
    frontDesk: '24-hour front desk',
    googleRating: '4.8',
    googleReviewCount: '82',
    googleReviewsUrl: 'https://www.google.com/maps/search/?api=1&query=VP+Residency+Perambalur',
    instagram: 'https://www.instagram.com/vpresidencyperambalur/',
    facebook: '',
    streetPhoto: '/images/street-sign.webp',
    youtube: '',
    footerAbout:
      'A clean, family-friendly lodge on Trichy Main Road, close to Perambalur New Bus Stand. Air-conditioned rooms, friendly staff and honest prices.',
    copyright: '© {year} VP Residency, Perambalur. All rights reserved.',
  },

  booking: {
    bookButtonText: 'Book Now',
    bookAction: 'whatsapp',
    whatsappTemplate:
      "Hi VP Residency, I'd like to book {room} from {checkin} to {checkout} for {guests} guest(s). Please confirm availability and price.",
    currency: '₹',
    priceSuffix: '/ night',
    taxNote: 'Prices may vary by date. Taxes as applicable.',
    enquiryEnabled: true,
    enquiryTitle: 'Send a booking enquiry',
    enquirySuccess: 'Thank you! We have received your enquiry and will call you back shortly.',
    showOtas: true,
    otas: [
      { name: 'Agoda', url: '' },
      { name: 'MakeMyTrip', url: '' },
      { name: 'Goibibo', url: '' },
    ] as { name: string; url: string }[],
  },

  home: {
    sections: [
      { key: 'hero', enabled: true },
      { key: 'highlights', enabled: true },
      { key: 'rooms', enabled: true },
      { key: 'offers', enabled: true },
      { key: 'about', enabled: true },
      { key: 'marquee', enabled: true },
      { key: 'amenities', enabled: true },
      { key: 'gallery', enabled: true },
      { key: 'testimonials', enabled: true },
      { key: 'location', enabled: true },
      { key: 'faq', enabled: true },
      { key: 'blog', enabled: true },
      { key: 'cta', enabled: true },
    ] as { key: string; enabled: boolean }[],
    hero: {
      eyebrow: 'Classy Comfort Living · Perambalur',
      title: 'Your calm, spotless stay on Trichy Main Road',
      subtitle:
        'Air-conditioned rooms with marble-finish bathrooms, a 24-hour front desk, free Wi-Fi and parking — minutes from Perambalur New Bus Stand.',
      images: ['/images/lounge.webp', '/images/deluxe-room-1.webp', '/images/lobby-1.webp', '/images/corridor-1.webp', '/images/building.webp'] as string[],
      video: '',
      overlay: 50,
      showSearch: true,
      primaryCta: 'Explore rooms',
      secondaryCta: 'Call to book',
    },
    highlights: {
      items: [
        { icon: 'star', title: '4.8 on Google', text: 'Rated by 80+ happy guests' },
        { icon: 'bus', title: 'Near New Bus Stand', text: 'On Trichy Main Road' },
        { icon: 'clock', title: '24-hour front desk', text: 'Early check-in & late check-out on request' },
        { icon: 'wifi', title: 'Free Wi-Fi & parking', text: 'Included with every stay' },
      ] as { icon: string; title: string; text: string }[],
    },
    rooms: {
      eyebrow: 'Stay with us',
      title: 'Rooms designed for a restful night',
      subtitle: 'Spotless air-conditioned rooms with fresh linen, hot water and a TV — for solo travellers, couples and families.',
      limit: 6,
    },
    about: {
      eyebrow: 'About VP Residency',
      title: 'A warm welcome, a spotless room, an honest price',
      body:
        "Whether you're in town for work, a family function, a hospital visit or just passing through on the Trichy–Chennai highway, VP Residency gives you a calm, clean room to rest in.\n\nOur rooms are cleaned every day, our front desk is open round the clock, and our staff are always happy to help — with no surprise charges.",
      image: '/images/reception-1.webp',
      image2: '/images/logo-wall.webp',
      points: [
        'Rooms cleaned and refreshed every day',
        'Marble-finish bathrooms with 24-hour hot water',
        'Family friendly, smoke-free and safe',
        'Friendly staff and no hidden charges',
      ] as string[],
      ctaText: 'More about us',
      ctaLink: '/about',
    },
    amenities: {
      eyebrow: 'Amenities',
      title: 'Everything you need for a restful stay',
      subtitle: 'Simple comforts, done properly.',
    },
    gallery: { eyebrow: 'Gallery', title: 'Take a look around', limit: 8 },
    testimonials: { eyebrow: 'Guest reviews', title: 'What our guests say' },
    location: {
      eyebrow: 'Location',
      title: 'Easy to reach, easy to find',
      text: 'We are on Trichy Main Road in Sungu Pettai — in the same building as the Royal Enfield showroom (VP Motors), close to Perambalur New Bus Stand. Look for our sign at the roadside.',
      nearby: [
        { icon: 'bus', name: 'Perambalur New Bus Stand', distance: 'Close by' },
        { icon: 'hospital', name: 'SPT Hospital', distance: 'Close by' },
        { icon: 'wrench', name: 'Royal Enfield showroom (VP Motors)', distance: 'Same building' },
        { icon: 'navigation', name: 'Trichy Main Road', distance: 'On the highway' },
      ] as { icon: string; name: string; distance: string }[],
    },
    faq: { eyebrow: 'FAQ', title: 'Frequently asked questions' },
    blog: { eyebrow: 'From our blog', title: 'Travel tips & local guides', limit: 3 },
    offers: { eyebrow: 'Offers & services', title: 'Little extras that make a stay special' },
    cta: {
      title: 'Need a room tonight?',
      text: 'Rooms are often available the same day. Call or WhatsApp us for the best rate — our front desk is open 24 hours.',
      image: '/images/corridor-2.webp',
    },
  },

  testimonials: {
    items: [
      { name: 'Satheesh S', text: 'Very friendly staff, clean hotel, affordable price and nice location.', rating: 0, source: 'Google' },
      { name: 'Rajendran K', text: 'Each and every rooms too neat and clean...service too good..', rating: 0, source: 'Google' },
      { name: 'Zakir zakir', text: 'Nice Room Good services No extra charges for anything for cleaning.', rating: 0, source: 'Google' },
    ] as { name: string; text: string; rating: number; source: string }[],
  },

  faqs: {
    items: [
      {
        q: 'What are the check-in and check-out times?',
        a: 'Check-in and check-out are at 12:00 PM. Early check-in and late check-out are available on request, subject to availability.',
      },
      {
        q: 'What kind of rooms do you have?',
        a: 'We have air-conditioned Deluxe and Classic double rooms, each with an attached bathroom, hot water and free Wi-Fi. Call us to ask about other room options and current prices.',
      },
      { q: 'Is parking available?', a: 'Yes, parking is free for all our guests.' },
      { q: 'Is Wi-Fi free?', a: 'Yes, Wi-Fi is free throughout the property.' },
      {
        q: 'How do I book a room?',
        a: 'Call or WhatsApp us on +91 93426 56588, send an enquiry from this website, or book through Agoda, MakeMyTrip or Goibibo.',
      },
      {
        q: 'What ID do I need at check-in?',
        a: 'Every adult guest needs a valid government photo ID such as Aadhaar, driving licence, passport or voter ID.',
      },
      { q: 'Is the hotel family friendly?', a: 'Yes. We are a smoke-free, family-friendly property and welcome children.' },
    ] as { q: string; a: string }[],
  },

  amenities: {
    items: [
      { icon: 'wifi', label: 'Free Wi-Fi' },
      { icon: 'square-parking', label: 'Free parking' },
      { icon: 'snowflake', label: 'Air-conditioned rooms' },
      { icon: 'concierge-bell', label: '24-hour room service' },
      { icon: 'sparkles', label: 'Daily housekeeping' },
      { icon: 'shirt', label: 'Laundry service' },
      { icon: 'clock', label: '24-hour front desk' },
      { icon: 'baby', label: 'Child friendly' },
      { icon: 'cigarette-off', label: 'Smoke-free property' },
      { icon: 'tv', label: 'LED TV' },
      { icon: 'flame', label: '24-hour hot water' },
      { icon: 'shower-head', label: 'Marble-finish bathrooms' },
      { icon: 'lamp-desk', label: 'Work desk & wardrobe' },
      { icon: 'heart', label: 'Room decoration for couples' },
      { icon: 'luggage', label: 'Early check-in on request' },
    ] as { icon: string; label: string }[],
  },

  gallery: {
    categories: ['Rooms', 'Bathrooms', 'Reception & lobby', 'Building'] as string[],
    items: [
      { image: '/images/deluxe-room-1.webp', caption: 'Deluxe AC room with TV and wardrobe', category: 'Rooms' },
      { image: '/images/lobby-1.webp', caption: 'Our lobby', category: 'Reception & lobby' },
      { image: '/images/building.webp', caption: 'VP Residency on Trichy Main Road', category: 'Building' },
      { image: '/images/classic-room-1.webp', caption: 'Classic AC room', category: 'Rooms' },
      { image: '/images/bathroom-1.webp', caption: 'Marble-finish bathroom with hot water', category: 'Bathrooms' },
      { image: '/images/reception-1.webp', caption: '24-hour reception', category: 'Reception & lobby' },
      { image: '/images/room-decor.webp', caption: 'Room decoration for special occasions', category: 'Rooms' },
      { image: '/images/corridor-1.webp', caption: 'Corridor', category: 'Building' },
      { image: '/images/deluxe-room-2.webp', caption: 'Work desk, TV and wardrobe', category: 'Rooms' },
      { image: '/images/lounge.webp', caption: 'Lounge seating', category: 'Reception & lobby' },
      { image: '/images/signboard.webp', caption: 'Our sign', category: 'Building' },
      { image: '/images/classic-room-2.webp', caption: 'Classic AC room', category: 'Rooms' },
      { image: '/images/bathroom-2.webp', caption: 'Attached bathroom', category: 'Bathrooms' },
      { image: '/images/reception-2.webp', caption: 'Reception', category: 'Reception & lobby' },
      { image: '/images/deluxe-room-3.webp', caption: 'Air-conditioned room', category: 'Rooms' },
      { image: '/images/corridor-2.webp', caption: 'Room corridor', category: 'Building' },
      { image: '/images/classic-room-4.webp', caption: 'Room entrance with wash basin', category: 'Rooms' },
      { image: '/images/bathroom-4.webp', caption: 'Bathroom', category: 'Bathrooms' },
      { image: '/images/lobby-2.webp', caption: 'Lobby', category: 'Reception & lobby' },
      { image: '/images/street-sign.webp', caption: 'Our roadside sign on Trichy Main Road', category: 'Building' },
    ] as { image: string; caption: string; category: string }[],
  },

  offers: {
    items: [
      {
        title: 'Room decoration for couples',
        text: 'Celebrating an anniversary, honeymoon or birthday? Ask for our towel-art and rose-petal room decoration when you book.',
        image: '/images/room-decor.webp', badge: 'Special occasions', ctaText: 'Ask on WhatsApp', ctaLink: '',
      },
      {
        title: 'Early check-in & late check-out',
        text: 'Arriving early by bus or leaving late? Tell us your timings — early check-in and late check-out are available on request.',
        image: '/images/corridor-1.webp', badge: 'Flexible', ctaText: 'Call us', ctaLink: 'tel:+919342656588',
      },
      {
        title: 'Rooms available tonight',
        text: 'Walk in or call ahead — same-day bookings are welcome and our front desk is open round the clock.',
        image: '/images/reception-1.webp', badge: '24 × 7', ctaText: 'Check rooms', ctaLink: '/rooms',
      },
    ] as { title: string; text: string; image: string; badge: string; ctaText: string; ctaLink: string }[],
  },

  festivals: {
    mode: 'auto',
    animationSeconds: 14,
    items: FESTIVAL_DEFAULTS,
  },

  theme: {
    preset: 'vp',
    primary: '#5A1E1E',
    primaryInk: '#FFFFFF',
    accent: '#CBA945',
    accentInk: '#2A1B08',
    bg: '#FBF7F0',
    surface: '#FFFFFF',
    text: '#24191A',
    muted: '#6E6261',
    border: '#ECE2D3',
    dark: '#2A1012',
    darkInk: '#F6ECD8',
    headingFont: 'Cormorant Garamond',
    bodyFont: 'Manrope',
    brandFont: 'Cinzel',
    headingWeight: '600',
    baseSize: 16,
    radius: 16,
    buttonShape: 'pill',
    heroPattern: true,
    animations: true,
    kenBurns: true,
    parallax: true,
    preloader: true,
    customFonts: [] as { family: string; url: string; weight: string; style: string }[],
    customCss: '',
  },

  nav: {
    links: [
      { label: 'Home', url: '/' },
      { label: 'Rooms', url: '/rooms' },
      { label: 'Gallery', url: '/gallery' },
      { label: 'About', url: '/about' },
      { label: 'Blog', url: '/blog' },
      { label: 'Contact', url: '/contact' },
    ] as { label: string; url: string }[],
    footerLinks: [
      { label: 'Privacy Policy', url: '/privacy-policy' },
      { label: 'Terms & Conditions', url: '/terms' },
      { label: 'Cookie Policy', url: '/cookie-policy' },
      { label: 'House Rules & Cancellation', url: '/house-rules' },
    ] as { label: string; url: string }[],
    showPhone: true,
    mobileBar: true,
    floatingWhatsapp: true,
  },

  announcement: {
    enabled: true,
    text: 'Early check-in & late check-out available on request',
    linkText: 'Call +91 93426 56588',
    link: 'tel:+919342656588',
    dismissible: true,
  },

  seo: {
    siteUrl: '',
    titleTemplate: '%s | VP Residency Perambalur',
    homeTitle: 'VP Residency Perambalur – AC Rooms near New Bus Stand | Classy Comfort Living',
    description:
      'VP Residency is a clean, family-friendly lodge on Trichy Main Road near Perambalur New Bus Stand. Air-conditioned rooms, free Wi-Fi, free parking and a 24-hour front desk. Call +91 93426 56588.',
    ogImage: '/brand/og-image.jpg',
    googleVerification: '',
    verifiedByDns: false,
    bingVerification: '',
    ga4Id: '',
    allowIndexing: true,
    robotsExtra: '',
    businessType: 'Hotel',
    priceRange: '₹900 – ₹1,500',
  },

  cookies: {
    enabled: true,
    title: 'We value your privacy',
    message:
      'We use essential cookies to run this website. With your permission, we would also like to use analytics cookies to understand how visitors use the site, and to load Google Maps.',
    acceptText: 'Accept all',
    rejectText: 'Essential only',
    customizeText: 'Choose',
    policyLink: '/cookie-policy',
    analyticsLabel: 'Analytics — helps us see which pages are useful (Google Analytics).',
    mediaLabel: 'Maps & media — shows the Google Map of our location.',
  },

  security: {
    turnstileSiteKey: '',
    turnstileSecret: '',
    protectEnquiry: true,
    protectLogin: true,
    sessionDays: 7,
  },
};

export type Settings = typeof DEFAULTS;
export type SettingsKey = keyof Settings;
export const SETTINGS_KEYS = Object.keys(DEFAULTS) as SettingsKey[];

/** Deep-merge saved values over defaults. Arrays and scalars from `saved` win as a whole. */
export function mergeDefaults<T>(base: T, saved: unknown): T {
  if (saved === undefined || saved === null) return base;
  if (Array.isArray(base) || typeof base !== 'object' || base === null) {
    return (typeof saved === typeof base || (Array.isArray(base) && Array.isArray(saved)) ? saved : base) as T;
  }
  if (typeof saved !== 'object' || Array.isArray(saved)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(saved as Record<string, unknown>)) {
    out[k] = k in out ? mergeDefaults(out[k], v) : v;
  }
  return out as T;
}

export const THEME_PRESETS: Record<string, { label: string; values: Partial<Settings['theme']> }> = {
  vp: {
    label: 'VP Residency (logo colours)',
    values: {
      primary: '#5A1E1E', primaryInk: '#FFFFFF', accent: '#CBA945', accentInk: '#2A1B08', bg: '#FBF7F0', surface: '#FFFFFF',
      text: '#24191A', muted: '#6E6261', border: '#ECE2D3', dark: '#2A1012', darkInk: '#F6ECD8',
      headingFont: 'Cormorant Garamond', bodyFont: 'Manrope', brandFont: 'Cinzel',
    },
  },
  maroon: {
    label: 'Royal Maroon & Gold',
    values: {
      primary: '#7A1F2B', primaryInk: '#FFFFFF', accent: '#C9A14A', accentInk: '#1F1A17', bg: '#FBF8F3', surface: '#FFFFFF',
      text: '#1F1A17', muted: '#6B625A', border: '#E9E1D5', dark: '#1F1416', darkInk: '#F5EEE6',
      headingFont: 'Playfair Display', bodyFont: 'DM Sans',
    },
  },
  navy: {
    label: 'Midnight Navy & Brass',
    values: {
      primary: '#1B2A4A', primaryInk: '#FFFFFF', accent: '#C8A165', accentInk: '#14110D', bg: '#F7F6F2', surface: '#FFFFFF',
      text: '#161B26', muted: '#5D6472', border: '#E2E2DC', dark: '#0F1626', darkInk: '#EEF0F5',
      headingFont: 'Cormorant Garamond', bodyFont: 'Manrope',
    },
  },
  emerald: {
    label: 'Temple Green',
    values: {
      primary: '#16523F', primaryInk: '#FFFFFF', accent: '#D9A441', accentInk: '#1A1408', bg: '#F6F7F2', surface: '#FFFFFF',
      text: '#16201B', muted: '#5C6862', border: '#DFE5DE', dark: '#0E201A', darkInk: '#EAF2EE',
      headingFont: 'Fraunces', bodyFont: 'Plus Jakarta Sans',
    },
  },
  teal: {
    label: 'Peacock Teal',
    values: {
      primary: '#0F5E6B', primaryInk: '#FFFFFF', accent: '#E07A3F', accentInk: '#FFFFFF', bg: '#F5F8F8', surface: '#FFFFFF',
      text: '#122226', muted: '#56696D', border: '#DCE6E7', dark: '#0B2227', darkInk: '#E9F3F4',
      headingFont: 'DM Serif Display', bodyFont: 'Inter',
    },
  },
  minimal: {
    label: 'Modern Charcoal',
    values: {
      primary: '#1F1F1F', primaryInk: '#FFFFFF', accent: '#B8874B', accentInk: '#FFFFFF', bg: '#FAFAF8', surface: '#FFFFFF',
      text: '#1A1A1A', muted: '#64645F', border: '#E6E5E0', dark: '#141414', darkInk: '#F2F2EF',
      headingFont: 'Outfit', bodyFont: 'Outfit',
    },
  },
};
