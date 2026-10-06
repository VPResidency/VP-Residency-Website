import type { Settings } from './defaults';

/** Curated Google Fonts with the weights they actually ship (asking for a missing weight breaks the CSS request). */
export const FONTS: { name: string; weights: string; kind: 'serif' | 'sans' | 'display' | 'tamil' }[] = [
  { name: 'Playfair Display', weights: '400;500;600;700', kind: 'serif' },
  { name: 'Cormorant Garamond', weights: '400;500;600;700', kind: 'serif' },
  { name: 'DM Serif Display', weights: '', kind: 'serif' },
  { name: 'Fraunces', weights: '400;500;600;700', kind: 'serif' },
  { name: 'Lora', weights: '400;500;600;700', kind: 'serif' },
  { name: 'Libre Baskerville', weights: '400;700', kind: 'serif' },
  { name: 'EB Garamond', weights: '400;500;600;700', kind: 'serif' },
  { name: 'Merriweather', weights: '400;700', kind: 'serif' },
  { name: 'Prata', weights: '', kind: 'serif' },
  { name: 'Marcellus', weights: '', kind: 'display' },
  { name: 'Cinzel', weights: '400;500;600;700', kind: 'display' },
  { name: 'Yeseva One', weights: '', kind: 'display' },
  { name: 'Inter', weights: '400;500;600;700', kind: 'sans' },
  { name: 'DM Sans', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Manrope', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Plus Jakarta Sans', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Outfit', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Poppins', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Montserrat', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Raleway', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Josefin Sans', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Sora', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Urbanist', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Nunito Sans', weights: '400;600;700', kind: 'sans' },
  { name: 'Open Sans', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Roboto', weights: '400;500;700', kind: 'sans' },
  { name: 'Lato', weights: '400;700', kind: 'sans' },
  { name: 'Work Sans', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Mulish', weights: '400;600;700', kind: 'sans' },
  { name: 'Karla', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Noto Sans Tamil', weights: '400;500;600;700', kind: 'tamil' },
  { name: 'Noto Serif Tamil', weights: '400;500;600;700', kind: 'tamil' },
  { name: 'Hind Madurai', weights: '400;500;600;700', kind: 'tamil' },
  { name: 'Mukta Malar', weights: '400;500;600;700', kind: 'tamil' },
  { name: 'Catamaran', weights: '400;500;600;700', kind: 'tamil' },
  { name: 'Baloo Thambi 2', weights: '400;500;600;700', kind: 'tamil' },
];

export const FONT_NAME_RE = /^[A-Za-z0-9 ]{2,48}$/;
export const SYSTEM_FONT = 'System default';

const STACKS = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export function fontStack(name: string, fallback: 'serif' | 'sans'): string {
  if (!name || name === SYSTEM_FONT) return STACKS[fallback];
  return `'${name}', ${STACKS[fallback]}`;
}

/** Google Fonts stylesheet URL for the theme's fonts (skips uploaded/custom families and system fonts). */
export function googleFontsUrl(theme: Settings['theme']): string | null {
  const custom = new Set(theme.customFonts.map((f) => f.family));
  const names = [...new Set([theme.headingFont, theme.bodyFont, theme.brandFont])].filter(
    (n) => n && n !== SYSTEM_FONT && !custom.has(n) && FONT_NAME_RE.test(n),
  );
  if (!names.length) return null;
  const families = names.map((n) => {
    const known = FONTS.find((f) => f.name === n);
    const fam = n.replace(/ /g, '+');
    return known && known.weights ? `family=${fam}:wght@${known.weights}` : `family=${fam}`;
  });
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}
