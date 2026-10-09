// Festival themes: each one can recolour the site, hang a garland under the header, run a short
// animation (petals, lamps, snow…), show a greeting popup and swap the announcement bar.
// They switch on automatically between their start and end dates (India time).
// Moon-calendar festivals move every year — the admin should check those dates annually.
import type { Festival, Settings } from './defaults';
import { todayIso } from './util';

export const FESTIVAL_ART = [
  { v: 'diya', l: 'Diya (oil lamp)' },
  { v: 'lamps', l: 'Row of agal vilakku' },
  { v: 'pongal', l: 'Pongal pot & sugarcane' },
  { v: 'kalash', l: 'Kalasam with mango leaves' },
  { v: 'xmas', l: 'Christmas tree & star' },
  { v: 'newyear', l: 'Fireworks burst' },
  { v: 'crescent', l: 'Crescent moon & lantern' },
  { v: 'tricolor', l: 'Tricolour ribbons' },
  { v: 'hearts', l: 'Hearts & roses' },
  { v: 'none', l: 'No artwork' },
];

export const FESTIVAL_GARLANDS = [
  { v: 'mango', l: 'Mango-leaf thoranam' },
  { v: 'marigold', l: 'Marigold swags' },
  { v: 'lights', l: 'String lights' },
  { v: 'tricolor', l: 'Tricolour bunting' },
  { v: 'lanterns', l: 'Hanging lanterns' },
  { v: 'hearts', l: 'Hearts string' },
  { v: 'none', l: 'No garland' },
];

export const FESTIVAL_ANIMATIONS = [
  { v: 'petals', l: 'Falling marigold & rose petals' },
  { v: 'sparkles', l: 'Golden sparkles' },
  { v: 'diyas', l: 'Rising lamp glows' },
  { v: 'fireworks', l: 'Fireworks' },
  { v: 'snow', l: 'Snowfall' },
  { v: 'confetti', l: 'Confetti' },
  { v: 'lanterns', l: 'Floating lanterns' },
  { v: 'hearts', l: 'Floating hearts' },
  { v: 'tricolor', l: 'Tricolour confetti' },
  { v: 'none', l: 'No animation' },
];

const base = {
  enabled: true, forceNow: false, offer: '', offerLink: '', popup: true, popupImage: '', ctaLink: '',
  density: 2, useColors: false, primary: '#5A1E1E', accent: '#CBA945', dark: '#2A1012', heroImages: [] as string[],
};

