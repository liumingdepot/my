/** 多维筛选接口层 —— 对接 /api/hongguo 的 landpage 路由 */

export type FilterItem = { id: string; name: string }
export type FilterRow = { type: string; label: string; items: FilterItem[] }

export type BrowseItem = {
  seriesId: string
  title: string
  cover: string
  intro: string
  episodeCnt: number
  score: string
  playCnt: number
  tags: string[]
  vid: string
}

/** 维度 key → 查询参数名（与后端 landpage.ts 对应） */
export const PARAM_BY_DIM: Record<string, string> = {
  category_dim_theme: 'theme',
  category_dim_role: 'setting',
  category_dim_epoch: 'background',
  gender: 'gender',
  online_time: 'days',
  sort: 'sort',
  creation_status: 'status',
}

/** 顶栏分类 → landpage 体裁 */
export const GENRE_BY_CAT: Record<string, string> = {
  home: 'short_play',
  real: 'short_play',
  comic: 'comic_series',
  ai: 'ai_series',
  /** landpage 无独立动漫体裁，筛选面板复用漫剧 */
  anime: 'comic_series',
}

/** 从地址栏读出 dim → id */
export function readPicked(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [dim, key] of Object.entries(PARAM_BY_DIM)) {
    const v = params.get(key)
    if (v) out[dim] = v
  }
  return out
}

/** 把 dim → id 写成地址栏参数（不含 genre，体裁由分类路径决定） */
export function writePicked(picked: Record<string, string>): URLSearchParams {
  const q = new URLSearchParams()
  for (const [dim, key] of Object.entries(PARAM_BY_DIM)) {
    if (picked[dim]) q.set(key, picked[dim])
  }
  return q
}

/** 组装 browse 接口查询（含 genre） */
export function buildBrowseQuery(genre: string, picked: Record<string, string>): URLSearchParams {
  const q = writePicked(picked)
  q.set('genre', genre)
  return q
}

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json()) as {
    ok?: boolean
    data?: T
    error?: string
    detail?: string
    // 兼容 mac 契约的裸响应
    rows?: unknown
  }
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || body.detail || `请求失败 (${res.status})`)
  }
  if (body.ok && body.data === undefined) {
    throw new Error('接口返回为空')
  }
  return (body.data ?? (body as unknown)) as T
}

/** 取某体裁的实时筛选面板（主题/设定/背景/受众/时间/排序） */
export async function fetchFilters(genre: string, signal?: AbortSignal) {
  const q = new URLSearchParams({ genre })
  return parse<{ genre: string; rows: FilterRow[] }>(
    await fetch(`/api/hongguo/filters?${q}`, { signal }),
  )
}

/** 按多维条件浏览；筛选项可直接传 id 或中文名 */
export async function fetchBrowse(
  query: URLSearchParams,
  offset = 0,
  limit = 36,
  signal?: AbortSignal,
) {
  const q = new URLSearchParams(query)
  q.set('offset', String(offset))
  q.set('limit', String(limit))
  return parse<{ genre: string; offset: number; hasMore: boolean; items: BrowseItem[] }>(
    await fetch(`/api/hongguo/browse?${q}`, { signal }),
  )
}