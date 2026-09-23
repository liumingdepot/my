-- Games catalog for admin CRUD / front game list
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  download_url TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('FC', 'SFC', '街机')),
  genre TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_games_category ON games (category, name);
CREATE INDEX IF NOT EXISTS idx_games_updated ON games (updated_at DESC);
