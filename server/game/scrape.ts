import type { GameCategory } from './games.js'

const YIKM_ORIGIN = 'https://www.yikm.net'
const ROM_CDN = 'https://file.1990i.com'
const LIST_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

/** yikm `/nes` 分类 tag（e=0 表示 FC；tag=0 为默认全部） */
export const YIKM_FC_TAGS = [
  { tag: 2, genre: '动作冒险' },
  { tag: 3, genre: '飞行射击' },
  { tag: 4, genre: '格斗' },
  { tag: 5, genre: '棋牌' },
  { tag: 6, genre: '射击' },
  { tag: 7, genre: '运动比赛' },
  { tag: 8, genre: '小游戏' },
  { tag: 10, genre: '角色扮演' },
] as const

export type YikmFcTag = (typeof YIKM_FC_TAGS)[number]['tag']

const YIKM_TAG_GENRE = Object.fromEntries(YIKM_FC_TAGS.map((item) => [item.tag, item.genre])) as Record<
  YikmFcTag,
  string
>

const YIKM_GENRE_TAG = Object.fromEntries(YIKM_FC_TAGS.map((item) => [item.genre, item.tag])) as Record<
  string,
  YikmFcTag
>

export function isYikmFcTag(value: unknown): value is YikmFcTag {
  return typeof value === 'number' && Number.isInteger(value) && value in YIKM_TAG_GENRE
}

/** 中文类型 → yikm tag；空/未知 → 0（全部） */
export function yikmFcTagFromGenre(genre?: string) {
  const key = genre?.trim() ?? ''
  if (!key) return 0
  return YIKM_GENRE_TAG[key] ?? 0
}

/** yikm `/nes` 街机分类 tag（e=1，中文 tag） */
export const YIKM_ARCADE_TAGS = [
  { tag: '动作', genre: '动作' },
  { tag: '格斗', genre: '格斗' },
  { tag: '射击', genre: '射击' },
  { tag: '赛车', genre: '赛车' },
  { tag: '体育', genre: '体育' },
  { tag: '益智', genre: '益智' },
  { tag: '游戏', genre: '游戏' },
  { tag: '其他', genre: '其他' },
] as const

export type YikmArcadeTag = (typeof YIKM_ARCADE_TAGS)[number]['tag']

const YIKM_ARCADE_TAG_GENRE = Object.fromEntries(
  YIKM_ARCADE_TAGS.map((item) => [item.tag, item.genre]),
) as Record<YikmArcadeTag, string>

export function isYikmArcadeTag(value: unknown): value is YikmArcadeTag {
  return typeof value === 'string' && value in YIKM_ARCADE_TAG_GENRE
}

/** 中文类型 → yikm 街机 tag；空 → 9（全部） */
export function yikmArcadeTagFromGenre(genre?: string): YikmArcadeTag | 9 {
  const key = genre?.trim() ?? ''
  if (!key) return 9
  return isYikmArcadeTag(key) ? key : 9
}

type ListItem = {
  playId: string
  name: string
  imageUrl: string
  genre: string
  labels: string[]
}

