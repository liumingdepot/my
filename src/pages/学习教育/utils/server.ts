export type EducationClass = {
  typeName: string
  typeId: string
}

export type EducationFilterOption = {
  n: string
  v: string
}

export type EducationFilter = {
  key: string
  name: string
  value: EducationFilterOption[]
}

export type EducationSource = {
  id: string
  name: string
  sortOrder: number
  classes: EducationClass[]
  filter: Record<string, EducationFilter[]>
}

export type EducationVideo = {
  bvid: string
  aid: string
  title: string
  pic: string
  author: string
  duration: string
  play: number
  description: string
  url: string
}

export type EducationVideoList = {
  items: EducationVideo[]
  page: number
  pageSize: number
  total: number
  pageCount: number
}

export type EducationPagePart = {
  cid: number
  page: number
  part: string
  duration: number
}

export type EducationDetail = {
  bvid: string
  aid: number
  title: string
  pic: string
  desc: string
  author: string
  authorMid: number
  play: number
  danmaku: number
  like: number
  favorite: number
  coin: number
  pages: EducationPagePart[]
  url: string
}

export type EducationPlayResult = {
  title: string
  pic: string
  bvid: string
  author: string
  playableUrl: string
  quality: number
}

type SourcesResponse = { sources: EducationSource[]; error?: string }

export async function fetchEducationSources(signal?: AbortSignal): Promise<EducationSource[]> {
  const res = await fetch('/api/education/sources', signal ? { signal } : undefined)
  const data = (await res.json()) as SourcesResponse
  if (!res.ok) throw new Error(data.error || '教育源加载失败')
  return data.sources
}

export async function fetchEducationVideos(options: {
  sourceId: string
  typeId?: string
  keyword?: string
  q?: string
  page?: number
  duration?: number
  signal?: AbortSignal
}): Promise<EducationVideoList> {
  const params = new URLSearchParams()
  params.set('sourceId', options.sourceId)
  if (options.typeId?.trim()) params.set('typeId', options.typeId.trim())
  if (options.keyword?.trim()) params.set('keyword', options.keyword.trim())
  if (options.q?.trim()) params.set('q', options.q.trim())
  params.set('page', String(options.page ?? 1))
  params.set('duration', String(options.duration ?? 0))

  const res = await fetch(
    `/api/education/videos?${params}`,
    options.signal ? { signal: options.signal } : undefined,
  )
  const data = (await res.json()) as EducationVideoList & { error?: string }
  if (!res.ok) throw new Error(data.error || '视频列表加载失败')
  return data
}

export async function fetchEducationDetail(
  bvid: string,
  signal?: AbortSignal,
): Promise<EducationDetail> {
  const params = new URLSearchParams()
  params.set('bvid', bvid)
  const res = await fetch(
    `/api/education/detail?${params}`,
    signal ? { signal } : undefined,
  )
  const data = (await res.json()) as EducationDetail & { error?: string }
  if (!res.ok) throw new Error(data.error || '视频详情加载失败')
  if (!data.pages?.length) throw new Error(data.error || '缺少分集信息')
  return data
}

export async function fetchEducationPlay(options: {
  bvid: string
  cid?: number
  qn?: number
  signal?: AbortSignal
}): Promise<EducationPlayResult> {
  const params = new URLSearchParams()
  params.set('bvid', options.bvid)
  if (options.cid != null) params.set('cid', String(options.cid))
  if (options.qn != null) params.set('qn', String(options.qn))

  const res = await fetch(
    `/api/education/play?${params}`,
    options.signal ? { signal: options.signal } : undefined,
  )
  const data = (await res.json()) as EducationPlayResult & { error?: string }
  if (!res.ok) throw new Error(data.error || '视频解析失败')
  if (!data.playableUrl) throw new Error(data.error || '未获取到播放地址')
  return data
}

export function formatPlayCount(n: number) {
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿`
  if (n >= 10_000) return `${(n / 10_000).toFixed(n >= 100_000 ? 0 : 1)}万`
  return String(n)
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}
