/**
 * 测试模块数据源（Mac 版契约）
 * 公开网页链路：hongguoduanju.com
 */

const BASE = 'https://hongguoduanju.com'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const PLAYBACK_API = 'https://djapi.999888456.xyz/api/hongguo/play'

export const GENRES = {
  short_play: { name: '真人剧', route: 'real-drama', category: '' },
  comic_series: { name: '漫剧', route: 'comic-drama', category: 'comic' },
  ai_series: { name: 'AI剧', route: 'ai-drama', category: 'ai' },
} as const

export type GenreId = keyof typeof GENRES

export const RANK_BOARDS = ['recommend', 'hot', 'new'] as const
export type RankBoard = (typeof RANK_BOARDS)[number]

export const RANK_NAMES: Record<RankBoard, string> = {
  recommend: '漫剧推荐榜',
  hot: '漫剧热播榜',
  new: '漫剧新剧榜',
}

export type MacItem = {
  series_id: string
  title: string
  cover: string
  episode_cnt: number
  score: string
  play_cnt: number
  hot: string
  category: string
  intro: string
  vid?: string
  stream_url?: string
  episodes_url?: string
}

export type MacEpisode = {
  index: number
  vid: string
  title: string
  duration: number
  cover: string
}

export type MacMeta = {
  series_id: string
  title: string
  intro: string
  episode_cnt: number
  status: string
  play_cnt: number
  followed_cnt: number
  cover: string
  category: string | string[]
  score: string
}

const THEME_BY_GENRE: Record<GenreId, string[]> = {
  short_play: ['甜宠', '虐恋', '逆袭', '复仇', '霸总', '重生', '穿越', '古装'],
  comic_series: ['玄幻', '都市', '热血', '恋爱', '搞笑', '冒险', '系统', '修仙'],
  ai_series: ['科幻', '奇幻', '剧情', '恋爱', '悬疑', '动作'],
}

function mapString(obj: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!obj) return ''
  for (const key of keys) {
    const v = obj[key]
    if (v == null || v === '') continue
    return String(v).trim()
  }
  return ''
}

function anyList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    for (const key of ['list', 'items', 'data', 'recommendList', 'searchList']) {
      if (Array.isArray(o[key])) return o[key] as unknown[]
    }
  }
  return []
}

