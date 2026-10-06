-- Fallback file storage inside D1, used when no R2 bucket is bound (R2 needs to be enabled in the
-- Cloudflare dashboard first). Files are split into ~1 MB base64 chunks to stay under D1's row limit.
CREATE TABLE media_objects (
  key        TEXT PRIMARY KEY,
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  chunks     INTEGER NOT NULL,
  etag       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE media_chunks (
  key  TEXT NOT NULL,
  idx  INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (key, idx)
);