function absoluteUrl(src: string) {
  if (!src) return ''
  if (/^https?:\/\//i.test(src)) return src
  if (src.startsWith('//')) return `https:${src}`
  // 街机封面在 img CDN
  if (src.startsWith('/arcadepic/')) return `https://img.1990i.com${src}`
  if (src.startsWith('/fcpic/') || src.startsWith('/sfcpic/')) return `https://img.1990i.com${src}`
  if (src.startsWith('/')) return `${YIKM_ORIGIN}${src}`
  return `${YIKM_ORIGIN}/${src}`
}

/** Encode each path segment so ROM filenames with spaces / [] work. */
export function romPathToDownloadUrl(gromname: string) {
  const path = gromname
    .trim()
    .split('/')
    .map((seg) => (seg ? encodeURIComponent(seg) : ''))
    .join('/')
  return `${ROM_CDN}${path.startsWith('/') ? path : `/${path}`}`
}

/** 街机 ROM：/roms/fbneo/{gsystem}/{zip}；gromname 可能含 parent：a.zip$b.zip */
export function arcadeRomPathToDownloadUrl(gsystem: string, gromname: string) {
  const primary = gromname.split('$')[0]?.trim() || gromname.trim()
  const system = gsystem.trim().replace(/^\/+|\/+$/g, '')
  if (!system || !primary) return romPathToDownloadUrl(primary || gromname)
  const file = primary.includes('/') ? primary.split('/').pop()! : primary
  return `${ROM_CDN}/roms/fbneo/${encodeURIComponent(system)}/${encodeURIComponent(file)}`
}

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function parseListPage(html: string, genreFallback: string): ListItem[] {
  const items: ListItem[] = []
  const chunks = html.split('<div class="col-md-3 col-xs-6">').slice(1)

  for (const card of chunks) {
    const idMatch = card.match(/href="\/play\?id=(\d+)"/)
    const imgMatch = card.match(/<img class="img img-raised" src="([^"]+)"/)
    const nameMatch = card.match(/<h4 class="card-caption">\s*<a[^>]*>([^<]+)<\/a>/)
    if (!idMatch || !nameMatch) continue

    const labels = [...card.matchAll(/class="label[^"]*"[^>]*>([^<]+)<\/span>/g)]
      .map((m) => decodeHtml(m[1] ?? ''))
      .filter(Boolean)
    const genre = genreFallback || labels.join('、') || '未分类'

    items.push({
      playId: idMatch[1]!,
      name: decodeHtml(nameMatch[1] ?? ''),
      imageUrl: absoluteUrl(imgMatch?.[1] ?? ''),
      genre,
      labels,
    })
  }

  return items
}

type PlayDetail = {
  gromname: string
  gpic: string
  gameid: string
  gname: string
  gsystem: string
  gameType: string
}

/** FC：gromname,gpic,gameid,gname；街机：gromname,gsystem,gname,gpic + 另有 gameType */
function parsePlayPage(html: string): PlayDetail | null {
  const gromMatch = html.match(/var\s+gromname="([^"]+)"/)
  if (!gromMatch?.[1]) return null

  const gromname = gromMatch[1]
  const gpic = html.match(/\bgpic="([^"]*)"/)?.[1] ?? ''
  const gameid = html.match(/\bgameid="([^"]+)"/)?.[1] ?? ''
  const gname = decodeHtml(html.match(/\bgname="([^"]*)"/)?.[1] ?? '')
  const gsystem = html.match(/\bgsystem="([^"]*)"/)?.[1] ?? ''
  const gameType = html.match(/\bgameType="([^"]*)"/)?.[1] ?? ''

  return { gromname, gpic, gameid, gname, gsystem, gameType }
}

function playDetailToDownloadUrl(detail: PlayDetail) {
  // 仅 arcade 走 fbneo 路径；FC 详情页也会带 gsystem="fc"，不能凭 gsystem 判断
  if (detail.gameType === 'arcade' && detail.gsystem) {
    return arcadeRomPathToDownloadUrl(detail.gsystem, detail.gromname)
  }
  return romPathToDownloadUrl(detail.gromname)
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': LIST_UA,
      Accept: 'text/html,application/xhtml+xml',
      Referer: `${YIKM_ORIGIN}/`,
    },
  })
  if (!response.ok) {
    throw new Error(`请求失败 ${response.status}: ${url}`)
  }
  return response.text()
}

function detailMatchesCategory(detail: PlayDetail, category: GameCategory) {
  const type = detail.gameType.trim().toLowerCase()
  const system = detail.gsystem.trim().toLowerCase()
  if (category === 'FC') {
    return type === 'fc' || type === 'nes' || (!type && (system === 'fc' || system === 'nes'))
  }
  if (category === '街机') {
    return type === 'arcade' || (!type && Boolean(system) && system !== 'fc' && system !== 'nes' && system !== 'sfc')
  }
  if (category === 'SFC') {
    return type === 'sfc' || system === 'sfc'
  }
  return true
}

