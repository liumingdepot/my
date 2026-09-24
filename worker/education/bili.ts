import { getEducationCookie } from './config.js'
import {
  ANTI_CRAWL_MSG,
  AntiCrawlError,
  appSign,
  biliHeaders,
  buildBiliCookie,
  fetchBiliJson,
  signWbi,
} from './biliAuth.js'

/** Android 搜索备用（web 风控时） */
const APP_SEARCH = {
  appkey: '1d8b6e7d45233436',
  appsec: '560c52ccd288fed045859ed18bffd973',
} as const

export type BiliVideo = {
  bvid: string
  aid: string
  title: string
  pic: string
  author: string
  duration: string
  play: number
  description: string
  url: string
}

export type BiliSearchResult = {
  items: BiliVideo[]
  page: number
  pageSize: number
  total: number
  pageCount: number
}

type BiliSearchItem = {
  bvid?: string
  aid?: number | string
  title?: string
  pic?: string
  author?: string
  duration?: string
  play?: number
  description?: string
}

function stripHtml(text: string) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function normalizePic(pic: string) {
  if (!pic) return ''
  if (pic.startsWith('//')) return `https:${pic}`
  if (pic.startsWith('http://')) return `https://${pic.slice(7)}`
  return pic
}

function mapSearchItems(raw: BiliSearchItem[]): BiliVideo[] {
  return raw
    .map((item) => {
      const bvid = String(item.bvid ?? '').trim()
      if (!bvid) return null
      const aid = String(item.aid ?? '').trim()
      return {
        bvid,
        aid,
        title: stripHtml(String(item.title ?? '')),
        pic: normalizePic(String(item.pic ?? '')),
        author: String(item.author ?? ''),
        duration: String(item.duration ?? ''),
        play: Number(item.play ?? 0) || 0,
        description: stripHtml(String(item.description ?? '')),
        url: `https://www.bilibili.com/video/${bvid}`,
      }
    })
    .filter((item): item is BiliVideo => item !== null)
}

function toSearchResult(
  data: {
    result?: BiliSearchItem[]
    numResults?: number
    numPages?: number
    pagesize?: number
  },
  page: number,
): BiliSearchResult {
  const pageSize = data.pagesize || 20
  const total = data.numResults ?? 0
  const pageCount = Math.max(1, data.numPages ?? (Math.ceil(total / pageSize) || 1))
  return {
    items: mapSearchItems(data.result ?? []),
    page,
    pageSize,
    total,
    pageCount,
  }
}

export async function searchBiliVideos(
  db: D1Database,
  options: {
    keyword: string
    page?: number
    duration?: number
  },
): Promise<BiliSearchResult> {
  const keyword = options.keyword.trim()
  const page = Math.max(1, Math.floor(options.page ?? 1))
  const duration = Math.min(4, Math.max(0, Math.floor(options.duration ?? 0)))

  if (!keyword) {
    return { items: [], page, pageSize: 20, total: 0, pageCount: 1 }
  }

  const { cookie: adminCookie } = await getEducationCookie(db)
  const cookie = await buildBiliCookie(adminCookie)
  const headers = biliHeaders(cookie)

  /** 经典搜索：有 buvid 时成功率最高（csp_Bili 同类）；经家宽代理 */
  const tryClassic = async (): Promise<BiliSearchResult> => {
    const url = new URL('https://api.bilibili.com/x/web-interface/search/type')
    url.searchParams.set('search_type', 'video')
    url.searchParams.set('keyword', keyword)
    url.searchParams.set('page', String(page))
    url.searchParams.set('pagesize', '20')
    url.searchParams.set('order', 'totalrank')
    url.searchParams.set('duration', String(duration))

    const payload = await fetchBiliJson(url.toString(), { headers })
    if (payload.code !== 0) {
      throw new Error(payload.message || `B站搜索失败（code ${payload.code ?? '?'}）`)
    }
    return toSearchResult(
      (payload.data ?? {}) as {
        result?: BiliSearchItem[]
        numResults?: number
        numPages?: number
        pagesize?: number
      },
      page,
    )
  }

  const tryWebWbi = async (): Promise<BiliSearchResult> => {
    const signed = await signWbi(
      {
        search_type: 'video',
        keyword,
        page,
        pagesize: 20,
        order: 'totalrank',
        duration,
      },
      cookie,
    )
    const payload = await fetchBiliJson(
      `https://api.bilibili.com/x/web-interface/wbi/search/type?${signed}`,
      { headers },
    )
    if (payload.code !== 0) {
      throw new Error(payload.message || `B站搜索失败（code ${payload.code ?? '?'}）`)
    }
    return toSearchResult(
      (payload.data ?? {}) as {
        result?: BiliSearchItem[]
        numResults?: number
        numPages?: number
        pagesize?: number
      },
      page,
    )
  }

  /** APP 搜索无 duration 精确过滤，仅作 web 风控兜底 */
  const tryAppSearch = async (): Promise<BiliSearchResult> => {
    const signed = await appSign(
      {
        keyword,
        pn: String(page),
        ps: '20',
        platform: 'android',
        build: '8410300',
        ts: String(Math.floor(Date.now() / 1000)),
      },
      APP_SEARCH.appkey,
      APP_SEARCH.appsec,
    )
    const payload = await fetchBiliJson(`https://app.bilibili.com/x/v2/search?${signed}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 BiliDroid/8.41.0 (bbcallen@gmail.com)',
      },
    })
    if (payload.code !== 0) {
      throw new Error(payload.message || `B站搜索失败（code ${payload.code ?? '?'}）`)
    }
    const data = (payload.data ?? {}) as {
      item?: Array<{
        type?: string
        param?: string
        title?: string
        cover?: string
        author?: string
        duration?: string
        play?: number
        desc?: string
      }>
      items?: BiliSearchItem[]
      numResults?: number
      pages?: number
    }

    let raw: BiliSearchItem[] = []
    if (Array.isArray(data.items)) {
      raw = data.items
    } else if (Array.isArray(data.item)) {
      raw = data.item
        .filter((it) => it.type === 'video' || Boolean(it.param?.startsWith('BV')))
        .map((it) => ({
          bvid: it.param,
          title: it.title,
          pic: it.cover,
          author: it.author,
          duration: it.duration,
          play: it.play,
          description: it.desc,
        }))
    }

    const pageSize = 20
    const total = data.numResults ?? raw.length
    const pageCount = Math.max(1, data.pages ?? (Math.ceil(total / pageSize) || 1))
    return { items: mapSearchItems(raw), page, pageSize, total, pageCount }
  }

  const lines = [tryClassic, tryWebWbi, tryAppSearch]
  let lastError: Error | null = null
  let sawAntiCrawl = false

  for (const line of lines) {
    try {
      return await line()
    } catch (error) {
      if (
        error instanceof AntiCrawlError ||
        (error instanceof Error && error.name === 'AntiCrawlError')
      ) {
        sawAntiCrawl = true
      } else if (error instanceof Error) {
        lastError = error
      }
    }
  }

  if (lastError) throw lastError
  throw new Error(sawAntiCrawl ? ANTI_CRAWL_MSG : 'B站搜索失败')
}
