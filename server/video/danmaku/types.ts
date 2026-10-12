export type DanmakuPlatform = 'tencent' | 'iqiyi' | 'bilibili' | 'youku'

export type DanmakuSearchItem = {
  platform: DanmakuPlatform
  id: string
  title: string
  pic: string
  type: string
  year: number | null
  episodeCount: number
  kind?: string
}

export type DanmakuPart = {
  id: string
  title: string
  episodeIndex: number
  link?: string
}

export type DanmakuComment = {
  time: number
  mode: number
  color: number
  text: string
}

export const PLATFORM_LABEL: Record<DanmakuPlatform, string> = {
  tencent: '腾讯',
  iqiyi: '爱奇艺',
  bilibili: 'B站',
  youku: '优酷',
}

export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export function normalizeKeyword(raw: string) {
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
    .replace(/[_\-|[\]【】()（）《》]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return q || raw.trim()
}

export function cleanTitle(title: string) {
  return title
    .replace(/<[^>]+>/g, '')
    .replace(/【.+?】/g, '')
    .replace(/[《》]/g, '')
    .replace(/<\/?em>/gi, '')
    .trim()
    .replace(/:/g, '：')
}

export function sortComments(list: DanmakuComment[]) {
  list.sort((a, b) => a.time - b.time)
  return list
}

export function clampComment(c: DanmakuComment): DanmakuComment | null {
  const text = (c.text || '').trim().slice(0, 80)
  if (!text || !Number.isFinite(c.time) || c.time < 0) return null
  return {
    time: c.time,
    mode: c.mode || 1,
    color: Number.isFinite(c.color) ? c.color : 0xffffff,
    text,
  }
}
