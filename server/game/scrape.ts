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

/** yikm `/nes` 网页游戏分类 tag（e=9，中文 tag；全部 tag 为空） */
export const YIKM_WEB_TAGS = [
  { tag: 'RPG冒险', genre: 'RPG冒险' },
  { tag: '动作', genre: '动作' },
  { tag: '射击', genre: '射击' },
  { tag: '放置点击类', genre: '放置点击类' },
  { tag: '益智解谜', genre: '益智解谜' },
  { tag: '策略防御', genre: '策略防御' },
  { tag: '经营模拟', genre: '经营模拟' },
  { tag: '运动竞速', genre: '运动竞速' },
  { tag: '音乐绘画', genre: '音乐绘画' },
] as const

export type YikmWebTag = (typeof YIKM_WEB_TAGS)[number]['tag']

const YIKM_WEB_TAG_GENRE = Object.fromEntries(YIKM_WEB_TAGS.map((item) => [item.tag, item.genre])) as Record<
  YikmWebTag,
  string
>

export function isYikmWebTag(value: unknown): value is YikmWebTag {
  return typeof value === 'string' && value in YIKM_WEB_TAG_GENRE
}

/** 中文类型 → yikm 网页游戏 tag；空 → ''（全部） */
export function yikmWebTagFromGenre(genre?: string): YikmWebTag | '' {
  const key = genre?.trim() ?? ''
  if (!key) return ''
  return isYikmWebTag(key) ? key : ''
}

/** yikm `/nes` 怀旧 Java 分类 tag（e=8，中文 tag；全部 tag 为空） */
export const YIKM_JAVA_TAGS = [
  { tag: '角色扮演', genre: '角色扮演' },
  { tag: '益智休闲', genre: '益智休闲' },
  { tag: '飞行游戏', genre: '飞行游戏' },
  { tag: '动作游戏', genre: '动作游戏' },
  { tag: '冒险游戏', genre: '冒险游戏' },
  { tag: '策略战棋', genre: '策略战棋' },
  { tag: '模拟经营', genre: '模拟经营' },
  { tag: '体育运动', genre: '体育运动' },
  { tag: '赛车游戏', genre: '赛车游戏' },
  { tag: '格斗游戏', genre: '格斗游戏' },
  { tag: '射击游戏', genre: '射击游戏' },
  { tag: '棋牌游戏', genre: '棋牌游戏' },
  { tag: '养成游戏', genre: '养成游戏' },
  { tag: '音乐舞蹈', genre: '音乐舞蹈' },
] as const

export type YikmJavaTag = (typeof YIKM_JAVA_TAGS)[number]['tag']

const YIKM_JAVA_TAG_GENRE = Object.fromEntries(
  YIKM_JAVA_TAGS.map((item) => [item.tag, item.genre]),
) as Record<YikmJavaTag, string>

export function isYikmJavaTag(value: unknown): value is YikmJavaTag {
  return typeof value === 'string' && value in YIKM_JAVA_TAG_GENRE
}

/** 中文类型 → yikm 怀旧 Java tag；空 → ''（全部） */
export function yikmJavaTagFromGenre(genre?: string): YikmJavaTag | '' {
  const key = genre?.trim() ?? ''
  if (!key) return ''
  return isYikmJavaTag(key) ? key : ''
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
  // 街机 / FC / Flash / Java 封面在 img CDN
  if (src.startsWith('/arcadepic/')) return `https://img.1990i.com${src}`
  if (src.startsWith('/fcpic/') || src.startsWith('/sfcpic/')) return `https://img.1990i.com${src}`
  if (src.startsWith('/flashpic/')) return `https://img.1990i.com${src}`
  if (src.startsWith('/jarimgs/')) return `https://img.1990i.com${src}`
  if (src.startsWith('/')) return `${YIKM_ORIGIN}${src}`
  // 网页游戏 play 页 gpic 常为纯文件名（hash 或短名如 bvn2.jpg）
  if (/^[\w.-]+\.(png|jpe?g|gif|webp)$/i.test(src)) {
    return `https://img.1990i.com/flashpic/${src}`
  }
  return `${YIKM_ORIGIN}/${src}`
}

