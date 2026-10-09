/**
 * 红果短剧接口层 — 仅红果站源（source=hongguo）
 * 对接 /api/hongguo，不包含剧果 / 七猫
 */

export const SOURCE = 'hongguo' as const

export type Category = {
  id: string
  name: string
}

export type DramaListItem = {
  id: string | number
  image_link: string
  title: string
  sub_title: string
  total_num: string
  hot_value?: string
}

export type DramaEpisode = {
  video_id: string
  video_url: string
  video_h265_url?: string
  duration: string
  first_img: string
  sort: string
  title?: string
  playable?: boolean
}

export type DramaDetail = {
  playlet_id: string
  image_link: string
  intro: string
  tags: string
  title: string
  total_episode_num: string
  is_over?: string
  release_status?: string
  play_list: DramaEpisode[]
}

export type DramaSearchResult = {
  list: DramaListItem[]
  total: number
  page: number
  total_pages: number
  next_page: number | null
}

export type PlaybackPlan = {
  url: string
  referer?: string
  quality?: string
  proxy?: boolean
  originUrl?: string
  mediaType?: 'mp4' | 'hls'
  episode: DramaEpisode
  dramaId: string
  dramaTitle: string
}

type OkEnvelope<T> = { ok: true; data: T }
type ErrEnvelope = { ok: false; error?: string }

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as (OkEnvelope<T> | ErrEnvelope) & { error?: string }
  if (!res.ok || !('ok' in data) || !data.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`)
  }
  return data.data
}

export async function fetchCategories(signal?: AbortSignal) {
  const q = new URLSearchParams({ source: SOURCE })
  const res = await fetch(`/api/hongguo/categories?${q}`, signal ? { signal } : undefined)
  return parseJson<Category[]>(res)
}

/** 搜索；无关键词时返回目录 */
export async function searchDramas(
  name: string,
  page = 1,
  category = '',
  signal?: AbortSignal,
) {
  const q = new URLSearchParams({
    source: SOURCE,
    page: String(Math.max(1, page || 1)),
  })
  if (name.trim()) q.set('name', name.trim())
  if (category) q.set('category', category)
  const res = await fetch(`/api/hongguo/search?${q}`, signal ? { signal } : undefined)
  return parseJson<DramaSearchResult>(res)
}

export async function fetchDramaDetail(id: string | number, signal?: AbortSignal) {
  const q = new URLSearchParams({ source: SOURCE, id: String(id) })
  const res = await fetch(`/api/hongguo/detail?${q}`, signal ? { signal } : undefined)
  return parseJson<DramaDetail>(res)
}

export async function resolvePlay(dramaId: string, episodeId: string, signal?: AbortSignal) {
  const q = new URLSearchParams({
    source: SOURCE,
    drama_id: dramaId,
    episode_id: episodeId,
  })
  const res = await fetch(`/api/hongguo/play?${q}`, signal ? { signal } : undefined)
  return parseJson<{
    url: string
    referer?: string
    quality?: string
    proxy?: boolean
    originUrl?: string
    mediaType?: 'mp4' | 'hls'
    variants?: string[]
  }>(res)
}

export async function resolvePlayback(
  detail: DramaDetail,
  episode: DramaEpisode,
  signal?: AbortSignal,
): Promise<PlaybackPlan> {
  const play = await resolvePlay(detail.playlet_id, episode.video_id, signal)
  if (!play.url) throw new Error('该集暂无播放地址')
  const mediaType =
    play.mediaType ||
    (play.originUrl?.includes('.m3u8') || play.url.includes('.m3u8') ? 'hls' : 'mp4')
  return {
    url: play.url,
    referer: play.referer,
    quality: play.quality,
    proxy: play.proxy,
    originUrl: play.originUrl,
    mediaType,
    episode,
    dramaId: detail.playlet_id,
    dramaTitle: detail.title,
  }
}

export function sortEpisodes(list: DramaEpisode[]) {
  return [...list].sort((a, b) => Number(a.sort) - Number(b.sort))
}
