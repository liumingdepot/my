/**
 * 红果站源（参考 guoapp provider_hongguo 网页链路）
 * 站点: https://hongguoduanju.com
 */

const BASE = 'https://hongguoduanju.com'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const PLAYBACK_API = 'https://djapi.999888456.xyz/api/hongguo/play'

export type HongguoListItem = {
  id: string
  image_link: string
  title: string
  sub_title: string
  total_num: string
  hot_value?: string
}

export type HongguoEpisode = {
  video_id: string
  sort: string
  title: string
  video_url: string
  video_h265_url?: string
  duration: string
  first_img: string
}

export type HongguoDetail = {
  playlet_id: string
  image_link: string
  intro: string
  tags: string
  title: string
  total_episode_num: string
  is_over?: string
  play_list: HongguoEpisode[]
}

export type HongguoPlayResult = {
  url: string
  referer: string
  quality?: string
  variants?: string[]
}

function mapString(obj: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!obj) return ''
  for (const key of keys) {
    const v = obj[key]
    if (v == null || v === '') continue
    return String(v).trim()
  }
  return ''
}

function anyList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    for (const key of ['list', 'items', 'data']) {
      if (Array.isArray(o[key])) return o[key] as unknown[]
    }
  }
  return []
}

function nestedMap(v: unknown, ...keys: string[]): Record<string, unknown> | null {
  let cur: unknown = v
  for (const key of keys) {
    if (!cur || typeof cur !== 'object') return null
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur && typeof cur === 'object' && !Array.isArray(cur)
    ? (cur as Record<string, unknown>)
    : null
}

function parseRouterData(raw: string): Record<string, unknown> | null {
  const m = raw.match(/(?:window\.)?_ROUTER_DATA\s*=\s*/)
  if (!m || m.index == null) return null
  const start = m.index + m[0].length
  try {
    // JSON 对象截取到匹配大括号结束
    let depth = 0
    let inStr = false
    let escape = false
    let end = -1
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i]!
      if (inStr) {
        if (escape) escape = false
        else if (ch === '\\') escape = true
        else if (ch === '"') inStr = false
        continue
      }
      if (ch === '"') {
        inStr = true
        continue
      }
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
    if (end < 0) return null
    return JSON.parse(raw.slice(start, end)) as Record<string, unknown>
  } catch {
    return null
  }
}

function routerLoaderMap(data: Record<string, unknown> | null, ...names: string[]) {
  const loader = nestedMap(data, 'loaderData') || {}
  for (const name of names) {
    const page = loader[name]
    if (page && typeof page === 'object') return page as Record<string, unknown>
  }
  const prefixNames = names.map((n) => n.replace(/\$$/, '')).filter(Boolean)
  for (const [key, value] of Object.entries(loader)) {
    if (prefixNames.some((p) => key.startsWith(p)) && value && typeof value === 'object') {
      return value as Record<string, unknown>
    }
  }
  return null
}

async function fetchText(url: string, referer = `${BASE}/`) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      Referer: referer,
    },
  })
  if (!res.ok) throw new Error(`红果页面 HTTP ${res.status}`)
  const text = await res.text()
  if (text.length > 4 << 20) throw new Error('红果页面过大')
  return text
}

function dramaFromAny(v: unknown, category = '短剧'): HongguoListItem | null {
  if (!v || typeof v !== 'object') return null
  const m = v as Record<string, unknown>
  const vd =
    m.video_data && typeof m.video_data === 'object'
      ? (m.video_data as Record<string, unknown>)
      : m
  const sourceId = mapString(vd, 'series_id_str', 'series_id') || mapString(m, 'series_id_str', 'series_id')
  if (!/^[0-9]{1,32}$/.test(sourceId)) return null

  const title =
    mapString(vd, 'series_title', 'series_name', 'title') ||
    mapString(m, 'series_name', 'name') ||
    sourceId
  const cover = mapString(vd, 'series_cover', 'cover') || mapString(m, 'series_cover')
  const count = mapString(vd, 'episode_cnt') || mapString(m, 'episode_cnt')
  const intro = mapString(vd, 'series_intro', 'video_desc') || mapString(m, 'series_intro')

  return {
    id: sourceId,
    image_link: cover.startsWith('//') ? `https:${cover}` : cover,
    title,
    sub_title: intro.slice(0, 60) || category,
    total_num: count,
    hot_value: mapString(vd, 'series_play_cnt', 'play_cnt') || undefined,
  }
}

