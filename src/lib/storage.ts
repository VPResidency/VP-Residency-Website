// Uploaded files live in R2 when a bucket is bound (env.MEDIA); otherwise in D1 as base64 chunks.
// Both expose the same small interface so routes don't care which one is in use.
import type { Bindings } from '../types';

export type StoredFile = { body: ReadableStream | ArrayBuffer; size: number; mime: string; etag: string; offset: number; length: number };

export interface MediaStore {
  kind: 'r2' | 'd1';
  put(key: string, data: ArrayBuffer, mime: string): Promise<void>;
  get(key: string, range?: { offset: number; length?: number; suffix?: number } | null): Promise<StoredFile | null>;
  delete(keys: string[]): Promise<void>;
}

const CACHE = 'public, max-age=31536000, immutable';
const CHUNK = 1_000_000; // bytes per D1 row before base64 (~1.33 MB as text, under the 2 MB row limit)

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function r2Store(bucket: R2Bucket): MediaStore {
  return {
    kind: 'r2',
    async put(key, data, mime) {
      await bucket.put(key, data, { httpMetadata: { contentType: mime, cacheControl: CACHE } });
    },
    async get(key, range) {
      const obj = await bucket.get(key, range ? { range } : undefined);
      if (!obj) return null;
      const r = obj.range as { offset?: number; length?: number; suffix?: number } | undefined;
      const offset = r ? (r.suffix !== undefined ? obj.size - r.suffix : r.offset ?? 0) : 0;
      const length = r ? (r.suffix !== undefined ? r.suffix : r.length ?? obj.size - offset) : obj.size;
      return { body: obj.body, size: obj.size, mime: obj.httpMetadata?.contentType || 'application/octet-stream', etag: obj.httpEtag, offset, length };
    },
    async delete(keys) {
      await bucket.delete(keys);
    },
  };
}

function d1Store(db: D1Database): MediaStore {
  return {
    kind: 'd1',
    async put(key, data, mime) {
      const bytes = new Uint8Array(data);
      const chunks = Math.max(1, Math.ceil(bytes.length / CHUNK));
      const digest = await crypto.subtle.digest('SHA-1', bytes);
      const etag = '"' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('') + '"';
      await db.batch([db.prepare('DELETE FROM media_chunks WHERE key = ?').bind(key)]);
      // One chunk per statement keeps every request well inside D1's limits.
      for (let i = 0; i < chunks; i++) {
        await db.prepare('INSERT INTO media_chunks (key, idx, data) VALUES (?, ?, ?)').bind(key, i, toBase64(bytes.subarray(i * CHUNK, (i + 1) * CHUNK))).run();
      }
      await db
        .prepare('INSERT OR REPLACE INTO media_objects (key, mime, size, chunks, etag) VALUES (?, ?, ?, ?, ?)')
        .bind(key, mime, bytes.length, chunks, etag)
        .run();
    },
    async get(key, range) {
      const meta = await db.prepare('SELECT mime, size, chunks, etag FROM media_objects WHERE key = ?').bind(key).first<{ mime: string; size: number; chunks: number; etag: string }>();
      if (!meta) return null;
      let offset = 0;
      let length = meta.size;
      if (range) {
        offset = range.suffix !== undefined ? Math.max(0, meta.size - range.suffix) : Math.min(range.offset, meta.size);
        length = range.suffix !== undefined ? meta.size - offset : Math.min(range.length ?? meta.size - offset, meta.size - offset);
      }
      const first = Math.floor(offset / CHUNK);
      const last = Math.floor(Math.max(offset, offset + length - 1) / CHUNK);
      const { results } = await db
        .prepare('SELECT idx, data FROM media_chunks WHERE key = ? AND idx BETWEEN ? AND ? ORDER BY idx')
        .bind(key, first, last)
        .all<{ idx: number; data: string }>();
      const out = new Uint8Array(length);
      let pos = 0;
      for (const row of results) {
        const bytes = fromBase64(row.data);
        const chunkStart = row.idx * CHUNK;
        const from = Math.max(0, offset - chunkStart);
        const to = Math.min(bytes.length, offset + length - chunkStart);
        out.set(bytes.subarray(from, to), pos);
        pos += to - from;
      }
      return { body: out.buffer, size: meta.size, mime: meta.mime, etag: meta.etag, offset, length };
    },
    async delete(keys) {
      if (!keys.length) return;
      await db.batch(keys.flatMap((k) => [db.prepare('DELETE FROM media_chunks WHERE key = ?').bind(k), db.prepare('DELETE FROM media_objects WHERE key = ?').bind(k)]));
    },
  };
}

export function mediaStore(env: Bindings): MediaStore {
  return env.MEDIA ? r2Store(env.MEDIA) : d1Store(env.DB);
}
