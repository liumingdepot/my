export type DramaListItem = {
  id: number
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
}

export type DramaDetail = {
  playlet_id: string
  image_link: string
  intro: string
  tags: string
  title: string
  total_episode_num: string
  is_over?: string
  own_record_number?: string
  play_list: DramaEpisode[]
}

export type DramaSearchResult = {
  list: DramaListItem[]
  total: number
  page: number
  total_pages: number
  next_page: number | null
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

export async function searchDramas(name: string, page = 1, signal?: AbortSignal) {
  const q = new URLSearchParams({ name, page: String(Math.max(1, page || 1)) })
  const res = await fetch(`/api/test/search?${q}`, signal ? { signal } : undefined)
  return parseJson<DramaSearchResult>(res)
}

export async function fetchDramaDetail(id: string | number, signal?: AbortSignal) {
  const q = new URLSearchParams({ id: String(id) })
  const res = await fetch(`/api/test/detail?${q}`, signal ? { signal } : undefined)
  return parseJson<DramaDetail>(res)
}

export type FeedDrama = {
  id: number
  playlet_id: string
  title: string
  image_link: string
  intro: string
  tags: string
  total_episode_num: string
}

export type FeedItem = {
  category: string
  drama: FeedDrama
  episode: DramaEpisode
}

export type FeedResult = {
  list: FeedItem[]
}

/** 抖音式首页：随机分类 → 随机作品 → 随机一集 */
export async function fetchFeed(opts?: {
  count?: number
  exclude?: Array<string | number>
  signal?: AbortSignal
}) {
  const q = new URLSearchParams()
  if (opts?.count && opts.count > 1) q.set('count', String(opts.count))
  if (opts?.exclude?.length) q.set('exclude', opts.exclude.map(String).join(','))
  const qs = q.toString()
  const res = await fetch(`/api/test/feed${qs ? `?${qs}` : ''}`, opts?.signal ? { signal: opts.signal } : undefined)
  return parseJson<FeedResult>(res)
}