/** 列表页每页固定约 20 条；分页控件只显示当前窗口，取可见最大页号。 */
function parsePagerMaxPage(html: string, pathHint: '/nes' | '/search') {
  const re =
    pathHint === '/nes'
      ? /\/nes\?[^"'>\s]*[?&]page=(\d+)/gi
      : /\/search\?[^"'>\s]*[?&]page=(\d+)/gi
  const pages = [...html.matchAll(re)].map((m) => Number(m[1])).filter((n) => Number.isFinite(n) && n >= 1)
  return pages.length ? Math.max(...pages) : 0
}

export type YikmFcBrowseItem = {
  id: string
  name: string
  imageUrl: string
  genre: string
  category: 'FC'
}

export type YikmFcBrowseResult = {
  items: YikmFcBrowseItem[]
  page: number
  pageSize: number
  pageCount: number
  /** 原站本页条数；FC 列表通常 20 */
  total: number
}

function listItemToBrowse(item: ListItem, genreFallback: string): YikmFcBrowseItem {
  return {
    id: item.playId,
    name: item.name,
    imageUrl: item.imageUrl,
    genre: item.genre || genreFallback || '未分类',
    category: 'FC',
  }
}

/** 搜索结果里其它机种标签（GBA/Java 等常混在一起，不能只靠路径） */
const OTHER_SYSTEM_LABELS = new Set(
  [
    'GBA',
    'GBC',
    'GB',
    'SFC',
    'MD',
    'N64',
    'PSP',
    'PS',
    'PS1',
    'NDS',
    '3DS',
    'PCE',
    'WSC',
    'NGP',
    'Java',
    'Flash',
    'HTML5',
    'H5',
    'dos',
    'SMS',
    'GG',
  ].map((s) => s.toLowerCase()),
)

function hasOtherSystemLabel(labels: string[]) {
  return labels.some((label) => OTHER_SYSTEM_LABELS.has(label.trim().toLowerCase()))
}

function isFcSearchItem(item: ListItem) {
  if (hasOtherSystemLabel(item.labels) || item.labels.includes('街机')) return false
  // Java 封面在 jarimgs；其它机种也有独立目录
  if (/\/(?:jarimgs|flashpic|dospic|mdpic|sfcpic|gbapic|arcadepic)\//i.test(item.imageUrl)) {
    return false
  }
  return /\/fcpic\//i.test(item.imageUrl)
}

function isArcadeSearchItem(item: ListItem) {
  if (hasOtherSystemLabel(item.labels)) return false
  if (/\/(?:jarimgs|flashpic|dospic|mdpic|sfcpic|gbapic|fcpic)\//i.test(item.imageUrl)) {
    return false
  }
  if (item.labels.includes('街机')) return true
  return /\/arcadepic\//i.test(item.imageUrl)
}

/**
 * 实时浏览 yikm FC 列表（不入库）。
 * URL: `/nes?page={page}&tag={tag}&e=0`；tag=0 为默认全部。
 */
export async function browseYikmFcPage(options: {
  page?: number
  /** 0=全部，其余见 YIKM_FC_TAGS */
  tag?: number
}): Promise<YikmFcBrowseResult> {
  const page = Math.max(1, Math.trunc(options.page ?? 1))
  const tag = Number.isFinite(options.tag) ? Math.trunc(options.tag as number) : 0
  const genre =
    tag === 0 ? '' : isYikmFcTag(tag) ? YIKM_TAG_GENRE[tag] : ''
  const url =
    tag === 0
      ? `${YIKM_ORIGIN}/nes?page=${page}&tag=0`
      : `${YIKM_ORIGIN}/nes?page=${page}&tag=${tag}&e=0`

  const html = await fetchText(url)
  const raw = parseListPage(html, genre)
  const items = raw.map((item) => listItemToBrowse(item, genre))
  const maxFromPager = parsePagerMaxPage(html, '/nes')
  // 满页且分页窗口还能往后再翻时，至少保留「下一页」
  const pageCount = Math.max(page, maxFromPager, items.length >= 20 ? page + 1 : page)

  return {
    items,
    page,
    pageSize: 20,
    pageCount,
    total: Math.max(0, (pageCount - 1) * 20 + items.length),
  }
}

/**
 * 实时搜索 yikm，并筛选 FC（封面路径含 /fcpic/）。
 * URL: `/search?name={q}`
 */
export async function searchYikmFcGames(options: {
  q: string
  page?: number
  pageSize?: number
}): Promise<YikmFcBrowseResult> {
  const q = options.q.trim()
  const page = Math.max(1, Math.trunc(options.page ?? 1))
  const pageSize = Math.min(60, Math.max(1, Math.trunc(options.pageSize ?? 20)))
  if (!q) {
    return { items: [], page, pageSize, pageCount: 1, total: 0 }
  }

  const html = await fetchText(`${YIKM_ORIGIN}/search?name=${encodeURIComponent(q)}`)
  const raw = parseListPage(html, '')
  const all = raw
    .filter((item) => isFcSearchItem(item))
    .map((item) => listItemToBrowse(item, item.genre || 'FC'))

  const pageCount = Math.max(1, Math.ceil(all.length / pageSize) || 1)
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * pageSize
  const items = all.slice(start, start + pageSize)

  return {
    items,
    page: safePage,
    pageSize,
    pageCount,
    total: all.length,
  }
}

export type YikmFcDetail = {
  id: string
  name: string
  downloadUrl: string
  imageUrl: string
  category: 'FC'
  genre: string
}

/** 解析 play 页；仅返回 FC/NES。 */
export async function resolveYikmFcDetail(playId: string, genre = ''): Promise<YikmFcDetail | null> {
  const id = playId.trim()
  if (!/^\d+$/.test(id)) return null

  const playHtml = await fetchText(`${YIKM_ORIGIN}/play?id=${id}`)
  const detail = parsePlayPage(playHtml)
  if (!detail?.gromname) return null
  if (!detailMatchesCategory(detail, 'FC')) return null

  return {
    id,
    name: detail.gname || `FC #${id}`,
    downloadUrl: playDetailToDownloadUrl(detail),
    imageUrl: absoluteUrl(detail.gpic),
    category: 'FC',
    genre: genre || 'FC',
  }
}

/** 兼容旧入库 id：`yikm-4137` / `yikm-arcade-4137` → `4137` */
export function normalizeYikmFcPlayId(id: string) {
  const raw = id.trim()
  if (/^\d+$/.test(raw)) return raw
  const m = raw.match(/^yikm(?:-arcade)?-(\d+)$/i)
  return m?.[1] ?? ''
}

export type YikmArcadeBrowseItem = {
  id: string
  name: string
  imageUrl: string
  genre: string
  category: '街机'
}

export type YikmArcadeBrowseResult = {
  items: YikmArcadeBrowseItem[]
  page: number
  pageSize: number
  pageCount: number
  total: number
}

function listItemToArcadeBrowse(
  item: ListItem,
  genreFallback: string,
): YikmArcadeBrowseItem {
  return {
    id: item.playId,
    name: item.name,
    imageUrl: item.imageUrl,
    genre: item.genre || genreFallback || '未分类',
    category: '街机',
  }
}

/**
 * 实时浏览 yikm 街机列表（不入库）。
 * 全部：`/nes?page={page}&tag=9`；类型：`/nes?page={page}&tag={中文}&e=1`
 */
export async function browseYikmArcadePage(options: {
  page?: number
  /** 9=全部，其余为中文 tag */
  tag?: YikmArcadeTag | 9 | string
}): Promise<YikmArcadeBrowseResult> {
  const page = Math.max(1, Math.trunc(options.page ?? 1))
  const rawTag = options.tag
  const isAll = rawTag === 9 || rawTag === '9' || rawTag == null || rawTag === ''
  const tag = isAll ? 9 : isYikmArcadeTag(rawTag) ? rawTag : 9
  const genre = tag === 9 ? '' : YIKM_ARCADE_TAG_GENRE[tag]
  const url =
    tag === 9
      ? `${YIKM_ORIGIN}/nes?page=${page}&tag=9`
      : `${YIKM_ORIGIN}/nes?page=${page}&tag=${encodeURIComponent(tag)}&e=1`

  const html = await fetchText(url)
  const raw = parseListPage(html, genre)
  const items = raw.map((item) => listItemToArcadeBrowse(item, genre))
  const maxFromPager = parsePagerMaxPage(html, '/nes')
  const pageCount = Math.max(page, maxFromPager, items.length >= 20 ? page + 1 : page)

  return {
    items,
    page,
    pageSize: 20,
    pageCount,
    total: Math.max(0, (pageCount - 1) * 20 + items.length),
  }
}

/**
 * 实时搜索 yikm，合并 FC + 街机（排除 Java/GBA/SFC 等其它机种）。
 */
export async function searchYikmLiveGames(options: {
  q: string
  page?: number
  pageSize?: number
}): Promise<{
  items: Array<YikmFcBrowseItem | YikmArcadeBrowseItem>
  page: number
  pageSize: number
  pageCount: number
  total: number
}> {
  const q = options.q.trim()
  const page = Math.max(1, Math.trunc(options.page ?? 1))
  const pageSize = Math.min(60, Math.max(1, Math.trunc(options.pageSize ?? 20)))
  if (!q) {
    return { items: [], page, pageSize, pageCount: 1, total: 0 }
  }

  const html = await fetchText(`${YIKM_ORIGIN}/search?name=${encodeURIComponent(q)}`)
  const raw = parseListPage(html, '')
  const all: Array<YikmFcBrowseItem | YikmArcadeBrowseItem> = []
  for (const item of raw) {
    if (isArcadeSearchItem(item)) {
      all.push(listItemToArcadeBrowse(item, item.genre || '街机'))
      continue
    }
    if (isFcSearchItem(item)) {
      all.push(listItemToBrowse(item, item.genre || 'FC'))
    }
  }

  const pageCount = Math.max(1, Math.ceil(all.length / pageSize) || 1)
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * pageSize
  const items = all.slice(start, start + pageSize)

  return {
    items,
    page: safePage,
    pageSize,
    pageCount,
    total: all.length,
  }
}

/** 仅街机搜索（列表页兼容） */
export async function searchYikmArcadeGames(options: {
  q: string
  page?: number
  pageSize?: number
}): Promise<YikmArcadeBrowseResult> {
  const q = options.q.trim()
  const page = Math.max(1, Math.trunc(options.page ?? 1))
  const pageSize = Math.min(60, Math.max(1, Math.trunc(options.pageSize ?? 20)))
  if (!q) {
    return { items: [], page, pageSize, pageCount: 1, total: 0 }
  }

  const html = await fetchText(`${YIKM_ORIGIN}/search?name=${encodeURIComponent(q)}`)
  const raw = parseListPage(html, '')
  const all = raw
    .filter((item) => isArcadeSearchItem(item))
    .map((item) => listItemToArcadeBrowse(item, item.genre || '街机'))

  const pageCount = Math.max(1, Math.ceil(all.length / pageSize) || 1)
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * pageSize
  const items = all.slice(start, start + pageSize)

  return {
    items,
    page: safePage,
    pageSize,
    pageCount,
    total: all.length,
  }
}

export type YikmArcadeDetail = {
  id: string
  name: string
  downloadUrl: string
  imageUrl: string
  category: '街机'
  genre: string
}

/** 解析 play 页；仅返回街机。 */
export async function resolveYikmArcadeDetail(
  playId: string,
  genre = '',
): Promise<YikmArcadeDetail | null> {
  const id = playId.trim()
  if (!/^\d+$/.test(id)) return null

  const playHtml = await fetchText(`${YIKM_ORIGIN}/play?id=${id}`)
  const detail = parsePlayPage(playHtml)
  if (!detail?.gromname) return null
  if (!detailMatchesCategory(detail, '街机')) return null

  return {
    id,
    name: detail.gname || `街机 #${id}`,
    downloadUrl: playDetailToDownloadUrl(detail),
    imageUrl: absoluteUrl(detail.gpic),
    category: '街机',
    genre: genre || '街机',
  }
}

/**
 * 解析 play 页，按 gameType 自动区分 FC / 街机。
 */
export async function resolveYikmLiveDetail(
  playId: string,
  genre = '',
): Promise<(YikmFcDetail | YikmArcadeDetail) | null> {
  const id = playId.trim()
  if (!/^\d+$/.test(id)) return null

  const playHtml = await fetchText(`${YIKM_ORIGIN}/play?id=${id}`)
  const detail = parsePlayPage(playHtml)
  if (!detail?.gromname) return null

  if (detailMatchesCategory(detail, 'FC')) {
    return {
      id,
      name: detail.gname || `FC #${id}`,
      downloadUrl: playDetailToDownloadUrl(detail),
      imageUrl: absoluteUrl(detail.gpic),
      category: 'FC',
      genre: genre || 'FC',
    }
  }

  if (detailMatchesCategory(detail, '街机')) {
    return {
      id,
      name: detail.gname || `街机 #${id}`,
      downloadUrl: playDetailToDownloadUrl(detail),
      imageUrl: absoluteUrl(detail.gpic),
      category: '街机',
      genre: genre || '街机',
    }
  }

  return null
}