/** Java 封面：play 页 gpic 多为纯文件名 */
function javaImageUrl(gpic: string) {
  if (!gpic) return ''
  if (/^https?:\/\//i.test(gpic)) return gpic
  if (gpic.startsWith('//')) return `https:${gpic}`
  if (gpic.startsWith('/jarimgs/')) return `https://img.1990i.com${gpic}`
  if (gpic.startsWith('/')) return absoluteUrl(gpic)
  return `https://img.1990i.com/jarimgs/${gpic.replace(/^\/+/, '')}`
}

/** Java JAR：gamejar 多为绝对 URL；相对路径挂在 jarrom/ 下 */
export function javaJarPathToDownloadUrl(gamejar: string) {
  const raw = gamejar.trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('//')) return `https:${raw}`
  const path = raw.replace(/^\/+/, '')
  const under = path.startsWith('jarrom/') ? path : `jarrom/${path}`
  return `${ROM_CDN}/${under
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')}`
}

/** Flash ROM：file.1990i.com/flashrom/{path}；grom 可能含目录如 `bvn2/xxx.swf` */
export function flashRomPathToDownloadUrl(grom: string) {
  const path = grom.trim().replace(/^\/+/, '')
  if (!path) return ''
  return `${ROM_CDN}/flashrom/${path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')}`
}

/** Flash 资源根：`rombase` 非空时为 flashrom/{rombase}/，供 Ruffle 加载相对资源 */
export function flashRomBaseUrl(rombase?: string) {
  const base = (rombase ?? '').trim().replace(/^\/+|\/+$/g, '')
  if (!base) return `${ROM_CDN}/flashrom/`
  return `${ROM_CDN}/flashrom/${base
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')}/`
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

/** 克隆盘 parent：gromname 形如 clone.zip$parent.zip */
export function arcadeParentRomPathToDownloadUrl(gsystem: string, gromname: string): string | null {
  const parts = gromname
    .split('$')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length < 2) return null
  const parent = parts[1]!
  const system = gsystem.trim().replace(/^\/+|\/+$/g, '')
  if (!system || !parent) return null
  const file = parent.includes('/') ? parent.split('/').pop()! : parent
  if (!/\.zip$/i.test(file)) return null
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
  grom: string
  gpic: string
  gameid: string
  gname: string
  gsystem: string
  gameType: string
  /** Flash 相对资源目录（空=无） */
  rombase: string
}

/** FC：gromname；街机：gromname+gsystem；网页 Flash：grom=.swf */
function parsePlayPage(html: string): PlayDetail | null {
  const gromname = html.match(/var\s+gromname="([^"]+)"/)?.[1] ?? html.match(/\bgromname="([^"]+)"/)?.[1] ?? ''
  const grom = html.match(/\bgrom="([^"]+)"/)?.[1] ?? ''
  if (!gromname && !grom) return null

  const gpic = html.match(/\bgpic="([^"]*)"/)?.[1] ?? ''
  const gameid = html.match(/\bgameid="([^"]+)"/)?.[1] ?? ''
  const gname = decodeHtml(html.match(/\bgname="([^"]*)"/)?.[1] ?? '')
  const gsystem = html.match(/\bgsystem="([^"]*)"/)?.[1] ?? ''
  const gameType = html.match(/\bgameType="([^"]*)"/)?.[1] ?? ''
  const rombase = html.match(/\brombase="([^"]*)"/)?.[1] ?? ''

  return { gromname, grom, gpic, gameid, gname, gsystem, gameType, rombase }
}

function playDetailToDownloadUrl(detail: PlayDetail) {
  // Flash 网页游戏
  if (/\.swf$/i.test(detail.grom)) {
    return flashRomPathToDownloadUrl(detail.grom)
  }
  // 仅 arcade 走 fbneo 路径；FC 详情页也会带 gsystem="fc"，不能凭 gsystem 判断
  if (detail.gameType === 'arcade' && detail.gsystem && detail.gromname) {
    return arcadeRomPathToDownloadUrl(detail.gsystem, detail.gromname)
  }
  if (detail.gromname) return romPathToDownloadUrl(detail.gromname)
  return ''
}

