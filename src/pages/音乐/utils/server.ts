import type { Artist, ChartGroup, LyricLine, PlaylistCard, Song } from './types'

async function getJson<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(path, window.location.origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url.toString())
  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || '请求失败')
  }
  return data as T
}

export function searchMusic(key: string, pn = 0) {
  return getJson<{ list: Song[] }>('/api/music/search', { key, pn })
}

export function fetchPlaylists(order: 'hot' | 'new' = 'hot', pn = 1, rn = 30) {
  return getJson<{ list: PlaylistCard[] }>('/api/music/playlists', { order, pn, rn })
}

export function fetchPlaylistSongs(id: string | number) {
  return getJson<{ list: Song[] }>('/api/music/playlist', { id })
}

export function fetchCharts() {
  return getJson<{ list: ChartGroup[] }>('/api/music/charts')
}

export function fetchChartSongs(id: string | number, rn = 30) {
  return getJson<{ list: Song[]; pub?: string; cover?: string; total?: number }>('/api/music/chart', {
    id,
    rn,
  })
}

export function fetchArtists(params: { category?: number; prefix?: string; pn?: number; rn?: number }) {
  const q: Record<string, string | number> = {
    category: params.category ?? 0,
    pn: params.pn ?? 1,
    rn: params.rn ?? 60,
  }
  if (params.prefix) q.prefix = params.prefix
  return getJson<{ list: Artist[]; total: number }>('/api/music/artists', q)
}

export function fetchArtistSongs(id: string | number, pn = 1, rn = 50) {
  return getJson<{ list: Song[]; total: number }>('/api/music/artist', { id, pn, rn })
}

export function fetchTags() {
  return getJson<{ list: import('./types').TagGroup[] }>('/api/music/tags')
}

export function fetchTagPlaylists(id: string | number) {
  return getJson<{ list: PlaylistCard[] }>('/api/music/tag-playlists', { id })
}

export function fetchPlayUrl(rid: string) {
  return getJson<{ url: string }>('/api/music/play', { rid })
}

export function fetchLyric(rid: string) {
  return getJson<{ lines: LyricLine[] }>('/api/music/lyric', { rid })
}

export function formatListenCnt(n?: number | string) {
  const num = typeof n === 'string' ? Number(n) : n
  if (!num || !Number.isFinite(num)) return '0'
  if (num >= 100_000_000) return `${(num / 100_000_000).toFixed(1).replace(/\.0$/, '')}亿`
  if (num >= 10_000) return `${(num / 10_000).toFixed(1).replace(/\.0$/, '')}万`
  return String(num)
}
