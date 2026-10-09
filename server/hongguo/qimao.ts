/** 七猫短剧 API（xiaoqi.icofun.cn） */

const BASE = 'https://xiaoqi.icofun.cn/API/qimao_duanju.php'

export type DramaListItem = {
  id: number
  image_link: string
  title: string
  sub_title: string
  total_num: string
  hot_value?: string
  show_type?: number
  is_reservation?: number
}

export type DramaEpisode = {
  video_id: string
  video_url: string
  video_h265_url?: string
  duration: string
  first_img: string
  sort: string
  width?: number
  height?: number
  status?: number
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
  page: number
  total_pages: number
  next_page: number | null
}

type UpstreamBody = {
  data?: unknown
  errors?: { title?: string; details?: string; code?: string }
  api_source?: string
}

async function getUpstream(params: Record<string, string>) {
  const url = new URL(BASE)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
  })
  const body = (await res.json()) as UpstreamBody
  if (!res.ok) {
    throw new Error(body.errors?.details || body.errors?.title || `上游请求失败 (${res.status})`)
  }
  if (body.errors) {
    throw new Error(body.errors.details || body.errors.title || '上游返回错误')
  }
  return body.data
}

export async function searchByName(name: string, page = 1): Promise<DramaSearchResult> {
  const pageNum = Math.max(1, Math.floor(page) || 1)
  const data = (await getUpstream({ name, page: String(pageNum) })) as {
    is_list_have_results?: number
    list?: DramaListItem[]
    meta?: { total_pages?: number; next_page?: number }
  } | null

  const list = data && Array.isArray(data.list) ? data.list : []
  const total_pages = Math.max(1, Number(data?.meta?.total_pages) || 1)
  const nextRaw = data?.meta?.next_page
  const next_page =
    typeof nextRaw === 'number' && nextRaw > pageNum && nextRaw <= total_pages ? nextRaw : null

  return { list, page: pageNum, total_pages, next_page }
}

export async function fetchById(id: string): Promise<DramaDetail> {
  const data = (await getUpstream({ id })) as DramaDetail | null
  if (!data || !data.playlet_id) {
    throw new Error('未找到短剧详情')
  }
  if (!Array.isArray(data.play_list)) {
    data.play_list = []
  }
  return data
}

/** 首页 feed：随机分类 → 随机作品 → 随机一集 */
export const FEED_CATEGORY_NAMES = [
  '热门',
  '古装',
  '穿越',
  '重生',
  '逆袭',
  '战神',
  '神医',
  '豪门',
  '悬疑',
  '搞笑',
  '言情',
  '现代',
  '古代',
  '霸总',
  '萌宝',
  '总裁',
  '乡村',
  '年代',
  '玄幻',
  '科幻',
  '校园',
] as const

export type FeedItem = {
  category: string
  drama: {
    id: number
    playlet_id: string
    title: string
    image_link: string
    intro: string
    tags: string
    total_episode_num: string
  }
  episode: DramaEpisode
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

export async function fetchRandomFeedItem(excludeIds?: Set<string>): Promise<FeedItem> {
  const maxAttempts = 8
  let lastError: Error | null = null

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const category = pickOne([...FEED_CATEGORY_NAMES])
      const page = 1 + Math.floor(Math.random() * 3)
      const searched = await searchByName(category, page)
      if (!searched.list.length) continue

      const candidates = excludeIds?.size
        ? searched.list.filter((item) => !excludeIds.has(String(item.id)))
        : searched.list
      const pool = candidates.length ? candidates : searched.list
      const picked = pickOne(pool)
      const detail = await fetchById(String(picked.id))
      const eps = (detail.play_list || []).filter((ep) => ep.video_url || ep.video_h265_url)
      if (!eps.length) continue

      const episode = pickOne(eps)
      return {
        category,
        drama: {
          id: Number(detail.playlet_id) || picked.id,
          playlet_id: detail.playlet_id,
          title: detail.title || picked.title,
          image_link: detail.image_link || picked.image_link,
          intro: detail.intro || '',
          tags: detail.tags || '',
          total_episode_num: detail.total_episode_num || picked.total_num || '',
        },
        episode,
      }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('随机失败')
    }
  }

  throw lastError || new Error('暂无可用短剧')
}
