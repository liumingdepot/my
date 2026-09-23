-- Whether a game is featured on the public game home
ALTER TABLE games ADD COLUMN recommended INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_games_recommended ON games (recommended, updated_at DESC);
