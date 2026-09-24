import type { GameCategory, GameInput } from './games.js'

const YIKM_ORIGIN = 'https://www.yikm.net'
const ROM_CDN = 'https://file.1990i.com'
const LIST_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

/** yikm `/nes` 分类 tag（e=0 表示 FC） */
export const YIKM_FC_TAGS = [
  { tag: 2, genre: '动作冒险' },
  { tag: 3, genre: '飞行射击' },
  { tag: 4, genre: '格斗' },
  { tag: 5, genre: '棋牌' },
  { tag: 6, genre: '射击' },
  { tag: 7, genre: '运动比赛' },
  { tag: 8, genre: '小游戏' },
  { tag: 10, genre: '角色扮演' },
] as const

export type YikmFcTag = (typeof YIKM_FC_TAGS)[number]['tag']

const YIKM_TAG_GENRE = Object.fromEntries(YIKM_FC_TAGS.map((item) => [item.tag, item.genre])) as Record<
  YikmFcTag,
  string
>

export function isYikmFcTag(value: unknown): value is YikmFcTag {
  return typeof value === 'number' && Number.isInteger(value) && value in YIKM_TAG_GENRE
}

export type ScrapedGame = Omit<GameInput, 'recommended'> & { sourceId: string }

type ListItem = {
  playId: string
  name: string
  imageUrl: string
  genre: string
  sortOrder: number
}

function absoluteUrl(src: string) {
  if (!src) return ''
  if (/^https?:\/\//i.test(src)) return src
  if (src.startsWith('//')) return `https:${src}`
  if (src.startsWith('/')) return `${YIKM_ORIGIN}${src}`
  return `${YIKM_ORIGIN}/${src}`
}

/** Encode each path segment so ROM filenames with spaces / [] work. */
export function romPathToDownloadUrl(gromname: string) {
  const path = gromname
    .trim()
    .split('/')
    .map((seg) => (seg ? encodeURIComponent(seg) : ''))
    .join('/')
  return `${ROM_CDN}${path.startsWith('/') ? path : `/${path}`}`
}

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function parseListPage(html: string, genreFallback: string): Omit<ListItem, 'sortOrder'>[] {
  const items: Omit<ListItem, 'sortOrder'>[] = []
  const chunks = html.split('<div class="col-md-3 col-xs-6">').slice(1)

  for (const card of chunks) {
    const idMatch = card.match(/href="\/play\?id=(\d+)"/)
    const imgMatch = card.match(/<img class="img img-raised" src="([^"]+)"/)
    const nameMatch = card.match(/<h4 class="card-caption">\s*<a[^>]*>([^<]+)<\/a>/)
    if (!idMatch || !nameMatch) continue

    const labels = [...card.matchAll(/class="label[^"]*"[^>]*>([^<]+)<\/span>/g)].map((m) =>
      decodeHtml(m[1] ?? ''),
    )
    const genre = genreFallback || labels.filter(Boolean).join('、') || '未分类'

    items.push({
      playId: idMatch[1]!,
      name: decodeHtml(nameMatch[1] ?? ''),
      imageUrl: absoluteUrl(imgMatch?.[1] ?? ''),
      genre,
    })
  }

  return items
}

function parsePlayPage(html: string) {
  const match = html.match(
    /var gromname="([^"]+)",gpic="([^"]*)",gameid="([^"]+)",gname="([^"]*)"/,
  )
  if (!match) return null
  return {
    gromname: match[1]!,
    gpic: match[2] ?? '',
    gameid: match[3]!,
    gname: decodeHtml(match[4] ?? ''),
  }
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': LIST_UA,
      Accept: 'text/html,application/xhtml+xml',
      Referer: `${YIKM_ORIGIN}/`,
    },
  })
  if (!response.ok) {
    throw new Error(`请求失败 ${response.status}: ${url}`)
  }
  return response.text()
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index]!)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export type ScrapeYikmOptions = {
  /** Inclusive start page (default 1) */
  fromPage?: number
  /** Inclusive end page (default 10) */
  toPage?: number
  /** yikm tag：2 动作冒险 / 3 飞行射击 / … / 10 角色扮演 */
  tag?: YikmFcTag
  category?: GameCategory
  concurrency?: number
}

/**
 * Scrape FC list pages from yikm.net and resolve ROM download URLs from play pages.
 * URL: `/nes?page={page}&tag={tag}&e=0`（e=0 固定表示 FC）
 */
export async function scrapeYikmFcGames(options: ScrapeYikmOptions = {}): Promise<ScrapedGame[]> {
  const fromPage = Math.max(1, options.fromPage ?? 1)
  const toPage = Math.max(fromPage, options.toPage ?? 10)
  const tag = isYikmFcTag(options.tag) ? options.tag : 2
  const genre = YIKM_TAG_GENRE[tag]
  const category = options.category ?? 'FC'
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 8))

  const listItems: ListItem[] = []
  for (let page = fromPage; page <= toPage; page++) {
    const url = `${YIKM_ORIGIN}/nes?page=${page}&tag=${tag}&e=0`
    try {
      const html = await fetchText(url)
      const pageItems = parseListPage(html, genre)
      if (pageItems.length === 0) break
      // 严格按分页页内顺序：tag * 1e6 + (page-1)*100 + 页内序号
      pageItems.forEach((item, index) => {
        listItems.push({
          ...item,
          sortOrder: tag * 1_000_000 + (page - 1) * 100 + index + 1,
        })
      })
    } catch (err) {
      console.warn('[scrape yikm] skip page', page, err)
      continue
    }
  }

  // Dedupe by play id（保留首次出现的分页顺序）
  const unique = new Map<string, ListItem>()
  for (const item of listItems) {
    if (!unique.has(item.playId)) unique.set(item.playId, item)
  }
  const items = [...unique.values()]

  const scraped = await mapPool(items, concurrency, async (item): Promise<ScrapedGame | null> => {
    try {
      const playHtml = await fetchText(`${YIKM_ORIGIN}/play?id=${item.playId}`)
      const detail = parsePlayPage(playHtml)
      if (!detail?.gromname) {
        console.warn(`[scrape yikm] skip ROM: ${item.name} (#${item.playId})`)
        return null
      }
      return {
        sourceId: item.playId,
        name: detail.gname || item.name,
        downloadUrl: romPathToDownloadUrl(detail.gromname),
        imageUrl: item.imageUrl || absoluteUrl(detail.gpic),
        category,
        genre: item.genre,
        sortOrder: item.sortOrder,
      }
    } catch (err) {
      console.warn(`[scrape yikm] skip: ${item.name} (#${item.playId})`, err)
      return null
    }
  })

  return scraped.filter((item): item is ScrapedGame => item !== null)
}
