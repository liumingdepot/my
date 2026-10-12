/**
 * 多源弹幕聚合：腾讯 / 爱奇艺 / 优酷 并行搜索，按平台取分集与弹幕。
 */

import { fetchBilibiliParts, fetchBilibiliComments } from './bilibili.js'
import { searchIqiyi, fetchIqiyiParts, fetchIqiyiComments } from './iqiyi.js'
import { searchTencent, fetchTencentParts, fetchTencentComments } from './tencent.js'
import { searchYouku, fetchYoukuParts, fetchYoukuComments } from './youku.js'
import {
  PLATFORM_LABEL,
  normalizeKeyword,
  type DanmakuComment,
  type DanmakuPart,
  type DanmakuPlatform,
  type DanmakuSearchItem,
} from './types.js'

export type {
  DanmakuComment,
  DanmakuPart,
  DanmakuPlatform,
  DanmakuSearchItem,
} from './types.js'

export { PLATFORM_LABEL, normalizeKeyword }

const PLATFORM_ORDER: DanmakuPlatform[] = ['tencent', 'iqiyi', 'youku']

function platformRank(p: DanmakuPlatform) {
  const i = PLATFORM_ORDER.indexOf(p)
  return i < 0 ? 99 : i
}

function kindRank(kind?: string) {
  return kind === '正片' || !kind ? 0 : 1
}

function titleScore(title: string, keyword: string) {
  const t = title.replace(/\s+/g, '').toLowerCase()
  const k = keyword.replace(/\s+/g, '').toLowerCase()
  if (!k) return 0
  if (t === k) return 100
  if (t.startsWith(k)) return 80
  if (t.includes(k)) return 60
  return 0
}

function sortSearchItems(list: DanmakuSearchItem[], keyword: string) {
  list.sort((a, b) => {
    const k = kindRank(a.kind) - kindRank(b.kind)
    if (k !== 0) return k
    const ts = titleScore(b.title, keyword) - titleScore(a.title, keyword)
    if (ts !== 0) return ts
    const ep = (b.episodeCount || 0) - (a.episodeCount || 0)
    if (ep !== 0) return ep
    return platformRank(a.platform) - platformRank(b.platform)
  })
  return list
}

export function parseEpisodeNumber(raw?: string) {
  if (!raw) return null
  const text = raw.trim()
  const patterns = [
    /第\s*(\d+)\s*[集期话]/,
    /\bEP?\s*(\d+)\b/i,
    /^(\d{1,3})$/,
    /(\d{1,3})\s*集/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return Number(m[1])
  }
  return null
}

async function settleSearch(
  platform: DanmakuPlatform,
  fn: () => Promise<DanmakuSearchItem[]>,
): Promise<DanmakuSearchItem[]> {
  try {
    const list = await fn()
    return Array.isArray(list) ? list : []
  } catch (err) {
    console.warn(`[danmaku] ${platform} search failed:`, err instanceof Error ? err.message : err)
    return []
  }
}

/** 腾讯 / 爱奇艺 / 优酷 并行搜索，正片优先、平台顺序次之 */
export async function searchDanmakuSources(options: {
  keyword: string
  page?: number
}): Promise<{ list: DanmakuSearchItem[]; page: number; pageCount: number; total: number }> {
  const raw = options.keyword.trim()
  if (!raw) throw new Error('请输入关键词')

  const keyword = normalizeKeyword(raw) || raw
  const page = Math.max(1, Math.floor(options.page ?? 1))

  const [tencent, iqiyi, youku] = await Promise.all([
    settleSearch('tencent', () => searchTencent(keyword)),
    settleSearch('iqiyi', () => searchIqiyi(keyword)),
    settleSearch('youku', () => searchYouku(keyword)),
  ])

  const merged = sortSearchItems([...tencent, ...iqiyi, ...youku], keyword)

  return {
    list: merged,
    page,
    pageCount: merged.length ? 1 : 0,
    total: merged.length,
  }
}

/** 按片名自动选最优源，并尽量匹配集数 */
export async function matchDanmakuSources(options: {
  keyword: string
  episode?: number | null
}): Promise<{
  item: DanmakuSearchItem
  part: DanmakuPart
  comments: DanmakuComment[]
}> {
  const keyword = normalizeKeyword(options.keyword) || options.keyword.trim()
  if (!keyword) throw new Error('请输入关键词')

  const { list } = await searchDanmakuSources({ keyword })
  if (!list.length) throw new Error('未找到可匹配的弹幕源')

  // 优先正片且有分集信息的源；B 站合集也可兜底
  const candidates = list.filter((x) => x.kind !== '解说').slice(0, 8)
  const pool = candidates.length ? candidates : list.slice(0, 8)
  const episode = options.episode && options.episode > 0 ? options.episode : null

  let lastError = ''
  for (const item of pool) {
    try {
      const { pages } = await fetchDanmakuParts({
        platform: item.platform,
        id: item.id,
        type: item.type,
      })
      if (!pages.length) {
        lastError = '无分集'
        continue
      }

      let part = pages[0]!
      if (episode != null) {
        const byIndex = pages.find((p) => p.episodeIndex === episode)
        const byTitle = pages.find((p) => parseEpisodeNumber(p.title) === episode)
        part = byIndex || byTitle || pages[Math.min(episode - 1, pages.length - 1)]!
      }

      const comments = await fetchDanmakuComments({
        platform: item.platform,
        id: part.id,
      })
      return { item, part, comments }
    } catch (err) {
      lastError = err instanceof Error ? err.message : '匹配失败'
    }
  }

  throw new Error(lastError || '自动匹配失败')
}

export async function fetchDanmakuParts(options: {
  platform: DanmakuPlatform
  id: string
  type?: string
}): Promise<{ platform: DanmakuPlatform; id: string; pages: DanmakuPart[] }> {
  const platform = options.platform
  const id = options.id.trim()
  if (!id) throw new Error('缺少 id')

  let pages: DanmakuPart[] = []
  switch (platform) {
    case 'tencent':
      pages = await fetchTencentParts(id)
      break
    case 'iqiyi':
      pages = await fetchIqiyiParts(id)
      break
    case 'bilibili':
      pages = await fetchBilibiliParts(id)
      break
    case 'youku':
      pages = await fetchYoukuParts(id, options.type || '')
      break
    default:
      throw new Error('未知平台')
  }

  if (!pages.length) throw new Error(`${PLATFORM_LABEL[platform]} 未找到分集`)
  return { platform, id, pages }
}

export async function fetchDanmakuComments(options: {
  platform: DanmakuPlatform
  id: string
}): Promise<DanmakuComment[]> {
  const platform = options.platform
  const id = options.id.trim()
  if (!id) throw new Error('缺少 id')

  let list: DanmakuComment[] = []
  switch (platform) {
    case 'tencent':
      list = await fetchTencentComments(id)
      break
    case 'iqiyi':
      list = await fetchIqiyiComments(id)
      break
    case 'bilibili':
      list = await fetchBilibiliComments(id)
      break
    case 'youku':
      list = await fetchYoukuComments(id)
      break
    default:
      throw new Error('未知平台')
  }

  if (!list.length) throw new Error('该分集暂无弹幕')
  return list
}
