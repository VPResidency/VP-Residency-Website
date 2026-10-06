import { DEFAULTS, SETTINGS_KEYS, mergeDefaults, type Settings, type SettingsKey } from './defaults';
import { seedContent } from './seed';
import { parseJson } from './util';

export async function loadSettings(db: D1Database): Promise<Settings> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const saved = new Map(results.map((r) => [r.key, r.value]));
  if (!saved.has('_seeded')) {
    await seedContent(db);
    await db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('_seeded', 'true')").run();
  }
  const s = {} as Record<SettingsKey, unknown>;
  for (const k of SETTINGS_KEYS) s[k] = mergeDefaults(DEFAULTS[k], parseJson(saved.get(k), undefined));
  return s as Settings;
}

export async function saveSetting(db: D1Database, key: SettingsKey, value: unknown): Promise<void> {
  await db
    .prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(key, JSON.stringify(value))
    .run();
}

export async function audit(
  db: D1Database,
  user: { id: number; name: string } | null,
  action: string,
  detail = '',
  ip = '',
): Promise<void> {
  await db
    .prepare('INSERT INTO audit_log (user_id, user_name, action, detail, ip) VALUES (?, ?, ?, ?, ?)')
    .bind(user?.id ?? null, user?.name ?? null, action, detail.slice(0, 500), ip)
    .run();
}
