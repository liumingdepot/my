/**
 * B 站教育视频取流：APP iOS → TV → Web WBI 多线路，
 * 并提供带 Referer 的流媒体代理（支持 Range）。
 */

import {
  ANTI_CRAWL_MSG,
  AntiCrawlError,
  REFERER,
  UA,
  appSign,
  biliHeaders,
  buildBiliCookie,
  fetchBiliJson,
  getMixinKeyFromNav,
  signWbi,
} from './biliAuth.js'

export { ANTI_CRAWL_MSG, AntiCrawlError }

const ERROR_MAP: Record<string, string> = {
  '-400': '请求错误',
  '-403': '访问权限不足',
  '-404': '视频不存在',
  '-10403': '仅限港澳台地区',
  '62002': '视频不可见',
  '62004': '审核中',
}

const APP_KEYS = {
  ios: {
    appkey: 'YvirImLGlLANCLvM',
    appsec: 'JNlZNgfNGKZEpaDTkCdPQVXntXhuiJEM',
    platform: 'ios',
    ua: 'Bilibili/8.0.0 (bbcallen@gmail.com)',
  },
  tv: {
    appkey: '4409e2ce8ffd12b8',
    appsec: '59b43e04ad6965f34319062b478f83dd',
    platform: 'android',
    ua: 'Bilibili Freedoooooom/MOD',
  },
} as const

type PlayStream = { url: string; quality: number }

async function getPlayUrlWithFallback(
  bvid: string,
  cid: number,
  targetQn: number,
  cookie: string,
  mixinKey?: string,
): Promise<PlayStream> {
  const qualities = [targetQn, 80, 64, 32].filter(
    (v, i, a) => a.indexOf(v) === i && v <= targetQn,
  )

  let mixin_key = mixinKey
  let navAvailable = true
  if (mixin_key === undefined) {
    try {
      mixin_key = await getMixinKeyFromNav(cookie)
    } catch {
      navAvailable = false
    }
  }

  let lastError: string | null = null
  let sawAntiCrawl = false

  const tryAppLine = async (
    qn: number,
    conf: (typeof APP_KEYS)[keyof typeof APP_KEYS],
  ): Promise<PlayStream> => {
    const params = {
      bvid,
      cid: String(cid),
      qn: String(qn),
      fnval: '1',
      fnver: '0',
      fourk: '1',
      platform: conf.platform,
      ts: String(Math.floor(Date.now() / 1000)),
    }
    const signed = await appSign(params, conf.appkey, conf.appsec)
    const pData = await fetchBiliJson(`https://api.bilibili.com/x/player/playurl?${signed}`, {
      headers: { 'User-Agent': conf.ua },
    })
    const data = pData.data as { durl?: Array<{ url?: string }>; quality?: number } | undefined
    if (pData.code === 0 && data?.durl?.[0]?.url) {
      return { url: data.durl[0].url, quality: data.quality ?? qn }
    }
    throw new Error(pData.message || ERROR_MAP[String(pData.code)] || '取流失败')
  }

  const tryWebLine = async (qn: number): Promise<PlayStream> => {
    const signedQuery = await signWbi(
      { bvid, cid, qn, fnval: 1, try_look: 1, platform: 'html5', high_quality: 1 },
      cookie,
      mixin_key,
    )
    const pData = await fetchBiliJson(
      `https://api.bilibili.com/x/player/wbi/playurl?${signedQuery}`,
      { headers: biliHeaders(cookie) },
    )
    const data = pData.data as { durl?: Array<{ url?: string }>; quality?: number } | undefined
    if (pData.code === 0 && data?.durl?.[0]?.url) {
      return { url: data.durl[0].url, quality: data.quality ?? qn }
    }
    throw new Error(pData.message || ERROR_MAP[String(pData.code)] || '取流失败')
  }

  for (const qn of qualities) {
    const lines: Array<() => Promise<PlayStream>> = [
      () => tryAppLine(qn, APP_KEYS.ios),
      () => tryAppLine(qn, APP_KEYS.tv),
    ]
    if (navAvailable) lines.push(() => tryWebLine(qn))

    for (const line of lines) {
      try {
        return await line()
      } catch (e) {
        if (e instanceof AntiCrawlError || (e instanceof Error && e.name === 'AntiCrawlError')) {
          sawAntiCrawl = true
        } else if (e instanceof Error) {
          lastError = e.message
        }
      }
    }
  }

  if (sawAntiCrawl && !lastError) throw new AntiCrawlError()
  throw new Error(lastError || (sawAntiCrawl ? ANTI_CRAWL_MSG : '视频解析失败'))
}

export type EducationPagePart = {
  cid: number
  page: number
  part: string
  duration: number
}

export type EducationDetail = {
  bvid: string
  aid: number
  title: string
  pic: string
  desc: string
  author: string
  authorMid: number
  play: number
  danmaku: number
  like: number
  favorite: number
  coin: number
  pages: EducationPagePart[]
  url: string
}

function formatPartTitle(part: string, page: number, total: number) {
  const name = part.trim()
  if (name) return name
  return total > 1 ? `P${page}` : '正片'
}

