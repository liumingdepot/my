import type { PlaySource, VodItem } from './types'

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

/** Parse MacCMS vod_play_url → playable sources (m3u8 / mp4) */
export function parsePlayUrl(vodPlayUrl: string, sourceName: string): PlaySource[] {
  if (!vodPlayUrl) return []
  return vodPlayUrl
    .split('$$$')
    .map((chunk, index) => {
      if (!chunk.includes('.m3u8') && !chunk.includes('.mp4')) return null
      const episodes = chunk
        .split('#')
        .map((ep, epIndex) => {
          const [title, url] = ep.split('$')
          if (!url) return null
          return { title: title || `第${epIndex + 1}集`, url }
        })
        .filter((e): e is { title: string; url: string } => !!e)
      if (!episodes.length) return null
      return {
        title: `${sourceName}${index + 1}`,
        episodes,
      }
    })
    .filter((s): s is PlaySource => !!s)
}

function withPlaySources(item: VodItem): VodItem {
  const playSources = parsePlayUrl(item.vod_play_url, item.source || '源')
  return {
    ...item,
    playSources,
    typeUrl: item.typeUrl || [
      {
        name: item.source,
        type_id: item.type_id,
      },
    ],
  }
}

export function fetchSources() {
  return getJson<{ list: { name: string }[] }>('/api/video/sources')
}

export function searchVideos(q: string, source: string, pg = 1) {
  return getJson<{ list: VodItem[]; page: number; pagecount: number }>('/api/video/search', {
    q,
    source,
    pg,
  }).then((data) => ({
    ...data,
    list: data.list.map(withPlaySources).filter((v) => (v.playSources?.length ?? 0) > 0),
  }))
}

export function listVideos(t: string | number, source: string, pg = 1) {
  return getJson<{ list: VodItem[]; page: number; pagecount: number }>('/api/video/list', {
    t,
    source,
    pg,
  }).then((data) => ({
    ...data,
    list: data.list.map(withPlaySources).filter((v) => (v.playSources?.length ?? 0) > 0),
  }))
}

export function streamUrl(raw: string) {
  if (!raw) return ''
  if (raw.includes('.mp4') && !raw.includes('.m3u8')) return raw
  const u = new URL('/api/video/stream', window.location.origin)
  u.searchParams.set('url', raw)
  return u.toString()
}

/** Merge same title across sources (like video-master search) */
export function mergeVodLists(existing: VodItem[], incoming: VodItem[]): VodItem[] {
  const next = [...existing]
  for (const item of incoming) {
    const found = next.find((e) => e.vod_name === item.vod_name && (e.vod_en === item.vod_en || !e.vod_en || !item.vod_en))
    if (found) {
      found.playSources = [...(found.playSources || []), ...(item.playSources || [])]
      found.typeUrl = [...(found.typeUrl || []), ...(item.typeUrl || [])]
    } else {
      next.push(item)
    }
  }
  return next
}
