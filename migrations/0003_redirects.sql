-- Old web addresses of rooms, blog posts and pages. When a slug changes, the old path is kept here and
-- answered with a permanent (301) redirect, so links and Google results keep working.
CREATE TABLE redirects (
  from_path  TEXT PRIMARY KEY,
  to_path    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX redirects_to ON redirects (to_path);