function nestedMap(v: unknown, ...keys: string[]): Record<string, unknown> | null {
  let cur: unknown = v
  for (const key of keys) {
    if (!cur || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur && typeof cur === 'object' && !Array.isArray(cur)
    ? (cur as Record<string, unknown>)
    : null
}

function parseRouterData(raw: string): Record<string, unknown> | null {
  const m = raw.match(/(?:window\.)?_ROUTER_DATA\s*=\s*/)
  if (!m || m.index == null) return null
  const start = m.index + m[0].length
  try {
    let depth = 0
    let inStr = false
    let escape = false
    let end = -1
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i]!
      if (inStr) {
        if (escape) escape = false
        else if (ch === '\\') escape = true
        else if (ch === '"') inStr = false
        continue
      }
      if (ch === '"') {
        inStr = true
        continue
      }
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
    if (end < 0) return null
    return JSON.parse(raw.slice(start, end)) as Record<string, unknown>
  } catch {
    return null
  }
}

function routerLoaderMap(data: Record<string, unknown> | null, ...names: string[]) {
  const loader = nestedMap(data, 'loaderData') || {}
  for (const name of names) {
    const hit = nestedMap(loader, name)
    if (hit) return hit
  }
  for (const key of Object.keys(loader)) {
    if (names.some((n) => key.startsWith(n))) {
      const hit = nestedMap(loader, key)
      if (hit) return hit
    }
  }
  return null
}

async function fetchText(url: string, referer = `${BASE}/`) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/json,*/*',
      Referer: referer,
    },
  })
  if (!res.ok) throw new Error(`上游 HTTP ${res.status}`)
  return res.text()
}

function absUrl(raw: string) {
  const s = (raw || '').trim()
  if (!s) return ''
  if (s.startsWith('//')) return `https:${s}`
  return s
}

function dramaFromAny(row: unknown): MacItem | null {
  if (!row || typeof row !== 'object') return null
  const o = row as Record<string, unknown>
  const video = nestedMap(o, 'video_data') || o
  const id =
    mapString(video, 'series_id', 'playlet_id', 'id', 'book_id') ||
    mapString(o, 'series_id', 'playlet_id', 'id')
  if (!id || !/^[0-9]{1,32}$/.test(id)) return null
  const title = mapString(video, 'series_name', 'series_title', 'title', 'name') || id
  const cover = absUrl(mapString(video, 'series_cover', 'cover', 'thumb_url', 'image_link'))
  const ep = Number(mapString(video, 'episode_cnt', 'total_episode', 'total_num')) || 0
  const hotRaw = mapString(video, 'hot_value', 'play_cnt', 'read_cnt')
  const play = Number(hotRaw.replace(/[^\d.]/g, '')) || 0
  const category = mapString(video, 'category_name', 'sub_title', 'tags', 'genre')
  const intro = mapString(video, 'series_intro', 'intro', 'sub_title') || category
  return {
    series_id: id,
    title,
    cover,
    episode_cnt: ep,
    score: '',
    play_cnt: play,
    hot: hotRaw || (play ? String(play) : ''),
    category,
    intro,
  }
}

function withLinks(item: MacItem, base: string): MacItem {
  const sid = item.series_id
  return {
    ...item,
    stream_url: `${base}/stream?series_id=${encodeURIComponent(sid)}&ep=1`,
    episodes_url: `${base}/episodes?series_id=${encodeURIComponent(sid)}`,
  }
}

export function isGenre(v: string): v is GenreId {
  return v in GENRES
}

export function macFilters(genre: string) {
  const g: GenreId = isGenre(genre) ? genre : 'short_play'
  const themes = THEME_BY_GENRE[g]
  return {
    genre: g,
    name: GENRES[g].name,
    rows: [
      {
        type: 'category_dim_theme',
        label: '主题',
        items: themes.map((name) => ({ id: name, name })),
      },
      {
        type: 'sort',
        label: '排序',
        items: [
          { id: 'hot', name: '最热' },
          { id: 'new', name: '最新' },
        ],
      },
    ],
  }
}

async function catalogByGenre(genre: GenreId, page = 1, limit = 36): Promise<MacItem[]> {
  const route = GENRES[genre].route
  const body = await fetchText(`${BASE}/category/${route}?page=${page}`)
  const data = parseRouterData(body)
  const pageData = routerLoaderMap(data, 'category_page', 'category_')
  if (!pageData || pageData.isSuccess === false) throw new Error('分类数据不可用')
  const items = anyList(pageData.recommendList)
  const list: MacItem[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const drama = dramaFromAny(item)
    if (!drama || seen.has(drama.series_id)) continue
    seen.add(drama.series_id)
    list.push(drama)
    if (list.length >= limit) break
  }
  return list
}

function filterByTheme(items: MacItem[], theme?: string | null) {
  const t = (theme || '').trim()
  if (!t) return items
  return items.filter((it) => {
    const hay = `${it.title} ${it.category} ${it.intro}`
    return hay.includes(t)
  })
}

export async function macBrowse(opts: {
  genre: string
  theme?: string | null
  sort?: string | null
  limit?: number
  base?: string
}) {
  const g: GenreId = isGenre(opts.genre) ? opts.genre : 'short_play'
  const limit = Math.min(60, Math.max(1, opts.limit || 36))
  const base = opts.base || '/api/test'
  let items = await catalogByGenre(g, 1, Math.max(limit, 48))
  items = filterByTheme(items, opts.theme)
  const sort = (opts.sort || '').trim()
  if (sort.includes('热') || sort === 'hot' || sort === 'hot_score') {
    items = [...items].sort((a, b) => b.play_cnt - a.play_cnt)
  }
  return items.slice(0, limit).map((it) => withLinks(it, base))
}

export async function macLatest(opts: {
  genre: string
  only_today?: boolean
  limit?: number
  base?: string
}) {
  const g: GenreId = isGenre(opts.genre) ? opts.genre : 'short_play'
  const limit = Math.min(120, Math.max(1, opts.limit || 12))
  const base = opts.base || '/api/test'
  // 网页无「今日」粒度，取分类首页靠前项作为最新上架
  const items = await catalogByGenre(g, 1, limit)
  return items.map((it) => withLinks(it, base))
}

export async function macRank(board: string, limit = 30, base = '/api/test') {
  const b = (RANK_BOARDS as readonly string[]).includes(board) ? (board as RankBoard) : 'hot'
  const lim = Math.min(60, Math.max(1, limit))
  // 漫剧分类 + 不同排序近似三榜
  let items = await catalogByGenre('comic_series', 1, Math.max(lim, 40))
  if (b === 'hot') items = [...items].sort((a, b2) => b2.play_cnt - a.play_cnt)
  else if (b === 'new') items = items // 保持站点顺序
  else items = [...items].sort((a, b2) => (b2.episode_cnt || 0) - (a.episode_cnt || 0))
  return {
    board: b,
    name: RANK_NAMES[b],
    items: items.slice(0, lim).map((it) => withLinks(it, base)),
  }
}

export async function macSearch(q: string, limit = 40, base = '/api/test') {
  const keyword = q.trim()
  if (!keyword || keyword.length > 80) throw new Error('请输入搜索词')
  const body = await fetchText(`${BASE}/search/${encodeURIComponent(keyword)}`)
  const data = parseRouterData(body)
  const pageData = routerLoaderMap(data, 'search_(keyword)/page', 'search_')
  if (!pageData || pageData.isSuccess !== true) throw new Error('搜索未返回有效结果')
  const rows = anyList(pageData.searchList)
  const list: MacItem[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const drama = dramaFromAny(row)
    if (!drama || seen.has(drama.series_id)) continue
    if (!nestedMap(row as object, 'video_data') && !(row as Record<string, unknown>).video_data) continue
    seen.add(drama.series_id)
    list.push(withLinks(drama, base))
    if (list.length >= limit) break
  }
  return { query: keyword, results: list }
}

export async function macEpisodes(seriesId: string): Promise<{ meta: MacMeta; episodes: MacEpisode[] }> {
  const id = seriesId.trim()
  if (!/^[0-9]{1,32}$/.test(id)) throw new Error('剧集 ID 无效')
  const body = await fetchText(`${BASE}/detail?series_id=${encodeURIComponent(id)}`)
  const data = parseRouterData(body)
  const page = routerLoaderMap(data, 'detail_page', 'detail_')
  const detail = nestedMap(page, 'seriesDetail')
  if (!detail) throw new Error('详情为空')

  const title = mapString(detail, 'series_name', 'series_title', 'name') || id
  const cover = absUrl(mapString(detail, 'series_cover', 'cover'))
  const intro = mapString(detail, 'series_intro', 'video_desc', 'intro')
  const tags = mapString(detail, 'tags', 'category_name')
  const count = Number(mapString(detail, 'episode_cnt', 'total_episode')) || 0
  const statusRaw = mapString(detail, 'series_status')
  const status = statusRaw === '1' ? '完结' : statusRaw === '0' ? '连载中' : ''
  const vids = anyList(detail.vid_list)

  const episodes: MacEpisode[] = []
  vids.forEach((v, i) => {
    const vid = String(v ?? '').trim()
    if (!vid || vid === '<nil>' || !/^[0-9]{1,32}$/.test(vid)) return
    const index = i + 1
    episodes.push({
      index,
      vid,
      title: `第${index}集`,
      duration: 0,
      cover,
    })
  })
  if (!episodes.length) throw new Error('没有返回剧集')

  return {
    meta: {
      series_id: id,
      title,
      intro,
      episode_cnt: count || episodes.length,
      status,
      play_cnt: 0,
      followed_cnt: 0,
      cover,
      category: tags,
      score: '',
    },
    episodes,
  }
}

function mediaAddresses(info: Record<string, unknown> | null): string[] {
  if (!info) return []
  const out: string[] = []
  const seen = new Set<string>()
  const add = (value: unknown) => {
    if (!value) return
    if (typeof value === 'string') {
      const text = value.trim()
      if (/^https?:\/\//i.test(text) && !seen.has(text)) {
        seen.add(text)
        out.push(text)
      }
      return
    }
    if (Array.isArray(value)) value.forEach(add)
    if (typeof value === 'object') {
      const o = value as Record<string, unknown>
      for (const key of ['main_url', 'backup_url', 'url', 'src', 'play_url']) {
        add(o[key])
      }
    }
  }
  for (const key of ['main_url', 'backup_url', 'backup_url_1', 'backup_url_2', 'backup_urls', 'url_list']) {
    add(info[key])
  }
  return out
}

async function playFromPage(seriesId: string, videoId: string) {
  const pageURL = `${BASE}/player/${encodeURIComponent(seriesId)}/${encodeURIComponent(videoId)}`
  const body = await fetchText(pageURL)
  const page = routerLoaderMap(parseRouterData(body), 'player_', 'player_page')
  if (!page) throw new Error('播放页数据不可用')
  const info = nestedMap(page, 'video_player_info')
  const addresses = mediaAddresses(info)
  if (!addresses.length) throw new Error('未提供公开播放地址')
  return { url: addresses[0]!, referer: 'https://novel.snssdk.com/', variants: addresses }
}

async function playFromBackupApi(seriesId: string, videoId: string) {
  const reference = {
    content_type: 1004,
    series_id: seriesId,
    vid: videoId,
    video_platform: 3,
    from_video_id: '',
  }
  const id = Buffer.from(JSON.stringify(reference)).toString('base64')
  const url = `${PLAYBACK_API}?id=${encodeURIComponent(id)}`
  const text = await fetchText(url, `${BASE}/`)
  let decoded = text.trim()
  if (decoded.startsWith('v2.')) throw new Error('备用接口返回加密数据')
  const json = JSON.parse(decoded) as Record<string, unknown>
  const keyUrls = Array.isArray(json.key_urls) ? json.key_urls : []
  const urls: string[] = []
  for (const option of keyUrls) {
    if (!option || typeof option !== 'object') continue
    const src = mapString(option as Record<string, unknown>, 'src')
    if (/^https?:\/\//i.test(src)) urls.push(src)
  }
  if (!urls.length) throw new Error('备用接口未返回可用媒体地址')
  return { url: urls[0]!, referer: 'https://novel.snssdk.com/', variants: urls }
}

export async function macPlay(seriesId: string, videoId: string) {
  if (!/^[0-9]{1,32}$/.test(seriesId) || !/^[0-9]{1,32}$/.test(videoId)) {
    throw new Error('播放请求缺少有效 ID')
  }
  try {
    return await playFromPage(seriesId, videoId)
  } catch (pageErr) {
    try {
      return await playFromBackupApi(seriesId, videoId)
    } catch (apiErr) {
      const a = pageErr instanceof Error ? pageErr.message : '网页取流失败'
      const b = apiErr instanceof Error ? apiErr.message : '备用取流失败'
      throw new Error(`取流失败：${a}；${b}`)
    }
  }
}

export function isAllowedMediaUrl(raw: string) {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const h = u.hostname.toLowerCase()
    return (
      h.endsWith('.qznovelvod.com') ||
      h.endsWith('qznovelvod.com') ||
      h.endsWith('.bytevcloudcdn.com') ||
      h.endsWith('.bytecdn.cn') ||
      h.endsWith('.snssdk.com') ||
      h.endsWith('.toutiaovod.com') ||
      h.endsWith('.ibytedtos.com') ||
      h.includes('novelvod') ||
      h.includes('fqnovel')
    )
  } catch {
    return false
  }
}

export function isAllowedImgHost(host: string) {
  const h = host.toLowerCase()
  const allow = ['fqnovelpic.com', 'byteimg.com', 'qznovelvod.com', 'douyinpic.com', 'pstatp.com', 'hongguoduanju.com']
  return allow.some((d) => h === d || h.endsWith('.' + d))
}
