/** 测试模块接口层 —— 对齐 hongguo-mac /api/test */

export const API = '/api/test'

export const GENRES = [
  { id: 'short_play', name: '真人剧' },
  { id: 'comic_series', name: '漫剧' },
  { id: 'ai_series', name: 'AI剧' },
] as const

export type GenreId = (typeof GENRES)[number]['id']

export type MacItem = {
  series_id: string
  title: string
  cover: string
  episode_cnt: number
  score: string
  play_cnt: number
  hot: string
  category: string | string[]
  intro: string
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

export type FilterRow = {
  type: string
  label: string
  items: { id: string; name: string }[]
}

async function request<T>(path: string): Promise<T> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 30000)
  try {
    const r = await fetch(`${API}${path}`, { signal: ctl.signal })
    if (!r.ok) {
      let detail = ''
      try {
        detail = ((await r.json()) as { detail?: string }).detail || ''
      } catch {
        /* ignore */
      }
      throw new Error(detail || `HTTP ${r.status}`)
    }
    return (await r.json()) as T
  } finally {
    clearTimeout(t)
  }
}

export function imgUrl(u?: string) {
  if (!u) return ''
  if (u.startsWith('/api/test/img') || u.startsWith('data:')) return u
  return `${API}/img?url=${encodeURIComponent(u)}`
}

export function streamUrl(seriesId: string, ep: number) {
  return `${API}/stream?series_id=${encodeURIComponent(seriesId)}&ep=${ep}`
}

export function prefetch(seriesId: string, ep: number) {
  return fetch(`${API}/prefetch?series_id=${encodeURIComponent(seriesId)}&ep=${ep}`).catch(() => {})
}

export const api = {
  filters: (genre: string) =>
    request<{ genre: string; name: string; rows: FilterRow[] }>(`/filters?genre=${genre}`),
  browse: (qs: string) =>
    request<{ items: MacItem[] }>(`/browse?${qs}`),
  latest: (genre: string, limit = 12) =>
    request<{ items: MacItem[] }>(`/latest?genre=${genre}&only_today=false&limit=${limit}`),
  rank: (board: string, limit = 30) =>
    request<{ items: MacItem[] }>(`/rank?board=${board}&limit=${limit}`),
  search: (q: string, limit = 40) =>
    request<{ results: MacItem[] }>(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  episodes: (seriesId: string) =>
    request<{ meta: MacMeta; episodes: MacEpisode[] }>(
      `/episodes?series_id=${encodeURIComponent(seriesId)}`,
    ),
  stats: () => request<{ uptime_s: number; engine: string; decrypt: boolean; note: string }>('/stats'),
}

export function catStr(v: string | string[] | undefined) {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string').join('/')
  return ''
}

export function catDots(v: string | string[] | undefined, n = 3) {
  return catStr(v)
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, n)
    .join(' · ')
}

export function fmtW(n?: number) {
  if (!n) return ''
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '亿'
  if (n >= 1e4) return Math.round(n / 1e4) + '万'
  return String(n)
}

export function fmtT(s: number) {
  s = Math.max(0, Math.floor(s || 0))
  const m = Math.floor(s / 60)
  return m + ':' + String(s % 60).padStart(2, '0')
}
