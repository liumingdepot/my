/**
 * 爱奇艺弹幕：搜索 / 分集 / cmts bullet 分段拉取（brotli + XML/proto）
 */

import { createHash } from 'node:crypto'
import { brotliDecompressSync } from 'node:zlib'
import {
  UA,
  clampComment,
  cleanTitle,
  sortComments,
  type DanmakuComment,
  type DanmakuPart,
  type DanmakuSearchItem,
} from './types.js'

/** 爱奇艺 API 签名相关常量 */
const XOR_KEY = 0x75706971676c
const SECRET_KEY = 'howcuteitis'
const KEY_NAME = 'secret_key'

const SEARCH_URL = 'https://mesh.if.iqiyi.com/portal/lw/search/homePageV3'
const BASE_INFO_URL = 'https://www.iqiyi.com/prelw/tvg/v2/lw/base_info'
const MOVIE_BASE_INFO_URL = 'https://mesh.if.iqiyi.com/tvg/v2/lw/base_info'
const DECODE_URL = 'https://pcw-api.iq.com/api/decode/'
const VIDEO_INFO_URL = 'https://pcw-api.iqiyi.com/video/video/baseinfo/'
const BULLET_URL = 'https://cmts.iqiyi.com/bullet/'

/** 弹幕分片按 60 秒切片，URL 带 md5 校验后缀 */
const SEGMENT_DURATION = 60
const CONCURRENCY = 8