export async function fetchEducationDetail(options: {
  bvid: string
  adminCookie?: string
}): Promise<EducationDetail> {
  const bvid = options.bvid.trim()
  if (!/^BV[a-zA-Z0-9]{10}$/i.test(bvid)) {
    throw new Error('无效的 BV 号')
  }

  const cookie = await buildBiliCookie(options.adminCookie ?? '')
  const vData = await fetchBiliJson(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
    { headers: biliHeaders(cookie) },
  )
  if (vData.code !== 0) {
    throw new Error(ERROR_MAP[String(vData.code)] || vData.message || '视频信息获取失败')
  }

  const view = vData.data as {
    bvid?: string
    aid?: number
    title?: string
    pic?: string
    desc?: string
    owner?: { name?: string; mid?: number }
    stat?: {
      view?: number
      danmaku?: number
      like?: number
      favorite?: number
      coin?: number
    }
    pages?: Array<{ cid?: number; page?: number; part?: string; duration?: number }>
  }

  const rawPages = Array.isArray(view.pages) ? view.pages : []
  const pages: EducationPagePart[] = rawPages
    .map((item, index) => {
      const page = Number(item.page) || index + 1
      const cid = Number(item.cid)
      if (!Number.isFinite(cid) || cid <= 0) return null
      return {
        cid,
        page,
        part: formatPartTitle(String(item.part ?? ''), page, rawPages.length),
        duration: Number(item.duration) || 0,
      }
    })
    .filter((item): item is EducationPagePart => item !== null)

  if (!pages.length) throw new Error('缺少分集信息')

  return {
    bvid: view.bvid || bvid,
    aid: Number(view.aid) || 0,
    title: view.title ?? '',
    pic: view.pic ?? '',
    desc: view.desc ?? '',
    author: view.owner?.name ?? '',
    authorMid: Number(view.owner?.mid) || 0,
    play: Number(view.stat?.view) || 0,
    danmaku: Number(view.stat?.danmaku) || 0,
    like: Number(view.stat?.like) || 0,
    favorite: Number(view.stat?.favorite) || 0,
    coin: Number(view.stat?.coin) || 0,
    pages,
    url: `https://www.bilibili.com/video/${view.bvid || bvid}`,
  }
}

export type ResolvedEducationVideo = {
  title: string
  pic: string
  bvid: string
  author: string
  playableUrl: string
  quality: number
}

export async function resolveEducationVideo(options: {
  bvid: string
  cid?: number
  qn?: number
  adminCookie?: string
  origin: string
}): Promise<ResolvedEducationVideo> {
  const bvid = options.bvid.trim()
  if (!/^BV[a-zA-Z0-9]{10}$/i.test(bvid)) {
    throw new Error('无效的 BV 号')
  }

  const cookie = await buildBiliCookie(options.adminCookie ?? '')

  const vData = await fetchBiliJson(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
    { headers: biliHeaders(cookie) },
  )
  if (vData.code !== 0) {
    throw new Error(ERROR_MAP[String(vData.code)] || vData.message || '视频信息获取失败')
  }

  const view = vData.data as {
    cid?: number
    title?: string
    pic?: string
    owner?: { name?: string }
    pages?: Array<{ cid?: number }>
  }

  const requestedCid = Number(options.cid)
  const pageCid =
    Number.isFinite(requestedCid) && requestedCid > 0
      ? requestedCid
      : Number(view.pages?.[0]?.cid) || Number(view.cid)
  if (!pageCid) throw new Error('缺少 cid')

  const stream = await getPlayUrlWithFallback(bvid, pageCid, options.qn ?? 80, cookie)
  const playableUrl = `${options.origin}/api/education/proxy?url=${encodeURIComponent(stream.url)}`

  return {
    title: view.title ?? '',
    pic: view.pic ?? '',
    bvid,
    author: view.owner?.name ?? '',
    playableUrl,
    quality: stream.quality,
  }
}

const ALLOWED_CDN_HOST =
  /(^|\.)(bilivideo\.(com|cn)|akamaized\.net|hdslb\.com|biliapi\.net)$/i

function isAllowedCdnUrl(raw: string) {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    return ALLOWED_CDN_HOST.test(u.hostname)
  } catch {
    return false
  }
}

export async function handleEducationProxy(request: Request, url: URL) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }

  const target = url.searchParams.get('url') ?? ''
  if (!target || !isAllowedCdnUrl(target)) {
    return new Response('Invalid CDN URL', { status: 400 })
  }

  const upstreamHeaders = new Headers({
    Referer: REFERER,
    'User-Agent': UA,
    Origin: 'https://www.bilibili.com',
    'Accept-Encoding': 'identity',
  })
  const range = request.headers.get('Range')
  if (range) upstreamHeaders.set('Range', range)

  try {
    let response: Response | undefined
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (attempt > 1) {
        upstreamHeaders.set('Cache-Control', 'no-cache')
        upstreamHeaders.set('X-Proxy-Retry', String(attempt))
      }
      response = await fetch(target, { headers: upstreamHeaders })
      if (response.status < 500 && response.status !== 403 && response.status !== 429) break
      try {
        await response.body?.cancel()
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, attempt * 150))
    }

    if (!response) return new Response('Proxy failed', { status: 502 })

    const responseHeaders = new Headers()
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    const copyHeaders = [
      'Content-Type',
      'Content-Length',
      'Accept-Ranges',
      'Content-Range',
    ]
    for (const h of copyHeaders) {
      const v = response.headers.get(h)
      if (v) responseHeaders.set(h, v)
    }
    responseHeaders.set('Access-Control-Expose-Headers', copyHeaders.join(', '))
    responseHeaders.set(
      'Cache-Control',
      response.ok ? 'public, max-age=3600' : 'no-store',
    )

    if (response.status === 204 || response.status === 304 || request.method === 'HEAD') {
      return new Response(null, { status: response.status, headers: responseHeaders })
    }

    return new Response(response.body, { status: response.status, headers: responseHeaders })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return new Response(null, { status: 499 })
    }
    const message = e instanceof Error ? e.message : 'Proxy Error'
    return new Response(`Proxy Error: ${message}`, { status: 502 })
  }
}
