import type { QqTitle, VodItem } from './types'

/** 归一化片名：去空白/标点/常见噪声，便于精确比对 */
export function normalizeTitle(name: string) {
  return name
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[·•・．.。，,、:：;；!！?？"'“”‘’（）()【】\[\]《》<>～~—\-_|｜/／\\]/g, '')
    .replace(/(第.+季|第.+部|剧场版|普通话|国语|粤语|中字|完整版|高清|蓝光)$/g, '')
}

function extractYear(raw: string) {
  const m = String(raw || '').match(/(19|20)\d{2}/)
  return m ? m[0] : ''
}

/**
 * 评分越高越像目标片：
 * 精确名 100；前缀/包含递减；年份一致 +25；有可播线路 +5
 */
export function scoreVodMatch(query: string, year: string, item: VodItem) {
  const q = normalizeTitle(query)
  const n = normalizeTitle(item.vod_name || '')
  if (!q || !n) return 0

  let score = 0
  if (q === n) score = 100
  else if (n.startsWith(q) || q.startsWith(n)) score = 72
  else if (n.includes(q) || q.includes(n)) score = 48
  else return 0

  const wantYear = extractYear(year)
  const gotYear = extractYear(item.vod_year || '')
  if (wantYear && gotYear) {
    if (wantYear === gotYear) score += 25
    else score -= 15
  }

  if (item.playSources?.some((s) => s.episodes.length)) score += 5
  return score
}

/** 自动跳转阈值：精确名(≥100)，或前缀相近且年份一致(≈97) */
export const AUTO_MATCH_MIN = 95

export function pickBestMatch(query: string, year: string, list: VodItem[]): VodItem | null {
  let best: VodItem | null = null
  let bestScore = 0
  for (const item of list) {
    const s = scoreVodMatch(query, year, item)
    if (s > bestScore) {
      bestScore = s
      best = item
    }
  }
  if (!best || bestScore < AUTO_MATCH_MIN) return null
  return best
}

/** 腾讯片库 → 站内智能匹配（带 auto） */
export function matchPath(item: Pick<QqTitle, 'title' | 'year' | 'cid'>) {
  const params = new URLSearchParams()
  params.set('q', item.title.trim())
  params.set('auto', '1')
  const year = extractYear(item.year || '')
  if (year) params.set('year', year)
  if (item.cid?.trim()) params.set('cid', item.cid.trim())
  return `/video/search?${params.toString()}`
}
