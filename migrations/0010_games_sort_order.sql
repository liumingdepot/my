-- Sort order for catalogue listing / scrape page order
ALTER TABLE games ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_games_sort ON games (sort_order ASC, name ASC);
