/** Used when D1 has no sources yet / read fails. Frontend mirrors these two names. */
export const FALLBACK_VIDEO_SOURCES = [
  { name: '量子', url: 'https://cj.lziapi.com/api.php/provide/vod/' },
  { name: '红牛', url: 'https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/' },
] as const

/** Initial import into admin / D1 (matches former hardcoded list). */
export const SEED_VIDEO_SOURCES = [
  ...FALLBACK_VIDEO_SOURCES,
  { name: '新浪', url: 'https://api.xinlangapi.com/xinlangapi.php/provide/vod/' },
  { name: '非凡', url: 'https://ffzy4.tv/api.php/provide/vod/' },
  { name: '无尽', url: 'https://api.wujinapi.com/api.php/provide/vod/' },
  { name: '金鹰', url: 'https://jinyingzy.com/provide/vod/' },
  { name: '茅台', url: 'https://caiji.maotai999.vip/api.php/provide/vod/from/mtm3u8/at/json/' },
  { name: '福利1', url: 'https://lbapi9.com/api.php/provide/vod/' },
  { name: '福利2', url: 'http://fhapi9.com/api.php/provide/vod/' },
] as const
