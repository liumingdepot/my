import type { GameCategory, GameInput } from './games.js'

const YIKM_ORIGIN = 'https://www.yikm.net'
const ROM_CDN = 'https://file.1990i.com'
const LIST_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export type ScrapedGame = Omit<GameInput, 'recommended'> & { sourceId: string }

type ListItem = {
  playId: string
  name: string
  imageUrl: string
  genre: string
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

function parseListPage(html: string): ListItem[] {
  const items: ListItem[] = []
  const chunks = html.split('<div class="col-md-3 col-xs-6">').slice(1)

  for (const card of chunks) {
    const idMatch = card.match(/href="\/play\?id=(\d+)"/)
    const imgMatch = card.match(/<img class="img img-raised" src="([^"]+)"/)
    const nameMatch = card.match(/<h4 class="card-caption">\s*<a[^>]*>([^<]+)<\/a>/)
    if (!idMatch || !nameMatch) continue

    const labels = [...card.matchAll(/class="label[^"]*"[^>]*>([^<]+)<\/span>/g)].map((m) =>
      decodeHtml(m[1] ?? ''),
    )
    const genre = labels.filter(Boolean).join('、') || '未分类'

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
  category?: GameCategory
  concurrency?: number
}

/**
 * Scrape FC list pages from yikm.net and resolve ROM download URLs from play pages.
 * Default: pages 1–10 of `/nes?tag=0&e=0`.
 */
export async function scrapeYikmFcGames(options: ScrapeYikmOptions = {}): Promise<ScrapedGame[]> {
  const fromPage = Math.max(1, options.fromPage ?? 1)
  const toPage = Math.max(fromPage, options.toPage ?? 10)
  const category = options.category ?? 'FC'
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 8))

  const listItems: ListItem[] = []
  for (let page = fromPage; page <= toPage; page++) {
    const url = `${YIKM_ORIGIN}/nes?page=${page}&tag=0&e=0`
    const html = await fetchText(url)
    const pageItems = parseListPage(html)
    if (pageItems.length === 0) break
    listItems.push(...pageItems)
  }

  // Dedupe by play id (list may repeat across pages)
  const unique = new Map<string, ListItem>()
  for (const item of listItems) {
    if (!unique.has(item.playId)) unique.set(item.playId, item)
  }
  const items = [...unique.values()]

  const scraped = await mapPool(items, concurrency, async (item) => {
    const playHtml = await fetchText(`${YIKM_ORIGIN}/play?id=${item.playId}`)
    const detail = parsePlayPage(playHtml)
    if (!detail?.gromname) {
      throw new Error(`无法解析 ROM: ${item.name} (#${item.playId})`)
    }
    const game: ScrapedGame = {
      sourceId: item.playId,
      name: detail.gname || item.name,
      downloadUrl: romPathToDownloadUrl(detail.gromname),
      imageUrl: item.imageUrl || absoluteUrl(detail.gpic),
      category,
      genre: item.genre,
    }
    return game
  })

  return scraped
}
