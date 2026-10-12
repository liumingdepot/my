/**
 * B 站弹幕：复用教育模块搜索/详情，拉取 XML 弹幕
 */

import { searchBiliVideos } from '../../education/bili.js'
import { fetchEducationDetail } from '../../education/play.js'
import { biliHeaders, buildBiliCookie, UA, REFERER } from '../../education/biliAuth.js'
import {
  cleanTitle,
  clampComment,
  sortComments,
  type DanmakuComment,
  type DanmakuPart,
  type DanmakuSearchItem,
} from './types.js'

function biliAdminCookie() {
  return (process.env.BILI_COOKIE || '').trim()
}

function decodeXmlEntities(text: string) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
}

function parseDanmakuXml(xml: string): DanmakuComment[] {
  const list: DanmakuComment[] = []
  const re = /<d\s+p="([^"]*)"[^>]*>([\s\S]*?)<\/d>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const attrs = m[1]!.split(',')
    const c = clampComment({
      time: Number(attrs[0]),
      mode: Number(attrs[1]) || 1,
      color: Number(attrs[3]) || 0xffffff,
      text: decodeXmlEntities(m[2] || ''),
    })
    if (c) list.push(c)
  }
  return sortComments(list)
}

export async function searchBilibili(keyword: string): Promise<DanmakuSearchItem[]> {
  const q = keyword.trim()
  if (!q) return []
  try {
    const cookie = biliAdminCookie()
    const result = await searchBiliVideos({ keyword: q, page: 1 }, cookie)
    return result.items.slice(0, 20).map((item) => ({
      platform: 'bilibili' as const,
      id: item.bvid,
      title: cleanTitle(item.title),
      pic: item.pic.startsWith('//') ? `https:${item.pic}` : item.pic,
      type: '视频',
      year: null,
      episodeCount: 0,
      kind: '正片',
    }))
  } catch {
    return []
  }
}

export async function fetchBilibiliParts(bvid: string): Promise<DanmakuPart[]> {
  const id = bvid.trim()
  if (!/^BV[a-zA-Z0-9]{10}$/i.test(id)) return []
  try {
    const cookie = biliAdminCookie()
    const detail = await fetchEducationDetail({ bvid: id, adminCookie: cookie })
    return (detail.pages || []).map((p) => ({
      id: String(p.cid),
      title: cleanTitle(p.part) || `P${p.page}`,
      episodeIndex: p.page,
      link: `https://www.bilibili.com/video/${id}?p=${p.page}`,
    }))
  } catch {
    return []
  }
}

export async function fetchBilibiliComments(cidRaw: string): Promise<DanmakuComment[]> {
  const cid = Math.floor(Number(cidRaw))
  if (!Number.isFinite(cid) || cid <= 0) return []

  const cookie = await buildBiliCookie(biliAdminCookie())
  const headers = {
    ...biliHeaders(cookie),
    Accept: '*/*',
    'Accept-Encoding': 'identity',
    'User-Agent': UA,
    Referer: REFERER,
  }

  const urls = [
    `https://comment.bilibili.com/${cid}.xml`,
    `https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) continue
      const xml = await res.text()
      if (!xml.includes('<d ')) continue
      const comments = parseDanmakuXml(xml)
      if (comments.length) return comments
    } catch {
      // try next
    }
  }
  return []
}
