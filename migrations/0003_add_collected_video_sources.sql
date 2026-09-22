-- Deduped collection sources from admin import list.
-- Skips names already seeded in 0002 (量子 / 新浪); updates 非凡 URL to user-provided host.
UPDATE video_sources
SET url = 'http://ffzy.tv/api.php/provide/vod/',
    updated_at = datetime('now')
WHERE name = '非凡';

INSERT OR IGNORE INTO video_sources (id, name, url, sort_order, enabled, created_at, updated_at) VALUES
  ('vs-dytt', '电影天堂', 'http://caiji.dyttzyapi.com/api.php/provide/vod/', 10, 1, datetime('now'), datetime('now')),
  ('vs-ty', '天涯采集', 'http://tyyszy.com/api.php/provide/vod/', 11, 1, datetime('now'), datetime('now')),
  ('vs-js', '极速资源', 'https://jszyapi.com/api.php/provide/vod/', 12, 1, datetime('now'), datetime('now')),
  ('vs-ja', '建安采集', 'http://154.219.117.232:9981/jacloudapi.php/provide/vod/', 13, 1, datetime('now'), datetime('now')),
  ('vs-ll', '率率', 'https://suoniapi.com/api.php/provide/vod/', 14, 1, datetime('now'), datetime('now')),
  ('vs-bd', '百度', 'https://api.apibdzy.com/api.php/provide/vod/', 15, 1, datetime('now'), datetime('now')),
  ('vs-bf', '暴風', 'https://bfzyapi.com/api.php/provide/vod/', 16, 1, datetime('now'), datetime('now')),
  ('vs-dytt-m3u8', '电影天堂m3u8', 'http://caiji.dyttzyapi.com/api.php/provide/vod/from/dyttm3u8/at/m3u8/', 17, 1, datetime('now'), datetime('now')),
  ('vs-hn-base', '红牛资源', 'https://www.hongniuzy2.com/api.php/provide/vod/', 18, 1, datetime('now'), datetime('now')),
  ('vs-sd', '闪电资源', 'http://sdzyapi.com/api.php/provide/vod/', 19, 1, datetime('now'), datetime('now')),
  ('vs-gs', '光速资源', 'https://api.guangsuapi.com/api.php/provide/vod/', 20, 1, datetime('now'), datetime('now'));
