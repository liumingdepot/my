import type { ChartGroup, LyricLine, PlaylistCard, Song, TagGroup } from './types'


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

export function fetchPlaylists() {
  return getJson<{ list: PlaylistCard[] }>('/api/music/playlists')
}

export function fetchPlaylistSongs(id: string | number) {
  return getJson<{ list: Song[] }>('/api/music/playlist', { id })
}

export function fetchCharts() {
  return getJson<{ list: ChartGroup[] }>('/api/music/charts')
}

export function fetchChartSongs(id: string | number) {
  return getJson<{ list: Song[] }>('/api/music/chart', { id })
}

export function fetchTags() {
  return getJson<{ list: TagGroup[] }>('/api/music/tags')
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
