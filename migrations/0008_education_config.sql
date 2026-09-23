-- Global Bilibili cookie for education sources (shared; not stored in each ext)
CREATE TABLE IF NOT EXISTS education_config (
  id TEXT PRIMARY KEY NOT NULL,
  cookie TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO education_config (id, cookie, updated_at)
VALUES ('default', '', datetime('now'));
