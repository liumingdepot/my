export type DanmakuPlatform = 'tencent' | 'iqiyi' | 'bilibili' | 'youku'

export type DanmakuSearchItem = {
  platform: DanmakuPlatform
  id: string
  title: string
  pic: string
  type: string
  year: number | null
  episodeCount: number
  kind?: string
}

export type DanmakuPart = {
  id: string
  title: string
  episodeIndex: number
  link?: string
}

export type DanmakuComment = {
  time: number
  mode: number
  color: number
  text: string
}

export const PLATFORM_LABEL: Record<DanmakuPlatform, string> = {
  tencent: '腾讯',
  iqiyi: '爱奇艺',
  bilibili: 'B站',
  youku: '优酷',
}

async function getJson<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(path, window.location.origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url.toString())
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || '请求失败')
  return data
}

export function searchDanmaku(q: string, page = 1) {
  return getJson<{
    list: DanmakuSearchItem[]
    page: number
    pageCount: number
    total: number
  }>('/api/video/danmaku/search', { q, page })
}

export function matchDanmaku(q: string, episode?: number | null) {
  const params: Record<string, string | number> = { q }
  if (episode != null && episode > 0) params.episode = episode
  return getJson<{
    item: DanmakuSearchItem
    part: DanmakuPart
    list: DanmakuComment[]
    count: number
  }>('/api/video/danmaku/match', params)
}

export function parseEpisodeNumber(raw?: string) {
  if (!raw) return null
  const text = raw.trim()
  const patterns = [
    /第\s*(\d+)\s*[集期话]/,
    /\bEP?\s*(\d+)\b/i,
    /^(\d{1,3})$/,
    /(\d{1,3})\s*集/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return Number(m[1])
  }
  return null
}

export function fetchDanmakuParts(platform: DanmakuPlatform, id: string, type = '') {
  const params: Record<string, string> = { platform, id }
  if (type) params.type = type
  return getJson<{
    platform: DanmakuPlatform
    id: string
    pages: DanmakuPart[]
  }>('/api/video/danmaku/parts', params)
}

export function fetchDanmakuComments(platform: DanmakuPlatform, id: string) {
  return getJson<{ list: DanmakuComment[]; count: number }>('/api/video/danmaku/comments', {
    platform,
    id,
  })
}

export function colorToCss(color: number) {
  const n = color >>> 0
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgb(${r},${g},${b})`
}
