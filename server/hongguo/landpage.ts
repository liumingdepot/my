/**
 * 官方分类筛选（landpage 接口）。
 *
 * 网页源只有 真人/漫剧/AI/动漫 四个粗分类；这里对接 App 的
 * `/reading/distribution/category/landpage/v`，拿到真正的多维筛选面板：
 *
 *   主题 category_dim_theme   短剧 34 项（打脸虐渣/逆袭/马甲/女性成长…）
 *   设定 category_dim_role    短剧 17 项（大女主/萌宝/真假千金/神豪…）
 *   背景 category_dim_epoch   短剧 6 项（古装/民国/校园/职场/乡村/历史古代）
 *   受众 gender               男频/女频
 *   时间 online_time          7/14/30/90 天内上新
 *   排序 sort                 最新/最热
 *
 * 实测该接口不校验签名，所以浏览筛选不经过 unidbg（快，也没有单模拟器瓶颈）。
 * 面板是实时的，不要硬编码选项。
 */

import { requestNoSign } from './fqapi.js'

export const GENRES = {
  short_play: { name: '真人剧', reqScene: 'default', genre: 'short_play' },
  comic_series: { name: '漫剧', reqScene: 'comic_series', genre: 'comic_series' },
  ai_series: { name: 'AI剧', reqScene: 'ai_series', genre: 'ai_series' },
} as const

export type GenreId = keyof typeof GENRES

/** 维度 key → 展示名（顺序即展示顺序） */
export const DIMENSIONS: Array<{ key: string; label: string }> = [
  { key: 'category_dim_theme', label: '主题' },
  { key: 'category_dim_role', label: '设定' },
  { key: 'category_dim_epoch', label: '背景' },
  { key: 'gender', label: '受众' },
  { key: 'online_time', label: '时间' },
  { key: 'sort', label: '排序' },
  { key: 'creation_status', label: '状态' },
]

export function isGenre(value: string): value is GenreId {
  return value in GENRES
}

export function normalizeGenre(value: string | null | undefined): GenreId {
  const v = (value || '').trim()
  return isGenre(v) ? v : 'short_play'
}

/** select_items 的七个维度，空数组表示不限 */
function emptySelect(genre: string): Record<string, string[]> {
  return {
    category_dim_theme: [],
    online_time: [],
    gender: [],
    category_dim_role: [],
    genre: [genre],
    sort: [],
    creation_status: [],
  }
}

export type FilterItem = { id: string; name: string }
export type FilterRow = {
  /** select_items 的键 */
  type: string
  label: string
  items: FilterItem[]
}

type SelectorRow = {
  type?: string
  row_name?: string
  selection_type?: string
  items?: Array<{ selector_item_id?: string; show_name?: string }>
}

const panelCache = new Map<GenreId, { at: number; rows: FilterRow[] }>()
const PANEL_TTL = 10 * 60_000

