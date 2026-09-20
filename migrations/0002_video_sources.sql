-- Video search sources (MacCMS-style)
CREATE TABLE IF NOT EXISTS video_sources (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_video_sources_sort ON video_sources (sort_order, name);

INSERT OR IGNORE INTO video_sources (id, name, url, sort_order, enabled, created_at, updated_at) VALUES
  ('vs-lz', '量子', 'https://cj.lziapi.com/api.php/provide/vod/', 1, 1, datetime('now'), datetime('now')),
  ('vs-hn', '红牛', 'https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/', 2, 1, datetime('now'), datetime('now')),
  ('vs-xl', '新浪', 'https://api.xinlangapi.com/xinlangapi.php/provide/vod/', 3, 1, datetime('now'), datetime('now')),
  ('vs-ff', '非凡', 'https://ffzy4.tv/api.php/provide/vod/', 4, 1, datetime('now'), datetime('now')),
  ('vs-wj', '无尽', 'https://api.wujinapi.com/api.php/provide/vod/', 5, 1, datetime('now'), datetime('now')),
  ('vs-jy', '金鹰', 'https://jinyingzy.com/provide/vod/', 6, 1, datetime('now'), datetime('now')),
  ('vs-mt', '茅台', 'https://caiji.maotai999.vip/api.php/provide/vod/from/mtm3u8/at/json/', 7, 1, datetime('now'), datetime('now')),
  ('vs-fl1', '福利1', 'https://lbapi9.com/api.php/provide/vod/', 8, 1, datetime('now'), datetime('now')),
  ('vs-fl2', '福利2', 'http://fhapi9.com/api.php/provide/vod/', 9, 1, datetime('now'), datetime('now'));
