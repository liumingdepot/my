/**
 * 优酷弹幕解析器：搜索 / 分集 / mtop 签名拉取弹幕。
 * 流程参考 TVBox 类优酷 Parser：处理加密签名后提取弹幕数据。
 */

import { createHash } from 'node:crypto'

export type DanmakuSearchItem = {
  showId: string
  title: string
  pic: string
  type: string
  year: number | null
  episodeCount: number
  /** 正片 / 解说 等，便于前端展示 */
  kind?: string
}

export type DanmakuPart = {
  vid: string
  title: string
  episodeIndex: number
  link: string
}

export type DanmakuComment = {
  time: number
  mode: number
  color: number
  text: string
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
const CLIENT_ID = '53e6cc67237fc59a'
const APP_KEY = '24679788'
const DANMU_SIGN_KEY = 'MkmC9SoIw6xCkSKHhJ7b5D2r51kBiREr'
const SEGMENT_STEP = 60
const CONCURRENCY = 8

type YoukuRawDanmu = {
  playat?: number
  content?: string
  propertis?: string
}

type MtopTokens = { tk: string; tkEnc: string }

let useFallbackCna = false
let fallbackCna: string | null = null

function md5Hex(text: string) {
  return createHash('md5').update(text, 'utf8').digest('hex')
}

function generateLocalCna() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let cna = ''
  for (const byte of bytes) cna += chars[byte % chars.length]!
  return cna
}

function getFallbackCna() {
  if (!fallbackCna) fallbackCna = generateLocalCna()
  return fallbackCna
}

function getSetCookie(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie().join(';')
  }
  return headers.get('set-cookie') || ''
}

function buildQueryString(params: Record<string, string | number>) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
}

function utf8ToLatin1(str: string) {
  let result = ''
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i)
    if (code > 255) result += encodeURIComponent(str[i]!)
    else result += str[i]!
  }
  return result
}

function base64Encode(input: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let output = ''
  let buffer = 0
  let bufferLength = 0
  for (let i = 0; i < input.length; i += 1) {
    buffer = (buffer << 8) | input.charCodeAt(i)
    bufferLength += 8
    while (bufferLength >= 6) {
      output += chars[(buffer >> (bufferLength - 6)) & 0x3f]!
      bufferLength -= 6
    }
  }
  if (bufferLength > 0) output += chars[(buffer << (6 - bufferLength)) & 0x3f]!
  while (output.length % 4 !== 0) output += '='
  return output
}