/** 取某体裁的实时筛选面板（缓存 10 分钟） */
export async function getFilters(genreValue: string): Promise<{ genre: GenreId; rows: FilterRow[] }> {
  const genre = normalizeGenre(genreValue)
  const cached = panelCache.get(genre)
  if (cached && Date.now() - cached.at < PANEL_TTL) return { genre, rows: cached.rows }
  const conf = GENRES[genre]
  const data = await requestNoSign<{ selector_rows?: SelectorRow[] }>('/reading/distribution/category/landpage/v', {
    filter_ids: '',
    req_scene: conf.reqScene,
    offset: 0,
    limit: 1,
    need_selector_panel: true,
    req_type: 'default',
    client_req_type: 3,
    session_id: '',
    select_items: emptySelect(conf.genre),
  })

  const rows: FilterRow[] = (data?.selector_rows || []).map((row) => ({
    type: String(row.type || ''),
    label: String(row.row_name || DIMENSIONS.find((d) => d.key === row.type)?.label || row.type || ''),
    items: (row.items || [])
      .map((it) => ({ id: String(it.selector_item_id ?? ''), name: String(it.show_name ?? '') }))
      .filter((it) => it.id && it.name),
  }))

  // 按展示顺序排序，未知维度排最后
  rows.sort((a, b) => {
    const ia = DIMENSIONS.findIndex((d) => d.key === a.type)
    const ib = DIMENSIONS.findIndex((d) => d.key === b.type)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
  panelCache.set(genre, { at: Date.now(), rows })
  return { genre, rows }
}

/**
 * 解析筛选值：已是 id 直接用，是中文名则按实时面板映射成 id。
 * 于是 /browse?theme=逆袭 和 /browse?theme=cate_739 都能用。
 */
async function resolveValues(genre: GenreId, dim: string, raw: string[]): Promise<string[]> {
  if (!raw.length) return []
  const looksLikeId = raw.every((v) => /^(cate_|days_|creation_status_|online_time|hot_)/.test(v) || /^[\d.]+$/.test(v))
  if (looksLikeId) return raw
  const { rows } = await getFilters(genre)
  const row = rows.find((r) => r.type === dim)
  if (!row) return raw
  const byName = new Map(row.items.map((i) => [i.name, i.id]))
  return raw.map((v) => byName.get(v) || v)
}

export type BrowseItem = {
  seriesId: string
  title: string
  cover: string
  intro: string
  episodeCnt: number
  score: string
  playCnt: number
  /** 分类标签，如「都市日常/家庭/逆袭」 */
  tags: string[]
  /** 首集 vid，可直接播放 */
  vid: string
}

export type BrowseOptions = {
  genre?: string
  theme?: string
  setting?: string
  background?: string
  sort?: string
  gender?: string
  days?: string
  status?: string
  offset?: number
  limit?: number
}

/** 把逗号分隔的查询参数拆成 id 数组 */
function splitParam(value: string | null): string[] {
  return (value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

/**
 * 封面改成浏览器能显示的格式。
 *
 * App 接口给的是 `.heic`，浏览器（Safari 除外）都不支持；而且这些 URL 是
 * 签名过的（`fqnovelpic.com`），改扩展名会 403。
 * 但图片 hash 与 byteimg 通用 CDN 是同一份，把 host/模板换过去即可拿到 jpeg：
 *   ...fqnovelpic.com/novel-pic/<hash>~tplv-...heic
 *   →p3-novel.byteimg.com/novel-pic/<hash>~tplv-shrink:640:0.image
 */
export function toBrowserCover(raw: string): string {
  const url = String(raw || '').trim()
  if (!url) return ''
  if (!/\.heic(\?|$)/i.test(url)) return url // 已经是 web 源的 .image/.jpg
  const hash = /\/novel-pic\/([0-9a-f]+)(~|~[^?]*)?/i.exec(url)?.[1]
  if (!hash) return url
  return `https://p3-novel.byteimg.com/novel-pic/${hash}~tplv-shrink:640:0.image`
}

function extractTags(item: Record<string, unknown>): string[] {
  const schema = String(item.category_schema || '')
  const names = [...schema.matchAll(/"name":"([^"]+)"/g)].map((m) => m[1]!)
  if (names.length) return names
  // 兜底：sub_title_list 里挑分类词
  const subs = (Array.isArray(item.sub_title_list) ? item.sub_title_list : [])
    .map((s) => String((s as Record<string, unknown>)?.content || ''))
    .filter((s) => s && !/^\d+(\.\d+)?万?$/.test(s) && !/播放|集$/.test(s) && s !== '今日上新')
  return [...new Set(subs)]
}

/**
 * 按多维筛选浏览。offset 翻页，has_more 为 false 时到底。
 * 返回条目已按 series_id 去重所需的字段整理。
 */
export async function browse(opts: BrowseOptions = {}): Promise<{
  genre: GenreId
  offset: number
  hasMore: boolean
  items: BrowseItem[]
}> {
  const genre = normalizeGenre(opts.genre)
  const conf = GENRES[genre]
  const limit = Math.min(60, Math.max(1, Number(opts.limit) || 24))
  const offset = Math.max(0, Number(opts.offset) || 0)

  const select = emptySelect(conf.genre)
  select.category_dim_theme = await resolveValues(genre, 'category_dim_theme', splitParam(opts.theme))
  select.category_dim_role = await resolveValues(genre, 'category_dim_role', splitParam(opts.setting))
  select.category_dim_epoch = await resolveValues(genre, 'category_dim_epoch', splitParam(opts.background))
  select.gender = await resolveValues(genre, 'gender', splitParam(opts.gender))
  select.online_time = await resolveValues(genre, 'online_time', splitParam(opts.days))
  select.sort = await resolveValues(genre, 'sort', splitParam(opts.sort))
  select.creation_status = await resolveValues(genre, 'creation_status', splitParam(opts.status))

  const data = await requestNoSign<{
    video_data?: Array<Record<string, unknown>>
    has_more?: boolean
  }>('/reading/distribution/category/landpage/v', {
    filter_ids: '',
    req_scene: conf.reqScene,
    offset,
    need_selector_panel: false,
    limit,
    select_items: select,
    session_id: '',
    req_type: 'only_content',
    client_req_type: 3,
  })

  const items: BrowseItem[] = (data?.video_data || [])
    .map((it) => {
      const seriesId = String(it.series_id ?? '')
      if (!seriesId) return null
      return {
        seriesId,
        title: String(it.title || ''),
        cover: toBrowserCover(String(it.cover || '')),
        intro: String(it.video_desc || '').slice(0, 80),
        episodeCnt: Number(it.episode_cnt) || 0,
        score: String(it.score ?? ''),
        playCnt: Number(it.play_cnt) || 0,
        tags: extractTags(it),
        vid: String(it.vid || ''),
      }
    })
    .filter((x): x is BrowseItem => x !== null)

  return { genre, offset, hasMore: Boolean(data?.has_more) && items.length > 0, items }
}