export const FESTIVAL_DEFAULTS: Festival[] = [
  {
    ...base, id: 'navaratri', name: 'Navaratri, Saraswathi & Ayudha Pooja', start: '2026-10-11', end: '2026-10-20',
    greeting: 'Happy Navaratri, Saraswathi Pooja & Ayudha Pooja from VP Residency',
    popupTitle: 'Happy Navaratri!', popupText: 'Wishing you and your family a blessed Saraswathi Pooja and Ayudha Pooja. Travelling home for the festival? Our rooms are ready for you.',
    ctaText: 'Book your stay', art: 'kalash', garland: 'mango', animation: 'petals',
    useColors: true, primary: '#7A1730', accent: '#E0A526', dark: '#2E0C16',
  },
  {
    ...base, id: 'deepavali', name: 'Deepavali', start: '2026-11-01', end: '2026-11-10',
    greeting: 'Happy Deepavali! May the festival of lights bring you joy and prosperity',
    popupTitle: 'Happy Deepavali!', popupText: 'Wishing you a bright and joyful Deepavali. Coming to Perambalur for the festival? Celebrate with a comfortable stay at VP Residency.',
    ctaText: 'Book a festive stay', art: 'diya', garland: 'marigold', animation: 'diyas', density: 2,
    useColors: true, primary: '#6E1423', accent: '#F2A93B', dark: '#25070D',
  },
  {
    ...base, id: 'karthigai-deepam', name: 'Karthigai Deepam', start: '2026-11-22', end: '2026-11-25',
    greeting: 'Happy Karthigai Deepam — may every lamp light your way',
    popupTitle: 'Happy Karthigai Deepam!', popupText: 'Wishing you a radiant Karthigai Deepam filled with light and blessings.',
    ctaText: 'Plan your stay', art: 'lamps', garland: 'lights', animation: 'sparkles',
  },
  {
    ...base, id: 'christmas', name: 'Christmas', start: '2026-12-18', end: '2026-12-26',
    greeting: 'Merry Christmas from all of us at VP Residency',
    popupTitle: 'Merry Christmas!', popupText: 'Wishing you peace, joy and a wonderful holiday season. Visiting family for Christmas? Stay with us.',
    ctaText: 'Book your stay', art: 'xmas', garland: 'lights', animation: 'snow',
    useColors: true, primary: '#14532D', accent: '#D4A537', dark: '#0B2416',
  },
  {
    ...base, id: 'new-year', name: 'New Year', start: '2026-12-30', end: '2027-01-02',
    greeting: 'Happy New Year! Thank you for staying with us',
    popupTitle: 'Happy New Year!', popupText: 'Thank you for choosing VP Residency. Wishing you a healthy, happy and successful new year!',
    ctaText: 'Book your stay', art: 'newyear', garland: 'lights', animation: 'fireworks',
    useColors: true, primary: '#1B1F4B', accent: '#E8B931', dark: '#0C0E26',
  },
  {
    ...base, id: 'pongal', name: 'Pongal', start: '2027-01-12', end: '2027-01-17',
    greeting: 'Pongalo Pongal! Happy Pongal from VP Residency',
    popupTitle: 'Happy Pongal!', popupText: 'May this harvest festival fill your home with sweetness and prosperity. Pongalo Pongal!',
    ctaText: 'Book your stay', art: 'pongal', garland: 'mango', animation: 'petals',
    useColors: true, primary: '#8A3B12', accent: '#F2B705', dark: '#2E1405',
  },
  {
    ...base, id: 'republic-day', name: 'Republic Day', start: '2027-01-24', end: '2027-01-27',
    greeting: 'Happy Republic Day — proud to serve every traveller', popup: false,
    popupTitle: 'Happy Republic Day!', popupText: 'Celebrating the spirit of India with you.',
    ctaText: 'Book your stay', art: 'tricolor', garland: 'tricolor', animation: 'tricolor', density: 1,
  },
  {
    ...base, id: 'ramzan', name: 'Ramzan (Eid al-Fitr)', start: '2027-03-08', end: '2027-03-12',
    greeting: 'Eid Mubarak! Warm wishes from VP Residency',
    popupTitle: 'Eid Mubarak!', popupText: 'Wishing you and your loved ones peace, happiness and prosperity this Eid.',
    ctaText: 'Book your stay', art: 'crescent', garland: 'lanterns', animation: 'lanterns',
    useColors: true, primary: '#0F4C45', accent: '#D9B44A', dark: '#06221F',
  },
  {
    ...base, id: 'tamil-new-year', name: 'Tamil New Year (Puthandu)', start: '2027-04-12', end: '2027-04-15',
    greeting: 'Iniya Tamil Puthandu Nalvazhthukkal! Happy Tamil New Year',
    popupTitle: 'Happy Tamil New Year!', popupText: 'Wishing you a prosperous Tamil New Year filled with health and happiness.',
    ctaText: 'Book your stay', art: 'kalash', garland: 'mango', animation: 'petals',
  },
  {
    ...base, id: 'independence-day', name: 'Independence Day', start: '2027-08-13', end: '2027-08-16',
    greeting: 'Happy Independence Day from VP Residency', popup: false,
    popupTitle: 'Happy Independence Day!', popupText: 'Celebrating freedom with every traveller.',
    ctaText: 'Book your stay', art: 'tricolor', garland: 'tricolor', animation: 'tricolor', density: 1,
  },
];

export type FestivalView = Festival & { artUrl: string; garlandUrl: string };

export function festivalArtUrl(art: string): string {
  return art && art !== 'none' ? `/assets/festive/art-${art}.svg` : '';
}

export function festivalGarlandUrl(g: string): string {
  return g && g !== 'none' ? `/assets/festive/garland-${g}.svg` : '';
}

/** The festival to show right now: `?festival=` preview > "show now" switch > date window. */
export function activeFestival(s: Settings, previewId?: string | null): FestivalView | null {
  const items = s.festivals.items;
  let f: Festival | undefined;
  if (previewId) f = items.find((x) => x.id === previewId);
  else if (s.festivals.mode !== 'off') {
    f = items.find((x) => x.enabled && x.forceNow);
    if (!f) {
      const today = todayIso();
      f = items.find((x) => x.enabled && x.start && x.end && x.start <= today && today <= x.end);
    }
  }
  if (!f) return null;
  return { ...f, artUrl: festivalArtUrl(f.art), garlandUrl: festivalGarlandUrl(f.garland) };
}

export function upcomingFestivals(s: Settings, limit = 3): Festival[] {
  const today = todayIso();
  return s.festivals.items
    .filter((f) => f.enabled && f.end && f.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, limit);
}