function extractVideoId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  if (raw.includes('youku.com/video?vid')) {
    const m = raw.match(/[?&]vid=([^&]+)/)
    if (m?.[1]) return decodeURIComponent(m[1])
  }

  const idMatch = raw.match(/id_([^./?#]+)/)
  if (idMatch?.[1]) return idMatch[1]

  if (/^[A-Za-z0-9_=-]+$/.test(raw) && raw.length >= 8) return raw
  return null
}

function cleanTitle(title: string) {
  return title
    .replace(/<[^>]+>/g, '')
    .replace(/【.+?】/g, '')
    .replace(/[《》]/g, '')
    .trim()
    .replace(/:/g, '：')
}

function detectMediaType(cats: string, feature: string) {
  const c = (cats || '').toLowerCase()
  const f = (feature || '').toLowerCase()
  if (c.includes('综艺') || c.includes('variety') || f.includes('综艺')) return '综艺'
  if (c.includes('电影') || c.includes('movie') || f.includes('电影')) return '电影'
  if (c.includes('动漫') || c.includes('anime') || f.includes('动漫')) return '动漫'
  if (c.includes('电视剧') || c.includes('drama') || f.includes('电视剧')) return '电视剧'
  return '电视剧'
}

function formatEpisodeTitle(
  ep: { displayName?: string; title?: string; published?: string },
  episodeIndex: number,
  mediaType: string,
) {
  let name = (ep.displayName || ep.title || '').trim()
  name = name
    .replace(
      /^(?:\d{2,4}-\d{2}-\d{2}|\d{2}-\d{2})\s*(?=(?:第\d+期))|^(?:\d{2,4}-\d{2}-\d{2}|\d{2}-\d{2})\s*:\s*/,
      '',
    )
    .trim()

  if (mediaType === '电影') return name || `第${episodeIndex}集`
  if (mediaType === '综艺') {
    const period = name.match(/第(\d+)期/)
    const date = ep.published?.split(' ')[0] ?? ''
    if (period) return `第${period[1]}期 ${date} ${name}`.trim()
    return `第${episodeIndex}期 ${date} ${name}`.trim()
  }
  if (/^第\d+集/.test(name)) return name
  return `第${episodeIndex}集 ${name}`.trim()
}

type YoukuSearchComponent = {
  commonData?: Record<string, unknown>
  componentMap?: Record<
    string,
    { componentId?: string; data?: unknown }
  >
}

const HARD_SKIP = ['中配版', '抢先看', '非正片', '无障碍']
const SOFT_SKIP = ['解读', '揭秘', '赏析', '解说', '解析', '剧情']

/** 去掉集数/清晰度等噪音，提高优酷搜索命中 */
export function normalizeDanmakuKeyword(raw: string) {
  let q = raw.trim()
  if (!q) return ''
  q = q
    .replace(/第\s*\d+\s*[集期话]/g, ' ')
    .replace(/\b(?:EP|E|S\d+E)\s*\d+\b/gi, ' ')
    .replace(/\b\d{1,3}\s*集\b/g, ' ')
    .replace(
      /\b(?:4K|1080[Pp]|720[Pp]|HD|BD|蓝光|高清|超清|国语|粤语|中字|完整版)\b/gi,
      ' ',
    )
    .replace(/[_\-|[\]【】()（）]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return q || raw.trim()
}

function classifyTitle(title: string): 'hard' | 'soft' | 'ok' {
  if (HARD_SKIP.some((kw) => title.includes(kw))) return 'hard'
  if (SOFT_SKIP.some((kw) => title.includes(kw))) return 'soft'
  if (/^《/.test(title) && /[》]/.test(title)) return 'soft'
  return 'ok'
}

function pickShowCard(component: YoukuSearchComponent): Record<string, unknown> | null {
  const common = component.commonData
  if (common && typeof common === 'object') {
    const titleDTO = common.titleDTO as { displayName?: string } | undefined
    if (titleDTO?.displayName && common.showId) return common
  }
  const map = component.componentMap || {}
  for (const node of Object.values(map)) {
    if (node?.componentId !== 'H5ShowCard') continue
    const data = node.data
    if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
      return data[0] as Record<string, unknown>
    }
  }
  return null
}

function toSearchItem(card: Record<string, unknown>): (DanmakuSearchItem & { tier: number }) | null {
  const titleDTO = card.titleDTO as { displayName?: string } | undefined
  const title = titleDTO?.displayName || ''
  const showId = String(card.showId || '').trim()
  if (!title || !showId) return null

  const isYouku = Number(card.isYouku) === 1 || Number(card.hasYouku) === 1
  if (!isYouku) return null

  const grade = classifyTitle(title)
  if (grade === 'hard') return null

  const feature = String(card.feature || '')
  const cats = String(card.cats || '')
  const poster = card.posterDTO as { vThumbUrl?: string } | undefined
  const yearMatch = feature.match(/[12][890][0-9]{2}/)
  const kind = grade === 'soft' ? '解说' : '正片'

  return {
    showId,
    title: cleanTitle(title),
    pic: poster?.vThumbUrl || '',
    type: detectMediaType(cats, feature),
    year: yearMatch ? Number(yearMatch[0]) : null,
    episodeCount: Number(card.episodeTotal) || 0,
    kind,
    tier: grade === 'ok' ? 0 : 1,
  }
}

function collectSearchItems(pageComponentList: unknown[]): DanmakuSearchItem[] {
  const primary: (DanmakuSearchItem & { tier: number })[] = []
  const fallback: (DanmakuSearchItem & { tier: number })[] = []
  const seen = new Set<string>()

  for (const component of pageComponentList) {
    const card = pickShowCard(component as YoukuSearchComponent)
    if (!card) continue
    const item = toSearchItem(card)
    if (!item || seen.has(item.showId)) continue
    seen.add(item.showId)
    if (item.tier === 0) primary.push(item)
    else fallback.push(item)
  }

  const picked = primary.length > 0 ? primary : fallback
  return picked.map(({ tier: _t, ...rest }) => rest)
}

async function requestYoukuSearch(keyword: string, page: number) {
  const url =
    `https://search.youku.com/api/search?keyword=${encodeURIComponent(keyword)}` +
    `&userAgent=${encodeURIComponent(UA)}&site=1&categories=0&ftype=0&ob=0&pg=${page}`
  return fetchJson<{ pageComponentList?: unknown[] }>(url)
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      Referer: 'https://www.youku.com/',
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`upstream ${res.status}`)
  return (await res.json()) as T
}

async function resolveCna(): Promise<string> {
  if (useFallbackCna) return getFallbackCna()
  try {
    const res = await fetch('https://log.mmstat.com/eg.js', {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(8_000),
      redirect: 'manual',
    })
    const etag = res.headers.get('etag') || res.headers.get('Etag')
    if (etag?.trim()) return etag.replace(/^"|"$/g, '')
  } catch {
    // mmstat 常被拦截，走本地兜底
  }
  useFallbackCna = true
  return getFallbackCna()
}

async function fetchMtopTokens(): Promise<MtopTokens> {
  const res = await fetch(
    `https://acs.youku.com/h5/mtop.com.youku.aplatform.weakget/1.0/?jsv=2.5.1&appKey=${APP_KEY}`,
    {
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      redirect: 'manual',
    },
  )
  const cookie = getSetCookie(res)
  const tk = cookie.match(/_m_h5_tk=([^;]+)/)?.[1]
  const tkEnc = cookie.match(/_m_h5_tk_enc=([^;]+)/)?.[1]
  if (!tk || !tkEnc) throw new Error('优酷签名 token 获取失败')
  return { tk, tkEnc }
}

type SegmentReq = {
  url: string
  data: string
  tk: string
  tkEnc: string
}

function buildSegmentRequest(opts: {
  videoId: string
  mat: number
  cna: string
  tokens: MtopTokens
}): SegmentReq {
  const msg: Record<string, unknown> = {
    ctime: Date.now(),
    ctype: 10004,
    cver: 'v1.0',
    guid: opts.cna,
    mat: opts.mat,
    mcount: 1,
    pid: 0,
    sver: '3.1.0',
    type: 1,
    vid: opts.videoId,
  }
  const msgB64 = base64Encode(utf8ToLatin1(JSON.stringify(msg)))
  msg.msg = msgB64
  msg.sign = md5Hex(`${msgB64}${DANMU_SIGN_KEY}`)

  const data = JSON.stringify(msg)
  const t = Date.now()
  const sign = md5Hex([opts.tokens.tk.slice(0, 32), t, APP_KEY, data].join('&'))
  const params = {
    jsv: '2.5.6',
    appKey: APP_KEY,
    t,
    sign,
    api: 'mopen.youku.danmu.list',
    v: '1.0',
    type: 'originaljson',
    dataType: 'jsonp',
    timeout: '20000',
    jsonpIncPrefix: 'utility',
  }
  return {
    url: `https://acs.youku.com/h5/mopen.youku.danmu.list/1.0/?${buildQueryString(params)}`,
    data,
    tk: opts.tokens.tk,
    tkEnc: opts.tokens.tkEnc,
  }
}

async function fetchSegmentComments(seg: SegmentReq): Promise<YoukuRawDanmu[]> {
  const body = buildQueryString({ data: seg.data })
  const res = await fetch(seg.url, {
    method: 'POST',
    headers: {
      Cookie: `_m_h5_tk=${seg.tk};_m_h5_tk_enc=${seg.tkEnc};`,
      Referer: 'https://v.youku.com',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body,
    signal: AbortSignal.timeout(20_000),
    redirect: 'manual',
  })
  if (!res.ok) return []
  const json = (await res.json()) as {
    data?: { result?: string }
  }
  if (!json.data?.result) return []
  try {
    const parsed = JSON.parse(json.data.result) as {
      code?: string
      data?: { result?: YoukuRawDanmu[] }
    }
    if (parsed.code === '-1') return []
    return parsed.data?.result || []
  } catch {
    return []
  }
}

function formatComments(raw: YoukuRawDanmu[]): DanmakuComment[] {
  const list: DanmakuComment[] = []
  for (const item of raw) {
    const text = (item.content || '').trim()
    if (!text) continue
    const time = Number(item.playat) / 1000
    if (!Number.isFinite(time) || time < 0) continue

    let color = 0xffffff
    let mode = 1
    if (item.propertis) {
      try {
        const prop = JSON.parse(item.propertis) as { color?: string | number; pos?: number }
        if (prop.color != null) {
          color = typeof prop.color === 'string' ? parseInt(prop.color, 10) : Number(prop.color)
          if (!Number.isFinite(color)) color = 0xffffff
        }
        if (prop.pos === 1) mode = 5
        else if (prop.pos === 2) mode = 4
      } catch {
        // ignore
      }
    }
    list.push({ time, mode, color, text: text.slice(0, 80) })
  }
  list.sort((a, b) => a.time - b.time)
  return list
}

export async function searchDanmakuSources(options: {
  keyword: string
  page?: number
}): Promise<{ list: DanmakuSearchItem[]; page: number; pageCount: number; total: number }> {
  const raw = options.keyword.trim()
  if (!raw) throw new Error('请输入关键词')

  const page = Math.max(1, Math.floor(options.page ?? 1))
  const normalized = normalizeDanmakuKeyword(raw)
  const tries = normalized && normalized !== raw ? [normalized, raw] : [raw]

  let list: DanmakuSearchItem[] = []
  for (const keyword of tries) {
    const data = await requestYoukuSearch(keyword, page)
    list = collectSearchItems(data.pageComponentList || [])
    if (list.length) break
  }

  return {
    list,
    page,
    pageCount: list.length ? page : 0,
    total: list.length,
  }
}

async function fetchEpisodesPage(showId: string, page: number, pageSize: number) {
  const url =
    `https://openapi.youku.com/v2/shows/videos.json?client_id=${CLIENT_ID}` +
    `&package=com.huawei.hwvplayer.youku&ext=show&show_id=${encodeURIComponent(showId)}` +
    `&page=${page}&count=${pageSize}`
  return fetchJson<{
    total?: number
    videos?: Array<{
      id?: string
      title?: string
      displayName?: string
      link?: string
      published?: string
    }>
  }>(url)
}

export async function fetchDanmakuParts(options: {
  showId: string
  mediaType?: string
}): Promise<{
  showId: string
  pages: DanmakuPart[]
}> {
  const showId = options.showId.trim()
  if (!showId) throw new Error('无效 showId')

  const pageSize = 100
  const first = await fetchEpisodesPage(showId, 1, pageSize)
  const videos = [...(first.videos || [])]
  const total = Number(first.total) || videos.length

  if (total > pageSize) {
    const pages = Math.ceil(total / pageSize)
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) => fetchEpisodesPage(showId, i + 2, pageSize)),
    )
    for (const page of rest) {
      if (page.videos?.length) videos.push(...page.videos)
    }
  }

  const mediaType = options.mediaType || '电视剧'
  const pages: DanmakuPart[] = []
  for (let i = 0; i < videos.length; i += 1) {
    const ep = videos[i]!
    const vid = (ep.id || '').trim()
    if (!vid) continue
    const episodeIndex = i + 1
    pages.push({
      vid,
      title: formatEpisodeTitle(ep, episodeIndex, mediaType),
      episodeIndex,
      link: ep.link || `https://v.youku.com/v_show/id_${vid}.html`,
    })
  }

  return { showId, pages }
}

