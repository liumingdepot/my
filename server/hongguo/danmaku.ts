/**
 * 红果短剧原生弹幕。
 * 接口形态参考开源项目 huangxd-/danmu_api 的 sources/hongguo.js：
 * POST /novel/commentapi/comment/list/{vid}/v1/
 */

import { deviceInfo, fqPost, isValidId } from './fqapi.js'

export type HongguoDanmakuComment = {
  time: number
  mode: number
  color: number
  text: string
}

const COMMENT_SOURCE = 601
const SERVER_CHANNEL = 1000
const COMMENT_WINDOW_MS = 30_000
const COMMENT_COUNT = 90
const COMMENT_THROTTLE_MS = 180
const COMMENT_THROTTLE_JITTER_MS = 240

type RawCommentItem = {
  comment?: {
    comment_id?: string
    common?: { content?: { text?: string } }
    expand?: { offset_time?: number }
    stat?: { digg_count?: number }
  }
}

type CommentListData = {
  data_list?: RawCommentItem[]
  common_list_info?: { cursor?: string; has_more?: boolean }
  extra?: { next_query_danmaku_list_time?: number }
}

type ParsedDanmu = {
  commentId: string
  offsetMs: number
  text: string
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function throttleDelay() {
  return COMMENT_THROTTLE_MS + Math.floor(Math.random() * COMMENT_THROTTLE_JITTER_MS)
}

function parseDurationSec(raw: string | number | undefined): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw || '').trim())
  if (!Number.isFinite(n) || n <= 0) return 0
  // 网页字段偶发毫秒
  if (n > 10_000) return Math.round(n / 1000)
  return Math.round(n)
}

function parseDanmuList(data: CommentListData | null | undefined): ParsedDanmu[] {
  const out: ParsedDanmu[] = []
  for (const item of data?.data_list || []) {
    const comment = item.comment || {}
    const text = String(comment.common?.content?.text || '').trim()
    const offsetMs = Number(comment.expand?.offset_time)
    if (!text || !Number.isFinite(offsetMs)) continue
    out.push({
      commentId: String(comment.comment_id || ''),
      offsetMs: Math.max(0, Math.trunc(offsetMs)),
      text: text.slice(0, 80),
    })
  }
  return out
}

function dedupe(items: ParsedDanmu[]): ParsedDanmu[] {
  const seen = new Map<string, ParsedDanmu>()
  for (const item of items) {
    const key = item.commentId
      ? `id:${item.commentId}`
      : `anonymous:${item.offsetMs}:${item.text}`
    seen.set(key, item)
  }
  return [...seen.values()].sort(
    (a, b) =>
      a.offsetMs - b.offsetMs ||
      a.commentId.localeCompare(b.commentId) ||
      a.text.localeCompare(b.text),
  )
}

function toComments(items: ParsedDanmu[]): HongguoDanmakuComment[] {
  return items.map((item) => ({
    time: item.offsetMs / 1000,
    mode: 1,
    color: 0xffffff,
    text: item.text,
  }))
}

async function fetchCommentWindow(opts: {
  seriesId: string
  videoId: string
  durationSec: number
  startMs: number
  cursor: string
}): Promise<{
  comments: ParsedDanmu[]
  nextStart: number
  cursor: string
  hasMore: boolean
}> {
  const aid = Number(deviceInfo().aid) || 1967
  const path = `/novel/commentapi/comment/list/${encodeURIComponent(opts.videoId)}/v1/`
  const body = {
    comment_source: COMMENT_SOURCE,
    server_channel: SERVER_CHANNEL,
    group_id: opts.videoId,
    group_type: 30,
    comment_type: 20,
    sort: 1,
    business_param: {
      book_id: opts.seriesId,
      start_offset_time: Math.max(0, Math.trunc(opts.startMs)),
      playlet_item_duration: Math.max(0, Math.trunc(opts.durationSec * 1000)),
      need_danmaku_guide_type: [1, 3, 4, 2],
    },
    count: COMMENT_COUNT,
    cursor: String(opts.cursor || ''),
    aid,
    compliance_status: 0,
  }

  await sleep(throttleDelay())
  const data = await fqPost<CommentListData>(path, body, {
    emptyStub: true,
    extraHeaders: {
      'comment-source': String(COMMENT_SOURCE),
      'server-channel': String(SERVER_CHANNEL),
    },
  })

  const listInfo = data?.common_list_info || {}
  const extra = data?.extra || {}
  let nextStart = Number(extra.next_query_danmaku_list_time)
  if (!Number.isFinite(nextStart)) nextStart = opts.startMs + COMMENT_WINDOW_MS
  if (nextStart <= opts.startMs) nextStart = opts.startMs + COMMENT_WINDOW_MS

  return {
    comments: parseDanmuList(data),
    nextStart,
    cursor: String(listInfo.cursor || ''),
    hasMore: Boolean(listInfo.has_more),
  }
}

/**
 * 拉取单集弹幕（按 30s 窗口分页）。
 * seriesId = playlet_id / series_id；videoId = 分集 vid。
 */
export async function fetchHongguoDanmaku(options: {
  seriesId: string
  videoId: string
  duration?: string | number
}): Promise<{ list: HongguoDanmakuComment[]; count: number }> {
  const seriesId = String(options.seriesId || '').trim()
  const videoId = String(options.videoId || '').trim()
  if (!isValidId(seriesId)) throw new Error('无效 series_id')
  if (!isValidId(videoId)) throw new Error('无效 video_id')

  const durationSec = parseDurationSec(options.duration) || 600
  const durationMs = durationSec * 1000
  const comments: ParsedDanmu[] = []
  const seenMarkers = new Set<string>()
  let startMs = 0
  let cursor = ''
  const maxRequests = Math.max(1, Math.ceil(durationMs / COMMENT_WINDOW_MS) + 5)

  for (let i = 0; i < maxRequests; i += 1) {
    const marker = `${startMs}:${cursor}`
    if (seenMarkers.has(marker)) break
    seenMarkers.add(marker)

    const page = await fetchCommentWindow({
      seriesId,
      videoId,
      durationSec,
      startMs,
      cursor,
    })
    comments.push(...page.comments)
    if (page.nextStart >= durationMs) break
    if (!page.hasMore && !options.duration) break
    startMs = page.nextStart
    cursor = page.cursor
  }

  const list = toComments(dedupe(comments))
  return { list, count: list.length }
}