function decodeMaybeBase64Url(value: string): string {
  const text = value.trim()
  if (/^https?:\/\//i.test(text)) return text
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const decoded = new TextDecoder().decode(bytes).trim()
    if (/^https?:\/\//i.test(decoded)) return decoded
  } catch {
    /* ignore */
  }
  return ''
}

function mediaAddresses(info: Record<string, unknown> | null): string[] {
  if (!info) return []
  const out: string[] = []
  const seen = new Set<string>()
  const add = (value: unknown) => {
    if (typeof value === 'string') {
      const address = decodeMaybeBase64Url(value) || (/^https?:\/\//i.test(value.trim()) ? value.trim() : '')
      if (address && address.length <= 8192 && !seen.has(address)) {
        seen.add(address)
        out.push(address)
      }
      return
    }
    if (Array.isArray(value)) value.forEach(add)
  }
  for (const key of ['main_url', 'backup_url', 'backup_url_1', 'backup_url_2', 'backup_urls', 'url_list']) {
    add(info[key])
  }
  return out
}

export async function hongguoSearch(keyword: string, page = 1) {
  const q = keyword.trim()
  if (!q || q.length > 80) throw new Error('请输入 1 至 80 个字符的搜索词')

  const body = await fetchText(`${BASE}/search/${encodeURIComponent(q)}`)
  const data = parseRouterData(body)
  const pageData = routerLoaderMap(data, 'search_(keyword)/page', 'search_')
  if (!pageData || pageData.isSuccess !== true) {
    throw new Error('红果搜索未返回有效结果')
  }

  const rows = anyList(pageData.searchList)
  const list: HongguoListItem[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const drama = dramaFromAny(row)
    if (!drama || seen.has(drama.id)) continue
    if (!nestedMap(row, 'video_data') && !(row as Record<string, unknown>).video_data) continue
    seen.add(drama.id)
    list.push(drama)
  }

  // 网页搜索通常一页；page>1 返回空表示没有更多
  if (page > 1) {
    return { list: [] as HongguoListItem[], total: list.length, page, total_pages: 1, next_page: null }
  }

  const total = Number(mapString(pageData, 'totalCount')) || list.length
  return {
    list,
    total,
    page: 1,
    total_pages: 1,
    next_page: null as number | null,
  }
}

export async function hongguoCatalog(opts: { page?: number; category?: string }) {
  const page = Math.max(1, Math.floor(opts.page || 1))
  const routeMap: Record<string, string> = {
    '': 'real-drama',
    real: 'real-drama',
    comic: 'comic-drama',
    ai: 'ai-drama',
    anime: 'comic',
  }
  const route = routeMap[opts.category || ''] || 'real-drama'
  const body = await fetchText(`${BASE}/category/${route}?page=${page}`)
  const data = parseRouterData(body)
  const pageData = routerLoaderMap(data, 'category_page', 'category_')
  if (!pageData || pageData.isSuccess === false) {
    throw new Error('红果分类数据不可用')
  }

  const items = anyList(pageData.recommendList)
  const list: HongguoListItem[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const drama = dramaFromAny(item, route)
    if (!drama || seen.has(drama.id)) continue
    seen.add(drama.id)
    list.push(drama)
  }

  const pagination = nestedMap(pageData, 'pagination')
  const totalPages = Math.max(1, Number(mapString(pagination, 'totalPages')) || page)
  return {
    list,
    total: list.length,
    page,
    total_pages: Math.min(totalPages, 500),
    next_page: page < totalPages ? page + 1 : null,
  }
}

export async function hongguoCategories() {
  return [
    { id: '', name: '真人剧' },
    { id: 'comic', name: '漫剧' },
    { id: 'ai', name: 'AI剧' },
    { id: 'anime', name: '动漫' },
  ]
}

export async function hongguoDetail(seriesId: string): Promise<HongguoDetail> {
  const id = seriesId.trim()
  if (!/^[0-9]{1,32}$/.test(id)) throw new Error('红果剧集 ID 无效')

  const body = await fetchText(`${BASE}/detail?series_id=${encodeURIComponent(id)}`)
  const data = parseRouterData(body)
  const page = routerLoaderMap(data, 'detail_page', 'detail_')
  const detail = nestedMap(page, 'seriesDetail')
  if (!detail) throw new Error('红果详情为空')

  const title = mapString(detail, 'series_name', 'series_title', 'name') || id
  const cover = mapString(detail, 'series_cover', 'cover')
  const intro = mapString(detail, 'series_intro', 'video_desc', 'intro')
  const tags = mapString(detail, 'tags', 'category_name')
  const count = mapString(detail, 'episode_cnt', 'total_episode')
  const vids = anyList(detail.vid_list)

  const play_list: HongguoEpisode[] = []
  vids.forEach((v, i) => {
    const vid = String(v ?? '').trim()
    if (!vid || vid === '<nil>' || !/^[0-9]{1,32}$/.test(vid)) return
    const idx = i + 1
    play_list.push({
      video_id: vid,
      sort: String(idx),
      title: `第${idx}集`,
      video_url: '',
      duration: '',
      first_img: cover.startsWith('//') ? `https:${cover}` : cover,
    })
  })

  if (!play_list.length) throw new Error('红果详情没有返回剧集 ID')

  return {
    playlet_id: id,
    title,
    image_link: cover.startsWith('//') ? `https:${cover}` : cover,
    intro,
    tags,
    total_episode_num: count || String(play_list.length),
    is_over: mapString(detail, 'series_status') === '1' ? '1' : mapString(detail, 'series_status') === '0' ? '0' : undefined,
    play_list,
  }
}

async function playFromPage(seriesId: string, videoId: string): Promise<HongguoPlayResult> {
  const pageURL = `${BASE}/player/${encodeURIComponent(seriesId)}/${encodeURIComponent(videoId)}`
  const body = await fetchText(pageURL)
  const page = routerLoaderMap(parseRouterData(body), 'player_', 'player_page')
  if (!page) throw new Error('红果播放页数据不可用')
  if (mapString(page, 'vid') !== videoId || mapString(page, 'series_id') !== seriesId) {
    throw new Error('红果未返回所请求的剧集，可能仅允许网页试看')
  }
  const info = nestedMap(page, 'video_player_info')
  const addresses = mediaAddresses(info)
  if (!addresses.length) throw new Error('红果该集未提供公开播放地址')

  // CDN（qznovelvod 等）校验 Referer，网页域与 novel.snssdk.com 均可；优先后者
  return {
    url: addresses[0]!,
    referer: 'https://novel.snssdk.com/',
    variants: addresses,
  }
}

async function playFromBackupApi(seriesId: string, videoId: string): Promise<HongguoPlayResult> {
  const reference = {
    content_type: 1004,
    series_id: seriesId,
    vid: videoId,
    video_platform: 3,
    from_video_id: '',
  }
  const id = Buffer.from(JSON.stringify(reference)).toString('base64')
  const url = `${PLAYBACK_API}?id=${encodeURIComponent(id)}`
  const text = await fetchText(url, `${BASE}/`)
  let decoded = text.trim()
  if (decoded.startsWith('v2.')) {
    // 加密响应：本页先跳过复杂解密，提示换网页取流
    throw new Error('红果备用接口返回加密数据，请优先使用网页播放链路')
  }
  let json: Record<string, unknown>
  try {
    json = JSON.parse(decoded) as Record<string, unknown>
  } catch {
    throw new Error('红果备用播放接口返回无效数据')
  }
  const keyUrls = Array.isArray(json.key_urls) ? json.key_urls : []
  const urls: string[] = []
  for (const option of keyUrls) {
    if (!option || typeof option !== 'object') continue
    const src = mapString(option as Record<string, unknown>, 'src')
    if (/^https?:\/\//i.test(src)) urls.push(src)
  }
  if (!urls.length) throw new Error('红果备用接口未返回可用媒体地址')
  return { url: urls[0]!, referer: 'https://novel.snssdk.com/', variants: urls }
}

export async function hongguoPlay(seriesId: string, videoId: string): Promise<HongguoPlayResult> {
  if (!/^[0-9]{1,32}$/.test(seriesId) || !/^[0-9]{1,32}$/.test(videoId)) {
    throw new Error('红果播放请求缺少有效 ID')
  }
  try {
    return await playFromPage(seriesId, videoId)
  } catch (pageErr) {
    try {
      return await playFromBackupApi(seriesId, videoId)
    } catch (apiErr) {
      const a = pageErr instanceof Error ? pageErr.message : '网页取流失败'
      const b = apiErr instanceof Error ? apiErr.message : '备用取流失败'
      throw new Error(`红果取流失败：${a}；${b}`)
    }
  }
}
