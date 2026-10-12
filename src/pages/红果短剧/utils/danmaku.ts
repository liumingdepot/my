/**
 * 红果原生弹幕客户端 — 对接 /api/hongguo/danmaku
 * 数据格式与视频页 DanmakuComment 对齐，便于复用渲染层。
 */

export type DanmakuComment = {
  time: number
  mode: number
  color: number
  text: string
}

type OkEnvelope<T> = { ok: true; data: T }
type ErrEnvelope = { ok: false; error?: string }

export async function fetchHongguoDanmaku(
  opts: {
    seriesId: string
    videoId: string
    duration?: string | number
  },
  signal?: AbortSignal,
): Promise<{ list: DanmakuComment[]; count: number }> {
  const q = new URLSearchParams({
    series_id: opts.seriesId,
    video_id: opts.videoId,
  })
  if (opts.duration != null && String(opts.duration).trim()) {
    q.set('duration', String(opts.duration).trim())
  }
  const res = await fetch(`/api/hongguo/danmaku?${q}`, signal ? { signal } : undefined)
  const body = (await res.json()) as (OkEnvelope<{ list: DanmakuComment[]; count: number }> | ErrEnvelope) & {
    error?: string
  }
  if (!res.ok || !('ok' in body) || !body.ok) {
    throw new Error(body.error || `弹幕请求失败 (${res.status})`)
  }
  return body.data
}

export function colorToCss(color: number) {
  const n = color >>> 0
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgb(${r},${g},${b})`
}
