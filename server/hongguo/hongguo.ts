/**
 * 红果站源（参考 guoapp provider_hongguo 网页链路）
 * 站点: https://hongguoduanju.com
 *
 * 注意：公开网页只下发 accessible_episode_cnt 内的试看集（常见前 3 集），
 * 其后播放页返回 404；第三方备用接口目前也常返回空地址。
 */

import { createDecipheriv } from 'node:crypto'

const BASE = 'https://hongguoduanju.com'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const PLAYBACK_API = 'https://djapi.999888456.xyz/api/hongguo/play'

/** 与公开红果中转 v2 响应派生表一致 */
const V2_TABLE = [
  104, 64, 70, 166, 190, 168, 143, 130, 225, 254, 251, 217, 196, 34, 45, 60, 29, 20, 103, 105,
] as const

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
  /** false = 超出网页试看范围，公开链路无法取流 */
  playable?: boolean
}

export type HongguoDetail = {
  playlet_id: string
  image_link: string
  intro: string
  tags: string
  title: string
  total_episode_num: string
  /** 网页公开可播集数（试看） */
  accessible_episode_cnt?: number
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

function deriveV2Material(keyId: string): Buffer {
  const suffix = keyId.length > 4 ? keyId.slice(4) : ''
  if (!suffix || suffix.length % 2 || suffix.length > 1024 || !/^[0-9a-fA-F]+$/.test(suffix)) {
    throw new Error('红果响应密钥无效')
  }
  const raw = Buffer.from(suffix, 'hex')
  const output = Buffer.alloc(raw.length)
  for (let index = 0; index < raw.length; index++) {
    const current = raw[index]!
    const previous = index === 0 ? 109 : raw[index - 1]!
    const slot = index % V2_TABLE.length
    const salt = V2_TABLE[slot]! ^ ((90 + 13 * slot) & 0xff) ^ 85
    const shifted = (current + 215 - 11 * index) & 0xff
    const rotated = ((shifted << 3) | (shifted >> 5)) & 0xff
    output[index] = previous ^ salt ^ rotated
  }
  return output
}

/** 解密 djapi 返回的 v2.<keyId>.<ciphertext> 包体 */
function decryptV2Body(body: string): string {
  const text = body.trim()
  if (!text.startsWith('v2.')) return text
  const first = text.indexOf('.')
  const second = text.indexOf('.', first + 1)
  if (first < 0 || second < 0) throw new Error('红果加密响应无效')
  const material = deriveV2Material(text.slice(first + 1, second))
  if (material.length < 32) throw new Error('红果响应密钥无效')
  const ciphertext = Buffer.from(text.slice(second + 1), 'base64')
  if (!ciphertext.length || ciphertext.length % 16) throw new Error('红果加密响应无效')
  const decipher = createDecipheriv(
    'aes-128-cbc',
    material.subarray(0, 16),
    material.subarray(16, 32),
  )
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plain.toString('utf8')
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
  const accessibleRaw = Number(mapString(detail, 'accessible_episode_cnt'))
  const accessible =
    Number.isFinite(accessibleRaw) && accessibleRaw > 0 ? Math.floor(accessibleRaw) : 0
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
      // 有试看上限时，超出集数标记为不可播（前端置灰）
      playable: accessible > 0 ? idx <= accessible : undefined,
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
    accessible_episode_cnt: accessible || undefined,
    is_over: mapString(detail, 'series_status') === '1' ? '1' : mapString(detail, 'series_status') === '0' ? '0' : undefined,
    play_list,
  }
}

async function playFromPage(seriesId: string, videoId: string): Promise<HongguoPlayResult> {
  const pageURL = `${BASE}/player/${encodeURIComponent(seriesId)}/${encodeURIComponent(videoId)}`
  const res = await fetch(pageURL, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/json',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      Referer: `${BASE}/`,
    },
  })
  if (res.status === 404) {
    throw new Error('该集超出网页试看范围（红果公开站通常仅前几集可播）')
  }
  if (!res.ok) throw new Error(`红果页面 HTTP ${res.status}`)
  const body = await res.text()
  if (body.length > 4 << 20) throw new Error('红果页面过大')

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
  let decoded: string
  try {
    decoded = decryptV2Body(text)
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : '红果备用接口解密失败')
  }
  let json: Record<string, unknown>
  try {
    json = JSON.parse(decoded) as Record<string, unknown>
  } catch {
    throw new Error('红果备用播放接口返回无效数据')
  }

  const urls: string[] = []
  const keyUrls = Array.isArray(json.key_urls) ? json.key_urls : []
  for (const option of keyUrls) {
    if (!option || typeof option !== 'object') continue
    const src = mapString(option as Record<string, unknown>, 'src')
    if (/^https?:\/\//i.test(src)) urls.push(src)
  }
  const direct = mapString(json, 'url')
  if (/^https?:\/\//i.test(direct)) urls.unshift(direct)

  if (!urls.length) {
    throw new Error('备用接口未返回播放地址（该集可能未对公开链路开放）')
  }
  return { url: urls[0]!, referer: 'https://novel.snssdk.com/', variants: urls }
}

export async function hongguoPlay(seriesId: string, videoId: string): Promise<HongguoPlayResult> {
  if (!/^[0-9]{1,32}$/.test(seriesId) || !/^[0-9]{1,32}$/.test(videoId)) {
    throw new Error('红果播放请求缺少有效 ID')
  }
  try {
    return await playFromPage(seriesId, videoId)
  } catch (pageErr) {
    const pageMsg = pageErr instanceof Error ? pageErr.message : '网页取流失败'
    // 明确的试看限制不再徒劳打备用接口
    if (pageMsg.includes('试看')) throw pageErr instanceof Error ? pageErr : new Error(pageMsg)
    try {
      return await playFromBackupApi(seriesId, videoId)
    } catch (apiErr) {
      const b = apiErr instanceof Error ? apiErr.message : '备用取流失败'
      throw new Error(`红果取流失败：${pageMsg}；${b}`)
    }
  }
}