export async function fetchDanmakuComments(options: {
  vid?: string
  url?: string
}): Promise<DanmakuComment[]> {
  const videoId = extractVideoId(options.vid || options.url || '')
  if (!videoId) throw new Error('无效优酷视频 id')

  const info = await fetchJson<{ title?: string; duration?: string | number }>(
    `https://openapi.youku.com/v2/videos/show.json?client_id=${CLIENT_ID}` +
      `&video_id=${encodeURIComponent(videoId)}&package=com.huawei.hwvplayer.youku&ext=show`,
  )
  const duration = Number(info.duration)
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('无法获取视频时长')

  const [cna, tokens] = await Promise.all([resolveCna(), fetchMtopTokens()])
  const maxMat = Math.floor(duration / SEGMENT_STEP) + 1
  const segments = Array.from({ length: maxMat }, (_, mat) =>
    buildSegmentRequest({ videoId, mat, cna, tokens }),
  )

  const raw: YoukuRawDanmu[] = []
  for (let i = 0; i < segments.length; i += CONCURRENCY) {
    const batch = segments.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(batch.map((seg) => fetchSegmentComments(seg)))
    for (const item of settled) {
      if (item.status === 'fulfilled' && item.value.length) raw.push(...item.value)
    }
  }

  const comments = formatComments(raw)
  if (!comments.length) throw new Error('该分集暂无弹幕')
  return comments
}