function playDetailToParentDownloadUrl(detail: PlayDetail) {
  if (detail.gameType === 'arcade' && detail.gsystem && detail.gromname.includes('$')) {
    return arcadeParentRomPathToDownloadUrl(detail.gsystem, detail.gromname)
  }
  return null
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
  if (category === '网页游戏') {
    return /\.swf$/i.test(detail.grom) || type === 'flash' || type === 'html5' || type === 'h5'
  }
  if (category === '怀旧java') {
    return type === 'java' || type === 'jar' || /\.jar$/i.test(detail.grom) || /\.jar$/i.test(detail.gromname)
  }
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

type JavaPlayDetail = {
  gname: string
  gpic: string
  gamejar: string
  cgId: string
  gcwidth: number
  gcheight: number
}

function parseJavaPlayPage(html: string): JavaPlayDetail | null {
  const gamejar =
    html.match(/\bgamejar="([^"]+)"/)?.[1] ??
    html.match(/https?:\/\/[^"'\\\s>]+\.jar/i)?.[0] ??
    ''
  if (!gamejar) return null
  const gname = decodeHtml(html.match(/\bgname="([^"]*)"/)?.[1] ?? '')
  const gpic = html.match(/\bgpic="([^"]*)"/)?.[1] ?? ''
  const cgId = html.match(/\bcgId=(\d+)/)?.[1] ?? ''
  const gcwidth = Number(html.match(/\bgcwidth=parseInt\("(\d+)"\)/)?.[1] ?? 240)
  const gcheight = Number(html.match(/\bgcheight=parseInt\("(\d+)"\)/)?.[1] ?? 320)
  return {
    gname,
    gpic,
    gamejar,
    cgId,
    gcwidth: Number.isFinite(gcwidth) && gcwidth > 0 ? gcwidth : 240,
    gcheight: Number.isFinite(gcheight) && gcheight > 0 ? gcheight : 320,
  }
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

/** 搜索结果里其它机种标签（GBA 等常混在一起，不能只靠路径；Java 单独识别） */
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
    'dos',
    'SMS',
    'GG',
  ].map((s) => s.toLowerCase()),
)

const WEB_SYSTEM_LABELS = new Set(['flash', 'html5', 'h5'])
const JAVA_SYSTEM_LABELS = new Set(['java', 'jar'])

function hasOtherSystemLabel(labels: string[]) {
  return labels.some((label) => OTHER_SYSTEM_LABELS.has(label.trim().toLowerCase()))
}

function isJavaSearchItem(item: ListItem) {
  if (hasOtherSystemLabel(item.labels)) return false
  if (item.labels.some((label) => JAVA_SYSTEM_LABELS.has(label.trim().toLowerCase()))) return true
  return /\/jarimgs\//i.test(item.imageUrl)
}

function isFcSearchItem(item: ListItem) {
  if (hasOtherSystemLabel(item.labels) || item.labels.includes('街机')) return false
  if (item.labels.some((label) => WEB_SYSTEM_LABELS.has(label.trim().toLowerCase()))) return false
  if (item.labels.some((label) => JAVA_SYSTEM_LABELS.has(label.trim().toLowerCase()))) return false
  // Java 封面在 jarimgs；其它机种也有独立目录
  if (/\/(?:jarimgs|flashpic|dospic|mdpic|sfcpic|gbapic|arcadepic)\//i.test(item.imageUrl)) {
    return false
  }
  return /\/fcpic\//i.test(item.imageUrl)
}

function isArcadeSearchItem(item: ListItem) {
  if (hasOtherSystemLabel(item.labels)) return false
  if (item.labels.some((label) => WEB_SYSTEM_LABELS.has(label.trim().toLowerCase()))) return false
  if (item.labels.some((label) => JAVA_SYSTEM_LABELS.has(label.trim().toLowerCase()))) return false
  if (/\/(?:jarimgs|flashpic|dospic|mdpic|sfcpic|gbapic|fcpic)\//i.test(item.imageUrl)) {
    return false
  }
  if (item.labels.includes('街机')) return true
  return /\/arcadepic\//i.test(item.imageUrl)
}