const IQIYI_HEADERS = {
  Origin: 'https://www.iqiyi.com',
  Referer: 'https://www.iqiyi.com/',
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function md5Hex(text: string) {
  return createHash('md5').update(text, 'utf8').digest('hex')
}

function buildQueryString(params: Record<string, string>) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

/** 参数按 key 排序拼接后附加 secret_key，取 md5 大写 */
function createSign(params: Record<string, string>) {
  const keys = Object.keys(params)
    .filter((k) => k !== 'sign')
    .sort()
  const paramString = keys.map((k) => `${k}=${params[k] ?? ''}`).join('&')
  return md5Hex(`${paramString}&${KEY_NAME}=${SECRET_KEY}`).toUpperCase()
}

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json', ...(headers || {}) },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

// =====================
// 搜索
// =====================

type IqiyiSearchResponse = {
  code?: string | number
  data?: {
    templates?: Array<{
      template?: number
      intentAlbumInfos?: unknown[]
      albumInfo?: unknown
    }>
  }
}

type IqiyiAlbum = {
  title?: string
  btnText?: string
  channel?: string
  qipuId?: string | number
  playQipuId?: string | number
  pageUrl?: string
  img?: string
  imgH?: string
  superscript?: string
  year?: { value?: string; name?: string }
  subscriptContent?: string
  videos?: unknown[]
  metaTags?: Array<{ name?: string }>
  baseTags?: Array<{ value?: string }>
}

function filterAlbum(album: unknown): DanmakuSearchItem | null {
  const info = album as IqiyiAlbum
  if (!info?.title) return null

  // 过滤外站付费播放
  if (info.btnText === '外站付费播放') return null

  // 提取媒体类型
  const channel = info.channel || ''
  let type: string
  if (channel.includes('电影')) type = '电影'
  else if (channel.includes('动漫')) type = '动漫'
  else if (channel.includes('综艺')) type = '综艺'
  else if (channel.includes('纪录片')) type = '纪录片'
  else if (channel.includes('电视剧')) type = '电视剧'
  else return null

  // 提取 3D 与 2D 属性标签并追加至媒体类型
  let is3D = false
  let is2D = false
  for (const tag of info.metaTags || []) {
    if (tag?.name === '3D') is3D = true
    if (tag?.name === '2D') is2D = true
  }
  for (const tag of info.baseTags || []) {
    if (tag?.value === '3D') is3D = true
    if (tag?.value === '2D') is2D = true
  }
  if (is3D) type = `3D${type}`
  else if (is2D) type = `2D${type}`

  // 年份：普通结果卡片在 year 字段，意图聚合卡片无 year 字段，年份在 superscript 角标
  const yearStr = (info.year && (info.year.value || info.year.name)) || info.superscript
  const year =
    typeof yearStr === 'string' && /^\d{4}$/.test(yearStr) ? Number(yearStr) : null
  const title = cleanTitle(info.title)
  const pic = info.img || info.imgH || ''

  // 电影类型：使用 qipuId 作为 mediaId
  if (type.includes('电影')) {
    const qipuId = info.qipuId ?? info.playQipuId
    if (qipuId == null) return null
    return {
      platform: 'iqiyi',
      id: `movie_${qipuId}`,
      title,
      pic,
      type,
      year,
      episodeCount: 1,
      kind: '正片',
    }
  }

  // 非电影类型：从 pageUrl 提取 link_id
  const linkIdMatch = info.pageUrl?.match(/v_(\w+?)\.html/)
  if (!linkIdMatch?.[1]) return null

  // 提取分集数
  let episodeCount = 0
  if (Array.isArray(info.videos) && info.videos.length > 0) {
    episodeCount = info.videos.length
  } else if (info.subscriptContent) {
    const countMatch = info.subscriptContent.match(/(?:更新至|全|共)\s*(\d+)\s*(?:集|话|期)/)
    if (countMatch) episodeCount = Number(countMatch[1])
    else {
      const simpleMatch = info.subscriptContent.trim().match(/^(\d+)$/)
      if (simpleMatch) episodeCount = Number(simpleMatch[1])
    }
  }

  return {
    platform: 'iqiyi',
    id: linkIdMatch[1],
    title,
    pic,
    type,
    year,
    episodeCount,
    kind: '正片',
  }
}

export async function searchIqiyi(keyword: string): Promise<DanmakuSearchItem[]> {
  const q = keyword.trim()
  if (!q) return []

  const params: Record<string, string> = {
    key: q,
    current_page: '1',
    mode: '1',
    source: 'input',
    suggest: '',
    pcv: '13.074.22699',
    version: '13.074.22699',
    pageNum: '1',
    pageSize: '25',
    pu: '',
    u: 'f6440fc5d919dca1aea12b6aff56e1c7',
    scale: '200',
    token: '',
    userVip: '0',
    conduit: '',
    vipType: '-1',
    os: '',
    osShortName: 'win10',
    dataType: '',
    appMode: '',
    ad: JSON.stringify({ lm: 3, azd: 1000000000951, azt: 733, position: 'feed' }),
    adExt: JSON.stringify({ r: '2.1.5-ares6-pure' }),
  }
  const baseUrl = `${SEARCH_URL}?${buildQueryString(params)}`

  // 搜索接口风控时延迟重试，最多重试两次
  let data = await fetchJson<IqiyiSearchResponse>(baseUrl, IQIYI_HEADERS)
  for (let attempt = 0; attempt < 2 && (!data || String(data.code) === '-1'); attempt++) {
    await sleep(3000)
    data = await fetchJson<IqiyiSearchResponse>(`${baseUrl}&_retry=${attempt + 1}`, IQIYI_HEADERS)
  }

  if (!data || String(data.code) === '-1' || !Array.isArray(data.data?.templates)) return []

  const results: DanmakuSearchItem[] = []
  const seen = new Set<string>()
  for (const template of data.data!.templates!) {
    let albums: unknown[] = []

    // 优先处理意图卡片 (template 112)
    if (template.template === 112 && template.intentAlbumInfos) {
      albums = template.intentAlbumInfos
    }
    // 然后处理普通结果卡片
    else if ([101, 102, 103].includes(template.template || 0) && template.albumInfo) {
      albums = [template.albumInfo]
    }

    for (const album of albums) {
      const item = filterAlbum(album)
      if (!item || seen.has(item.id)) continue
      seen.add(item.id)
      results.push(item)
    }
  }
  return results
}

// =====================
// 分集
// =====================

type BaseInfoResponse = {
  status_code?: number
  data?: {
    template?: {
      tabs?: Array<{
        blocks?: unknown[]
      }>
    }
  }
}

type EpisodeData = {
  content_type?: number
  play_url?: string
  short_display_name?: string
  title?: string
  subtitle?: string
  album_order?: number
  page_url?: string
}

type EpisodeEntry = { id: string; title: string; order: number; link: string }

function isBaseInfoValid(data: BaseInfoResponse | null): data is BaseInfoResponse {
  return (
    !!data &&
    data.status_code === 0 &&
    !!data.data &&
    !!data.data.template &&
    Array.isArray(data.data.template.tabs)
  )
}

/** 将 video_id 转换为 entity_id：36 进制解码后与 XOR_KEY 异或 */
function videoIdToEntityId(videoId: string): string | null {
  const s = videoId.trim().toLowerCase()
  let end = 0
  while (end < s.length && /[0-9a-z]/.test(s[end]!)) end += 1
  if (end === 0) return null

  let base36 = 0n
  for (let i = 0; i < end; i += 1) {
    base36 = base36 * 36n + BigInt(parseInt(s[i]!, 36))
  }
  const xorResult = base36 ^ BigInt(XOR_KEY)
  const finalResult = xorResult < 900000n ? 100n * (xorResult + 900000n) : xorResult
  return finalResult.toString()
}

async function fetchBaseInfo(entityId: string): Promise<BaseInfoResponse | null> {
  const base: Record<string, string> = {
    entity_id: entityId,
    device_id: 'qd5fwuaj4hunxxdgzwkcqmefeb3ww5hx',
    auth_cookie: '',
    user_id: '0',
    vip_type: '-1',
    vip_status: '0',
    conduit_id: '',
    pcv: '13.082.22866',
    app_version: '13.082.22866',
    ext: '',
    app_mode: 'standard',
    scale: '100',
    src: 'pca_tvg',
    os: '',
    ad_ext: '{"r":"2.2.0-ares6-pure"}',
  }
  const buildUrl = () => {
    const params = { ...base, timestamp: String(Date.now()) }
    params.sign = createSign(params)
    return `${BASE_INFO_URL}?${buildQueryString(params)}`
  }

  // base_info 接口可能返回空响应或结构残缺的响应，最多重试两次
  let data = await fetchJson<BaseInfoResponse>(buildUrl(), IQIYI_HEADERS)
  for (let attempt = 0; attempt < 2 && !isBaseInfoValid(data); attempt++) {
    await sleep(3000)
    data = await fetchJson<BaseInfoResponse>(buildUrl(), IQIYI_HEADERS)
  }
  return isBaseInfoValid(data) ? data : null
}

async function fetchMovieVideoId(qipuId: string): Promise<string | null> {
  const base: Record<string, string> = {
    entity_id: qipuId,
    device_id: 'qd5fwuaj4hunxxdgzwkcqmefeb3ww5hx',
    auth_cookie: '',
    user_id: '0',
    vip_type: '-1',
    vip_status: '0',
    conduit_id: '',
    pcv: '13.103.23529',
    app_version: '13.103.23529',
    ext: '',
    app_mode: 'standard',
    scale: '125',
    src: 'pca_tvg',
    os: '',
    ad_ext: '{"r":"2.5.0-ares6-pure"}',
  }
  const params = { ...base, timestamp: String(Date.now()) }
  params.sign = createSign(params)
  const url = `${MOVIE_BASE_INFO_URL}?${buildQueryString(params)}`

  const data = await fetchJson<{ data?: { base_data?: { share_url?: string; page_url?: string } } }>(
    url,
    IQIYI_HEADERS,
  )
  const baseData = data?.data?.base_data
  for (const raw of [baseData?.share_url, baseData?.page_url]) {
    const match = raw?.match(/v_(\w+)\.html/)
    if (match?.[1]) return match[1]
  }
  // 响应中未找到 v_xxx 格式视频ID，回退使用 entity_id
  return qipuId
}

function addEpisode(
  ep: EpisodeData,
  episodes: EpisodeEntry[],
  seen: Set<string>,
) {
  // 只处理正片内容 (content_type === 1)
  if (ep.content_type !== 1) return
  const tvidMatch = (ep.play_url || '').match(/tvid=(\d+)/)
  if (!tvidMatch?.[1]) return
  const tvid = tvidMatch[1]
  if (seen.has(tvid)) return

  let title = ep.short_display_name || ep.title || '未知分集'
  if (ep.subtitle && !title.includes(ep.subtitle)) title = `${title} ${ep.subtitle}`

  const link = ep.page_url || ''
  if (!link) return

  seen.add(tvid)
  episodes.push({ id: tvid, title, order: ep.album_order ?? episodes.length, link })
}

async function extractEpisodesFromBlocks(blocks: unknown[]): Promise<EpisodeEntry[]> {
  const episodes: EpisodeEntry[] = []
  const seen = new Set<string>()

  for (const block of blocks) {
    const b = block as { bk_type?: string; tag?: unknown; data?: { data?: unknown } }

    // 新版 API：video_list 类型的分集数据块
    if (b.bk_type === 'video_list' && b.data?.data) {
      // 检查是否是分集选择器块
      if (!b.tag || !String(b.tag).includes('episodes')) continue

      const dataGroups = b.data.data
      if (!Array.isArray(dataGroups)) continue
      for (const group of dataGroups) {
        const videos = (group as { videos?: unknown })?.videos
        if (!Array.isArray(videos)) continue
        for (const videoGroup of videos) {
          const data = (videoGroup as { data?: unknown })?.data
          if (!Array.isArray(data)) continue
          for (const ep of data) addEpisode(ep as EpisodeData, episodes, seen)
        }
      }
    }
    // 兼容旧版 API：album_episodes 类型
    else if (b.bk_type === 'album_episodes' && b.data?.data) {
      const groups = b.data.data
      if (!Array.isArray(groups)) continue
      for (const group of groups) {
        let videosData: unknown = (group as { videos?: unknown })?.videos

        // 分季数据是 URL 时需额外请求
        if (typeof videosData === 'string') {
          const season = await fetchJson<unknown>(videosData)
          videosData = season
        }
        if (!videosData || typeof videosData !== 'object') continue

        const paged = (videosData as { feature_paged?: unknown }).feature_paged
        if (!paged) continue
        const pages = Array.isArray(paged) ? paged : Object.values(paged)
        for (const page of pages) {
          if (!Array.isArray(page)) continue
          for (const ep of page) addEpisode(ep as EpisodeData, episodes, seen)
        }
      }
    }
  }
  return episodes
}

export async function fetchIqiyiParts(id: string): Promise<DanmakuPart[]> {
  const rawId = id.trim()
  if (!rawId) return []

  // 电影类型：调用 base_info API 获取视频ID
  if (rawId.startsWith('movie_')) {
    const qipuId = rawId.slice('movie_'.length)
    const videoId = await fetchMovieVideoId(qipuId)
    if (!videoId) return []
    return [
      {
        id: videoId,
        title: '正片',
        episodeIndex: 1,
        link: `https://www.iqiyi.com/v_${videoId}.html`,
      },
    ]
  }

  // 将 video_id 转换为 entity_id
  const entityId = /^\d+$/.test(rawId) ? rawId : videoIdToEntityId(rawId)
  if (!entityId) return []

  const data = await fetchBaseInfo(entityId)
  if (!data) return []

  const tabs = data.data!.template!.tabs!
  if (!tabs.length) return []

  const episodes = await extractEpisodesFromBlocks(tabs[0]!.blocks || [])
  episodes.sort((a, b) => a.order - b.order)

  return episodes.map((ep, i) => ({
    id: ep.id,
    title: ep.title || `第${i + 1}集`,
    episodeIndex: ep.order || i + 1,
    link: ep.link,
  }))
}

// =====================
// 弹幕
// =====================

type RawDanmu = { content: string; showTime: string; color: string }

/** tvid 解码：link_id → 数字 tvid */
async function decodeTvid(linkId: string): Promise<string | null> {
  const url = `${DECODE_URL}${encodeURIComponent(linkId)}?platformId=3&modeCode=intl&langCode=sg`
  const data = await fetchJson<{ data?: string | number }>(url)
  if (data?.data == null) return null
  return String(data.data)
}

async function fetchVideoInfo(tvid: string) {
  return fetchJson<{ data?: { durationSec?: string | number; displayBarrage?: boolean } }>(
    `${VIDEO_INFO_URL}${tvid}`,
  )
}

/** 当前分片 URL：https://cmts.iqiyi.com/bullet/{xx}/{yy}/{tvid}_60_{pageNo}_{sign}.br */
function buildBulletUrl(tvid: string, bulletPath: string, pageNo: number) {
  const sign = md5Hex(`${tvid}_${SEGMENT_DURATION}_${pageNo}cbzuw1259a`).slice(-8)
  return `${BULLET_URL}${bulletPath}/${tvid}_${SEGMENT_DURATION}_${pageNo}_${sign}.br`
}

function parseXmlDanmu(xml: string): RawDanmu[] {
  const extract = (tag: string) => {
    const reg = new RegExp(`<${tag}>(.*?)</${tag}>`, 'g')
    return xml.match(reg)?.map((x) => x.substring(tag.length + 2, x.length - tag.length - 3)) || []
  }

  const contents = extract('content')
  const showTime = extract('showTime')
  const color = extract('color')
  return contents.map((content, i) => ({
    content,
    showTime: showTime[i] || '',
    color: color[i] || 'ffffff',
  }))
}

type ProtoField = {
  number: number
  wireType: number
  value?: string
  bytes?: Uint8Array
}

function readVarint(bytes: Uint8Array, offset: number): { value: bigint; offset: number } {
  let value = 0n
  let shift = 0n
  let pos = offset

  while (pos < bytes.length) {
    const byte = bytes[pos]!
    pos += 1
    value |= BigInt(byte & 0x7f) << shift
    if ((byte & 0x80) === 0) {
      return { value, offset: pos }
    }
    shift += 7n
  }
  throw new Error('爱奇艺弹幕 protobuf varint 不完整')
}

function parseProtoFields(bytes: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = []
  let offset = 0

  while (offset < bytes.length) {
    const keyResult = readVarint(bytes, offset)
    const key = keyResult.value
    offset = keyResult.offset

    const number = Number(key >> 3n)
    const wireType = Number(key & 7n)
    if (number === 0) break

    if (wireType === 0) {
      const valueResult = readVarint(bytes, offset)
      fields.push({ number, wireType, value: valueResult.value.toString() })
      offset = valueResult.offset
    } else if (wireType === 1) {
      fields.push({ number, wireType })
      offset += 8
    } else if (wireType === 2) {
      const lengthResult = readVarint(bytes, offset)
      const length = Number(lengthResult.value)
      offset = lengthResult.offset
      const end = offset + length
      if (end > bytes.length) break

      const raw = bytes.subarray(offset, end)
      fields.push({ number, wireType, bytes: raw, value: new TextDecoder().decode(raw) })
      offset = end
    } else if (wireType === 5) {
      fields.push({ number, wireType })
      offset += 4
    } else {
      break
    }
  }
  return fields
}

function getProtoString(fields: ProtoField[], number: number): string {
  return fields.find((field) => field.number === number)?.value || ''
}

function parseProtoDanmu(bytes: Uint8Array): RawDanmu[] {
  const contents: RawDanmu[] = []
  const fields = parseProtoFields(bytes)

  for (const field of fields) {
    if (field.number !== 6 || !field.bytes) continue

    const danmuBlock = parseProtoFields(field.bytes)
    const blockShowTime = getProtoString(danmuBlock, 1)

    for (const itemField of danmuBlock) {
      if (itemField.number !== 2 || !itemField.bytes) continue

      const item = parseProtoFields(itemField.bytes)
      const content = getProtoString(item, 2)
      if (!content) continue

      contents.push({
        content,
        showTime: getProtoString(item, 6) || blockShowTime || '0',
        color: getProtoString(item, 8) || 'ffffff',
      })
    }
  }
  return contents
}

async function fetchSegmentComments(tvid: string, bulletPath: string, pageNo: number) {
  const url = buildBulletUrl(tvid, bulletPath, pageNo)
  const res = await fetch(url, {
    headers: {
      'Accept-Encoding': 'br',
      'Content-Type': 'application/octet-stream',
      'User-Agent': UA,
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return []

  const compressed = Buffer.from(await res.arrayBuffer())
  if (!compressed.length) return []

  // brotli 解压；若运行环境已自动解压则直接使用原始字节
  let payload: Buffer
  try {
    payload = brotliDecompressSync(compressed)
  } catch {
    payload = compressed
  }

  // 首字节为 60 ('<') 时是 XML，否则是 protobuf
  if (payload[0] === 60) {
    return parseXmlDanmu(new TextDecoder().decode(payload))
  }
  return parseProtoDanmu(payload)
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeHtmlEntities(text: string): string {
  if (!text.includes('&')) return text
  return text.replace(/&(#x?[\da-fA-F]+|\w+);/g, (match, entity: string) => {
    let code: number
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      code = parseInt(entity.slice(2), 16)
    } else if (entity.startsWith('#')) {
      code = parseInt(entity.slice(1), 10)
    } else {
      return NAMED_ENTITIES[entity] ?? match
    }
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match
    try {
      return String.fromCodePoint(code)
    } catch {
      return match
    }
  })
}

function toComment(raw: RawDanmu): DanmakuComment | null {
  const time = parseFloat(raw.showTime)
  if (!Number.isFinite(time) || time < 0) return null
  return clampComment({
    time,
    mode: 1,
    color: parseInt(raw.color, 16) || 0xffffff,
    text: decodeHtmlEntities(raw.content),
  })
}

export async function fetchIqiyiComments(idOrUrl: string): Promise<DanmakuComment[]> {
  try {
    let raw = idOrUrl.trim()
    if (!raw) return []
    if (raw.startsWith('movie_')) raw = raw.slice('movie_'.length)

    // 支持传入视频页 URL / v_xxx link_id / 数字 tvid
    const linkId = raw.match(/v_(\w+)/)?.[1]
    let tvid: string | null = /^\d+$/.test(raw) ? raw : null
    let originalId: string | null = null

    if (!tvid) {
      const candidate = linkId || raw
      originalId = candidate
      tvid = await decodeTvid(candidate)
    }
    if (!tvid) return []

    // 视频基础信息：时长与弹幕开关
    let info = await fetchVideoInfo(tvid)
    let duration = Number(info?.data?.durationSec) || 0
    if (info?.data?.displayBarrage === false) return []

    // decode 后 tvid 无效时，用原始 tvid 重试
    if (!duration && originalId && originalId !== tvid) {
      const retryInfo = await fetchVideoInfo(originalId)
      const retryDuration = Number(retryInfo?.data?.durationSec) || 0
      if (retryDuration > 0) {
        tvid = originalId
        duration = retryDuration
        info = retryInfo
      }
    }
    if (!duration) return []

    const segmentCount = Math.ceil(duration / SEGMENT_DURATION)
    const paddedTvid = `0000${tvid}`
    const bulletPath = `${paddedTvid.slice(-4, -2)}/${paddedTvid.slice(-2)}`

    const list: DanmakuComment[] = []
    for (let i = 0; i < segmentCount; i += CONCURRENCY) {
      const batch: Array<Promise<RawDanmu[]>> = []
      for (let j = i; j < Math.min(i + CONCURRENCY, segmentCount); j += 1) {
        batch.push(fetchSegmentComments(tvid, bulletPath, j + 1))
      }
      const settled = await Promise.allSettled(batch)
      for (const item of settled) {
        if (item.status !== 'fulfilled') continue
        for (const raw of item.value) {
          const comment = toComment(raw)
          if (comment) list.push(comment)
        }
      }
    }
    return sortComments(list)
  } catch {
    return []
  }
}
