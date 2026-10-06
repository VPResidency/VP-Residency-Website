import { raw } from 'hono/html';
import { ICONS } from './icons-data';

export const ICON_NAMES = Object.keys(ICONS);

export function iconSvg(name: string, size = 20, cls = 'icon'): string {
  const inner = ICONS[name] ?? ICONS['sparkle'];
  return `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
}

export function Icon({ name, size = 20, class: cls = 'icon' }: { name: string; size?: number; class?: string }) {
  return raw(iconSvg(name, size, cls));
}