function isWebSearchItem(item: ListItem) {
  if (hasOtherSystemLabel(item.labels)) return false
  if (item.labels.some((label) => JAVA_SYSTEM_LABELS.has(label.trim().toLowerCase()))) return false
  if (item.labels.some((label) => WEB_SYSTEM_LABELS.has(label.trim().toLowerCase()))) return true
  return /\/flashpic\//i.test(item.imageUrl)
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
 * 实时搜索 yikm，合并 FC + 街机 + 网页游戏 + 怀旧java（排除 GBA/SFC 等其它机种）。
 */
export async function searchYikmLiveGames(options: {
  q: string
  page?: number
  pageSize?: number
}): Promise<{
  items: Array<YikmFcBrowseItem | YikmArcadeBrowseItem | YikmWebBrowseItem | YikmJavaBrowseItem>
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
  const all: Array<YikmFcBrowseItem | YikmArcadeBrowseItem | YikmWebBrowseItem | YikmJavaBrowseItem> =
    []
  for (const item of raw) {
    if (isJavaSearchItem(item)) {
      all.push(listItemToJavaBrowse(item, item.genre || '怀旧java'))
      continue
    }
    if (isWebSearchItem(item)) {
      all.push(listItemToWebBrowse(item, item.genre || '网页游戏'))
      continue
    }
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
  /** 克隆盘 parent romset（gromname 中 $ 之后），供代理合并 */
  parentDownloadUrl?: string
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
    parentDownloadUrl: playDetailToParentDownloadUrl(detail) || undefined,
    imageUrl: absoluteUrl(detail.gpic),
    category: '街机',
    genre: genre || '街机',
  }
}

export type YikmWebBrowseItem = {
  id: string
  name: string
  imageUrl: string
  genre: string
  category: '网页游戏'
}

export type YikmWebBrowseResult = {
  items: YikmWebBrowseItem[]
  page: number
  pageSize: number
  pageCount: number
  total: number
}

function listItemToWebBrowse(item: ListItem, genreFallback: string): YikmWebBrowseItem {
  return {
    id: item.playId,
    name: item.name,
    imageUrl: item.imageUrl,
    genre: item.genre || genreFallback || '未分类',
    category: '网页游戏',
  }
}

/**
 * 实时浏览 yikm 网页游戏列表（不入库）。
 * 全部：`/nes?page={page}&e=9&tag=`；类型：`/nes?page={page}&tag={中文}&e=9`
 */
export async function browseYikmWebPage(options: {
  page?: number
  /** 空=全部，其余为中文 tag */
  tag?: YikmWebTag | '' | string
}): Promise<YikmWebBrowseResult> {
  const page = Math.max(1, Math.trunc(options.page ?? 1))
  const rawTag = options.tag
  const isAll = rawTag == null || rawTag === ''
  const tag = isAll ? '' : isYikmWebTag(rawTag) ? rawTag : ''
  const genre = tag ? YIKM_WEB_TAG_GENRE[tag] : ''
  const url = tag
    ? `${YIKM_ORIGIN}/nes?page=${page}&tag=${encodeURIComponent(tag)}&e=9`
    : `${YIKM_ORIGIN}/nes?page=${page}&e=9&tag=`

  const html = await fetchText(url)
  const raw = parseListPage(html, genre)
  const items = raw.map((item) => listItemToWebBrowse(item, genre))
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

/** 仅网页游戏搜索 */
export async function searchYikmWebGames(options: {
  q: string
  page?: number
  pageSize?: number
}): Promise<YikmWebBrowseResult> {
  const q = options.q.trim()
  const page = Math.max(1, Math.trunc(options.page ?? 1))
  const pageSize = Math.min(60, Math.max(1, Math.trunc(options.pageSize ?? 20)))
  if (!q) {
    return { items: [], page, pageSize, pageCount: 1, total: 0 }
  }

  const html = await fetchText(`${YIKM_ORIGIN}/search?name=${encodeURIComponent(q)}`)
  const raw = parseListPage(html, '')
  const all = raw
    .filter((item) => isWebSearchItem(item))
    .map((item) => listItemToWebBrowse(item, item.genre || '网页游戏'))

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

export type YikmWebDetail = {
  id: string
  name: string
  downloadUrl: string
  imageUrl: string
  category: '网页游戏'
  genre: string
  /** 相对资源目录（CDN flashrom/{rombase}/）；空则无额外资源根 */
  rombase: string
}

/** 解析 play 页；仅返回网页游戏（Flash）。 */
export async function resolveYikmWebDetail(
  playId: string,
  genre = '',
): Promise<YikmWebDetail | null> {
  const id = playId.trim()
  if (!/^\d+$/.test(id)) return null

  const playHtml = await fetchText(`${YIKM_ORIGIN}/play?id=${id}`)
  const detail = parsePlayPage(playHtml)
  if (!detail) return null
  if (!detailMatchesCategory(detail, '网页游戏')) return null

  const downloadUrl = playDetailToDownloadUrl(detail)
  if (!downloadUrl) return null

  return {
    id,
    name: detail.gname || `网页游戏 #${id}`,
    downloadUrl,
    imageUrl: absoluteUrl(detail.gpic),
    category: '网页游戏',
    genre: genre || '网页游戏',
    rombase: detail.rombase.trim(),
  }
}

export type YikmJavaBrowseItem = {
  id: string
  name: string
  imageUrl: string
  genre: string
  category: '怀旧java'
}

export type YikmJavaBrowseResult = {
  items: YikmJavaBrowseItem[]
  page: number
  pageSize: number
  pageCount: number
  total: number
}

function listItemToJavaBrowse(item: ListItem, genreFallback: string): YikmJavaBrowseItem {
  return {
    id: item.playId,
    name: item.name,
    imageUrl: item.imageUrl,
    genre: item.genre || genreFallback || '未分类',
    category: '怀旧java',
  }
}

/**
 * 实时浏览 yikm 怀旧 Java 列表（不入库）。
 * 全部：`/nes?page={page}&e=8&tag=`；类型：`/nes?page={page}&tag={中文}&e=8`
 */
export async function browseYikmJavaPage(options: {
  page?: number
  /** 空=全部，其余为中文 tag */
  tag?: YikmJavaTag | '' | string
}): Promise<YikmJavaBrowseResult> {
  const page = Math.max(1, Math.trunc(options.page ?? 1))
  const rawTag = options.tag
  const isAll = rawTag == null || rawTag === ''
  const tag = isAll ? '' : isYikmJavaTag(rawTag) ? rawTag : ''
  const genre = tag ? YIKM_JAVA_TAG_GENRE[tag] : ''
  const url = tag
    ? `${YIKM_ORIGIN}/nes?page=${page}&tag=${encodeURIComponent(tag)}&e=8`
    : `${YIKM_ORIGIN}/nes?page=${page}&e=8&tag=`

  const html = await fetchText(url)
  const raw = parseListPage(html, genre)
  const items = raw.map((item) => listItemToJavaBrowse(item, genre))
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

/** 仅怀旧 Java 搜索 */
export async function searchYikmJavaGames(options: {
  q: string
  page?: number
  pageSize?: number
}): Promise<YikmJavaBrowseResult> {
  const q = options.q.trim()
  const page = Math.max(1, Math.trunc(options.page ?? 1))
  const pageSize = Math.min(60, Math.max(1, Math.trunc(options.pageSize ?? 20)))
  if (!q) {
    return { items: [], page, pageSize, pageCount: 1, total: 0 }
  }

  const html = await fetchText(`${YIKM_ORIGIN}/search?name=${encodeURIComponent(q)}`)
  const raw = parseListPage(html, '')
  const all = raw
    .filter((item) => isJavaSearchItem(item))
    .map((item) => listItemToJavaBrowse(item, item.genre || '怀旧java'))

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

export type YikmJavaDetail = {
  id: string
  name: string
  downloadUrl: string
  imageUrl: string
  category: '怀旧java'
  genre: string
  width: number
  height: number
}

/** 解析 play 页；仅返回怀旧 Java（JAR）。 */
export async function resolveYikmJavaDetail(
  playId: string,
  genre = '',
): Promise<YikmJavaDetail | null> {
  const id = playId.trim()
  if (!/^\d+$/.test(id)) return null

  const playHtml = await fetchText(`${YIKM_ORIGIN}/play?id=${id}`)
  const detail = parseJavaPlayPage(playHtml)
  if (!detail) return null

  const downloadUrl = javaJarPathToDownloadUrl(detail.gamejar)
  if (!downloadUrl) return null

  return {
    id,
    name: detail.gname || `怀旧java #${id}`,
    downloadUrl,
    imageUrl: javaImageUrl(detail.gpic),
    category: '怀旧java',
    genre: genre || '怀旧java',
    width: detail.gcwidth,
    height: detail.gcheight,
  }
}

/**
 * 同源嵌入页：复用 yikm j2me 壳，把 gamejar 指到本站 ROM 代理（CDN 无 CORS）。
 */
export async function buildYikmJavaEmbedHtml(options: {
  playId: string
  jarUrl: string
}): Promise<string | null> {
  const id = options.playId.trim()
  if (!/^\d+$/.test(id)) return null
  const jarUrl = options.jarUrl.trim()
  if (!jarUrl) return null

  const html = await fetchText(`${YIKM_ORIGIN}/play?id=${id}`)
  if (!parseJavaPlayPage(html)) return null

  let out = html
  out = out.replace(/\bgamejar="[^"]*"/, `gamejar=${JSON.stringify(jarUrl)}`)
  // 去掉广告 / 统计
  out = out.replace(/<script\b[^>]*googlesyndication[^>]*>[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<script\b[^>]*googletagmanager[^>]*>[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<script\b[^>]*>\s*window\.dataLayer[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<script\b[^>]*>\s*\(adsbygoogle[\s\S]*?<\/script>/gi, '')
  // 嵌入样式：隐藏侧栏/返回，画面居中铺满
  const embedCss = `<style id="embed-java">
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000!important}
.style_backButton,#leftmenu,#rightmenu,[data-testid="side-menu"]{display:none!important}
#display-container{padding:0!important;height:100%!important}
#display{max-width:none!important;height:100%!important;margin:0!important}
.container-phone{height:100%!important;max-width:none!important;justify-content:center!important;align-items:center!important}
.container-img{max-width:none!important;height:100%!important;display:flex!important;align-items:center!important;justify-content:center!important}
#canvas{max-height:100%!important;max-width:100%!important}
#keypad{display:none!important}
</style>`
  if (out.includes('</head>')) {
    out = out.replace('</head>', `${embedCss}</head>`)
  } else {
    out = embedCss + out
  }
  return out
}

/**
 * 解析 play 页，按类型自动区分 FC / 街机 / 网页游戏 / 怀旧java。
 */
export async function resolveYikmLiveDetail(
  playId: string,
  genre = '',
): Promise<(YikmFcDetail | YikmArcadeDetail | YikmWebDetail | YikmJavaDetail) | null> {
  const id = playId.trim()
  if (!/^\d+$/.test(id)) return null

  const playHtml = await fetchText(`${YIKM_ORIGIN}/play?id=${id}`)
  const detail = parsePlayPage(playHtml)

  if (detail) {
    if (detailMatchesCategory(detail, '网页游戏')) {
      const downloadUrl = playDetailToDownloadUrl(detail)
      if (!downloadUrl) return null
      return {
        id,
        name: detail.gname || `网页游戏 #${id}`,
        downloadUrl,
        imageUrl: absoluteUrl(detail.gpic),
        category: '网页游戏',
        genre: genre || '网页游戏',
        rombase: detail.rombase.trim(),
      }
    }

    if (detail.gromname) {
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
          parentDownloadUrl: playDetailToParentDownloadUrl(detail) || undefined,
          imageUrl: absoluteUrl(detail.gpic),
          category: '街机',
          genre: genre || '街机',
        }
      }
    }
  }

  const java = parseJavaPlayPage(playHtml)
  if (java) {
    const downloadUrl = javaJarPathToDownloadUrl(java.gamejar)
    if (!downloadUrl) return null
    return {
      id,
      name: java.gname || `怀旧java #${id}`,
      downloadUrl,
      imageUrl: javaImageUrl(java.gpic),
      category: '怀旧java',
      genre: genre || '怀旧java',
      width: java.gcwidth,
      height: java.gcheight,
    }
  }

  return null
}


