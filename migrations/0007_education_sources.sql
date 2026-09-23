-- Bili education sources (TVBox csp_Bili style ext JSON)
CREATE TABLE IF NOT EXISTS education_sources (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  ext TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_education_sources_updated ON education_sources (updated_at DESC);
