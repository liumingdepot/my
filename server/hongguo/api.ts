/**
 * 红果短剧 Nitro API —— 对齐 hongguo-mac FastAPI 契约
 * 前缀: /api/hongguo
 *
 * mac 风格（原始 JSON）:
 *   /search /rank /latest /filters /browse /episodes /play /stream /img /stats /prefetch
 *
 * 兼容旧信封 {ok,data}:
 *   /categories /catalog /detail /play?source= 以及 /api/test 转发
 */

import { fetchById, fetchRandomFeedItem, searchByName, type FeedItem } from './qimao.js'
import * as hongguo from './hongguo.js'
import * as huangju from './huangju.js'
import {
  GENRES,
  RANK_BOARDS,
  RANK_NAMES,
  categoryOfGenre,
  isGenre,
  macFilters,
  toMacEpisodes,
  toMacItem,
  type RankBoard,
} from './mac.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders })
}

function bad(message: string, status = 400) {
  return json({ ok: false, error: message, detail: message }, status)
}

function macBad(detail: string, status = 400) {
  return json({ detail }, status)
}

export function isHongguoApi(pathname: string) {
  return pathname.startsWith('/api/hongguo')
}

const SOURCES = [
  { id: 'hongguo', name: '红果', description: '真人剧 · 漫剧 · AI 剧', onlineSearch: true },
  { id: 'huangju', name: '剧果', description: '热门 · 最新 · 分类短剧', onlineSearch: true },
]

function sourceOf(url: URL) {
  return (url.searchParams.get('source') || url.searchParams.get('source_id') || '').trim()
}

const STREAM_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const IMG_HOSTS = [
  'fqnovelpic.com',
  'byteimg.com',
  'qznovelvod.com',
  'douyinpic.com',
  'pstatp.com',
  'hongguoduanju.com',
  'snssdk.com',
]

const startedAt = Date.now()
const prefetching = new Set<string>()

function isAllowedHongguoMediaUrl(raw: string) {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const h = u.hostname.toLowerCase()
    return (
      h.endsWith('.qznovelvod.com') ||
      h.endsWith('qznovelvod.com') ||
      h.endsWith('.bytevcloudcdn.com') ||
      h.endsWith('.bytecdn.cn') ||
      h.endsWith('.snssdk.com') ||
      h.endsWith('.toutiaovod.com') ||
      h.endsWith('.ibytedtos.com') ||
      h.includes('novelvod') ||
      h.includes('fqnovel')
    )
  } catch {
    return false
  }
}

function isAllowedImgHost(raw: string) {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const h = (u.hostname || '').toLowerCase()
    return IMG_HOSTS.some((d) => h === d || h.endsWith('.' + d))
  } catch {
    return false
  }
}

function copyUpstreamMediaHeaders(upstream: Response) {
  const headers = new Headers()
  headers.set('content-type', upstream.headers.get('content-type') || 'application/octet-stream')
  headers.set('cache-control', 'no-store')
  headers.set('access-control-allow-origin', '*')
  headers.set('access-control-expose-headers', 'Content-Length, Content-Range, Accept-Ranges')
  for (const key of ['content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(key)
    if (value) headers.set(key, value)
  }
  return headers
}

async function fetchHongguoMedia(playUrl: string, referer: string, range: string | null) {
  return fetch(playUrl, {
    headers: {
      'User-Agent': STREAM_UA,
      Accept: '*/*',
      'Accept-Encoding': 'identity',
      Referer: referer,
      Origin: new URL(referer).origin,
      ...(range ? { Range: range } : {}),
    },
  })
}

async function proxyHongguoStream(
  request: Request,
  opts: { dramaId: string; episodeId: string; target: string },
) {
  let playUrl = opts.target
  let referer = 'https://novel.snssdk.com/'

  if (opts.dramaId && opts.episodeId && !playUrl) {
    const play = await hongguo.hongguoPlay(opts.dramaId, opts.episodeId)
    playUrl = play.url
    referer = play.referer || referer
  }

  if (!playUrl || !/^https?:\/\//i.test(playUrl)) return macBad('播放地址无效')
  if (!isAllowedHongguoMediaUrl(playUrl)) return macBad('不允许代理的媒体域名', 403)

  const range = request.headers.get('range')
  const referers = [referer, 'https://novel.snssdk.com/', 'https://hongguoduanju.com/'].filter(
    (value, index, all) => all.indexOf(value) === index,
  )

  let upstream: Response | null = null
  for (const candidate of referers) {
    const res = await fetchHongguoMedia(playUrl, candidate, range)
    if (res.status === 403 || res.status === 401) {
      try {
        await res.body?.cancel()
      } catch {
        /* ignore */
      }
      continue
    }
    upstream = res
    referer = candidate
    break
  }

  if (!upstream) return macBad('红果 CDN 拒绝访问（防盗链），请稍后重试或换一集', 502)

  if (!upstream.ok && upstream.status !== 206) {
    const status = upstream.status
    try {
      await upstream.body?.cancel()
    } catch {
      /* ignore */
    }
    return macBad(`红果媒体上游错误 HTTP ${status}`, 502)
  }

  const contentType = upstream.headers.get('content-type') || ''
  if (contentType.includes('mpegurl') || playUrl.includes('.m3u8')) {
    const text = await upstream.text()
    if (!text.trim().startsWith('#EXTM3U')) return macBad('红果播放列表无效', 502)
    const base = new URL(playUrl)
    const rewritten = text
      .split('\n')
      .map((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return line
        const abs = new URL(trimmed, base).toString()
        const qs = new URLSearchParams({
          series_id: opts.dramaId,
          episode_id: opts.episodeId,
          url: abs,
        })
        return `/api/hongguo/stream?${qs}`
      })
      .join('\n')
    return new Response(rewritten, {
      status: 200,
      headers: {
        'content-type': 'application/vnd.apple.mpegurl; charset=utf-8',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      },
    })
  }

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: upstream.status,
      headers: copyUpstreamMediaHeaders(upstream),
    })
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: copyUpstreamMediaHeaders(upstream),
  })
}

async function resolveEpisodeVid(seriesId: string, ep: number) {
  const detail = await hongguo.hongguoDetail(seriesId)
  const { episodes } = toMacEpisodes(detail)
  const hit = episodes.find((e) => e.index === ep) || episodes[ep - 1]
  if (!hit?.vid) throw new Error('集号不存在')
  return { detail, episode: hit }
}

async function macCatalog(genre: string, page: number, limit: number, theme?: string) {
  const category = categoryOfGenre(genre)
  if (theme) {
    const data = await hongguo.hongguoSearch(theme, 1)
    return data.list.slice(0, limit).map((x) => toMacItem(x))
  }
  const data = await hongguo.hongguoCatalog({ page, category })
  return data.list.slice(0, limit).map((x) => toMacItem(x))
}

/** —— mac 风格路由 —— */
async function handleMacRoutes(request: Request, url: URL, path: string): Promise<Response | null> {
  const method = request.method.toUpperCase()

  if (path === '' || path === 'ping' || path === 'health') {
    return json({
      service: '红果短剧API',
      engine: 'nitro',
      note: 'hongguo-mac 契约 · 站源取流（非 unidbg 解密）',
      ui: '/hongguo',
      endpoints: [
        '/api/hongguo/search?q=',
        '/api/hongguo/rank?board=recommend|hot|new',
        '/api/hongguo/latest?genre=short_play|comic_series|ai_series',
        '/api/hongguo/filters?genre=',
        '/api/hongguo/browse?genre=&theme=',
        '/api/hongguo/episodes?series_id=',
        '/api/hongguo/play?series_id=&ep=1',
        '/api/hongguo/stream?series_id=&ep=1',
        '/api/hongguo/img?url=',
        '/api/hongguo/stats',
      ],
    })
  }

  if (path === 'stats') {
    return json({
      uptime_s: Math.floor((Date.now() - startedAt) / 1000),
      engine: 'nitro',
      decrypt: false,
      note: 'Nitro 站源代理版：可播串流走 Referer 代理，不进行官方密文离线解密',
    })
  }

  if (path === 'filters') {
    const genre = (url.searchParams.get('genre') || 'short_play').trim()
    if (!isGenre(genre)) return macBad(`genre必须是 ${Object.keys(GENRES).join('|')}`)
    return json(macFilters(genre))
  }

  if (path === 'browse') {
    const genre = (url.searchParams.get('genre') || 'short_play').trim()
    if (!isGenre(genre)) return macBad(`genre必须是 ${Object.keys(GENRES).join('|')}`)
    const theme = (url.searchParams.get('theme') || '').trim()
    const limitRaw = Number(url.searchParams.get('limit') || '36')
    const limit = Math.min(60, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 36))
    const items = await macCatalog(genre, 1, limit, theme || undefined)
    return json({
      genre,
      name: GENRES[genre].name,
      count: items.length,
      note: 'stream_url=播第1集; 其它集用 episodes_url 取集号后 /stream?series_id=&ep=N',
      items,
    })
  }

  if (path === 'latest') {
    const genre = (url.searchParams.get('genre') || 'short_play').trim()
    if (!isGenre(genre)) return macBad(`genre必须是 ${Object.keys(GENRES).join('|')}`)
    const onlyToday = url.searchParams.get('only_today') !== 'false'
    const limitRaw = Number(url.searchParams.get('limit') || '12')
    const limit = Math.min(120, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 12))
    const items = await macCatalog(genre, 1, limit)
    const mode =
      genre === 'short_play'
        ? onlyToday
          ? '今日上新'
          : '最新上架'
        : '7天内上新·最新上架'
    return json({
      genre,
      name: GENRES[genre].name,
      mode,
      only_today: onlyToday,
      count: items.length,
      items,
    })
  }

  if (path === 'rank') {
    const board = (url.searchParams.get('board') || 'recommend').trim() as RankBoard
    if (!RANK_BOARDS.includes(board)) {
      return macBad(`board必须是 ${RANK_BOARDS.join('|')}`)
    }
    const limitRaw = Number(url.searchParams.get('limit') || '30')
    const limit = Math.min(40, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 30))
    // 站源无原生榜单：用漫剧目录近似（与 mac 默认漫剧榜一致）
    const page = board === 'new' ? 1 : board === 'hot' ? 1 : 1
    const data = await hongguo.hongguoCatalog({ page, category: 'comic' })
    const items = data.list.slice(0, limit).map((x) => toMacItem(x))
    return json({ board, name: RANK_NAMES[board], items })
  }

  if (path === 'search') {
    const q =
      (url.searchParams.get('q') || url.searchParams.get('name') || url.searchParams.get('query') || '').trim()
    // mac 搜索
    if (q && !sourceOf(url)) {
      const limitRaw = Number(url.searchParams.get('limit') || '40')
      const limit = Math.min(40, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 40))
      const data = await hongguo.hongguoSearch(q, 1)
      return json({
        query: q,
        results: data.list.slice(0, limit).map((x) => toMacItem(x)),
      })
    }
    return null // 交给旧信封逻辑
  }

  if (path === 'episodes') {
    const seriesId = (url.searchParams.get('series_id') || url.searchParams.get('id') || '').trim()
    if (!seriesId) return macBad('缺少 series_id')
    const detail = await hongguo.hongguoDetail(seriesId)
    return json(toMacEpisodes(detail))
  }

  if (path === 'play' && !sourceOf(url)) {
    const seriesId = (url.searchParams.get('series_id') || '').trim()
    const epRaw = (url.searchParams.get('ep') || '1').trim()
    if (!seriesId) return null
    const { detail, episode } = await resolveEpisodeVid(
      seriesId,
      Number.isFinite(Number(epRaw)) ? Math.max(1, Math.floor(Number(epRaw))) : 1,
    )
    const play = await hongguo.hongguoPlay(seriesId, episode.vid)
    return json({
      series_id: seriesId,
      title: detail.title,
      note: 'encrypted_url 为上游直链; 可播放用 stream_url（本机 Referer 代理）',
      episodes: [
        {
          index: episode.index,
          vid: episode.vid,
          title: episode.title,
          duration: episode.duration,
          encrypted_url: play.url,
          stream_url: `/api/hongguo/stream?series_id=${encodeURIComponent(seriesId)}&ep=${episode.index}`,
        },
      ],
    })
  }

  if (path === 'stream') {
    if (method !== 'GET' && method !== 'HEAD') return macBad(`不支持的方法: ${method}`, 405)
    const seriesId = (
      url.searchParams.get('series_id') ||
      url.searchParams.get('drama_id') ||
      ''
    ).trim()
    const episodeId = (url.searchParams.get('episode_id') || url.searchParams.get('vid') || '').trim()
    const target = (url.searchParams.get('url') || '').trim()
    const epRaw = (url.searchParams.get('ep') || '1').trim()

    // mac: /stream?series_id=&ep=
    if (seriesId && !episodeId && !target) {
      const ep = Number.isFinite(Number(epRaw)) ? Math.max(1, Math.floor(Number(epRaw))) : 1
      const { episode } = await resolveEpisodeVid(seriesId, ep)
      return proxyHongguoStream(request, {
        dramaId: seriesId,
        episodeId: episode.vid,
        target: '',
      })
    }

    // mac: /stream?vid=
    if (episodeId && seriesId) {
      return proxyHongguoStream(request, { dramaId: seriesId, episodeId, target })
    }
    if (episodeId && target) {
      return proxyHongguoStream(request, { dramaId: seriesId, episodeId, target })
    }
    if (target) {
      return proxyHongguoStream(request, { dramaId: seriesId, episodeId, target })
    }

    // 剧果等旧代理
    const source = sourceOf(url)
    if (source === 'huangju') {
      if (!episodeId && !target) return macBad('缺少 episode_id 或 url')
      let playUrl = target
      let cookie = ''
      let referer = 'https://huangju.net/'
      if (episodeId) {
        const play = await huangju.huangjuPlay(episodeId)
        cookie = play.cookie || ''
        referer = play.referer
        if (!playUrl) playUrl = play.url
      }
      if (!playUrl || !/^https?:\/\//i.test(playUrl)) return macBad('播放地址无效')
      const upstream = await fetch(playUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
          Accept: '*/*',
          Referer: referer,
          Origin: 'https://huangju.net',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(request.headers.get('range') ? { Range: request.headers.get('range')! } : {}),
        },
      })
      const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
      if (contentType.includes('mpegurl') || playUrl.includes('.m3u8')) {
        const text = await upstream.text()
        if (!text.trim().startsWith('#EXTM3U')) return macBad('剧果播放列表无效', 502)
        const base = new URL(playUrl)
        const rewritten = text
          .split('\n')
          .map((line) => {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) return line
            const abs = new URL(trimmed, base).toString()
            const qs = new URLSearchParams({
              source: 'huangju',
              episode_id: episodeId,
              url: abs,
            })
            return `/api/hongguo/stream?${qs}`
          })
          .join('\n')
        return new Response(rewritten, {
          status: 200,
          headers: {
            'content-type': 'application/vnd.apple.mpegurl; charset=utf-8',
            'cache-control': 'no-store',
            'access-control-allow-origin': '*',
          },
        })
      }
      const headers = copyUpstreamMediaHeaders(upstream)
      headers.set('content-type', contentType)
      return new Response(upstream.body, { status: upstream.status, headers })
    }

    if (seriesId && episodeId) {
      return proxyHongguoStream(request, { dramaId: seriesId, episodeId, target })
    }
    return macBad('需 series_id+ep 或 vid/url')
  }

  if (path === 'img') {
    const raw = (url.searchParams.get('url') || '').trim()
    if (!raw) return macBad('缺少 url')
    if (!isAllowedImgHost(raw)) return macBad('图片域名不允许', 400)
    const upstream = await fetch(raw, {
      headers: { 'User-Agent': STREAM_UA, Accept: 'image/*,*/*' },
    })
    if (!upstream.ok) return macBad(`图片读取失败 HTTP ${upstream.status}`, 404)
    const buf = await upstream.arrayBuffer()
    const headers = new Headers()
    headers.set('content-type', upstream.headers.get('content-type') || 'image/jpeg')
    headers.set('cache-control', 'max-age=86400')
    headers.set('access-control-allow-origin', '*')
    return new Response(buf, { status: 200, headers })
  }

  if (path === 'prefetch') {
    const seriesId = (url.searchParams.get('series_id') || '').trim()
    const epRaw = (url.searchParams.get('ep') || '1').trim()
    const vid = (url.searchParams.get('vid') || '').trim()
    if (!vid && !seriesId) return macBad('需 series_id+ep 或 vid')
    const key = vid ? `v:${vid}` : `s:${seriesId}:${epRaw}`
    if (prefetching.has(key)) return json({ ok: true, queued: 'running' })
    prefetching.add(key)
    // 后台预热：解析播放地址（站源版无法做离线解密缓存）
    void (async () => {
      try {
        if (vid && seriesId) {
          await hongguo.hongguoPlay(seriesId, vid)
        } else if (seriesId) {
          const ep = Number.isFinite(Number(epRaw)) ? Math.max(1, Math.floor(Number(epRaw))) : 1
          const { episode } = await resolveEpisodeVid(seriesId, ep)
          await hongguo.hongguoPlay(seriesId, episode.vid)
        }
      } catch {
        /* ignore */
      } finally {
        prefetching.delete(key)
      }
    })()
    return json({ ok: true, queued: true })
  }

  return null
}

/** —— 旧信封路由（前端 / 测试模块兼容） —— */
async function handleLegacyRoutes(request: Request, url: URL, path: string): Promise<Response> {
  const method = request.method.toUpperCase()

  if (path === 'sources') {
    return json({ ok: true, data: SOURCES })
  }

  if (path === 'categories') {
    const source = sourceOf(url) || 'hongguo'
    if (source === 'hongguo') return json({ ok: true, data: await hongguo.hongguoCategories() })
    if (source === 'huangju') return json({ ok: true, data: await huangju.huangjuCategories() })
    return bad(`未知站源: ${source}`)
  }

  if (path === 'search') {
    const source = sourceOf(url)
    const name = (
      url.searchParams.get('name') ||
      url.searchParams.get('q') ||
      url.searchParams.get('query') ||
      ''
    ).trim()
    const pageRaw = Number(url.searchParams.get('page') || '1')
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
    const category = (url.searchParams.get('category') || '').trim()

    if (!source || source === 'qimao') {
      if (!name) return bad('缺少搜索关键词 name')
      const data = await searchByName(name, page)
      return json({
        ok: true,
        data: {
          list: data.list,
          total: data.list.length,
          page: data.page,
          total_pages: data.total_pages,
          next_page: data.next_page,
        },
      })
    }

    if (source === 'hongguo') {
      if (name) return json({ ok: true, data: await hongguo.hongguoSearch(name, page) })
      return json({ ok: true, data: await hongguo.hongguoCatalog({ page, category }) })
    }

    if (source === 'huangju') {
      if (!name && !category) {
        return json({ ok: true, data: await huangju.huangjuCatalog({ page, category: '' }) })
      }
      return json({
        ok: true,
        data: await huangju.huangjuCatalog({ page, category, query: name || undefined }),
      })
    }

    return bad(`未知站源: ${source}`)
  }

  if (path === 'catalog') {
    const source = sourceOf(url) || 'hongguo'
    const pageRaw = Number(url.searchParams.get('page') || '1')
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
    const category = (url.searchParams.get('category') || '').trim()
    const query = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim()

    if (source === 'hongguo') {
      if (query) return json({ ok: true, data: await hongguo.hongguoSearch(query, page) })
      return json({ ok: true, data: await hongguo.hongguoCatalog({ page, category }) })
    }
    if (source === 'huangju') {
      return json({
        ok: true,
        data: await huangju.huangjuCatalog({ page, category, query: query || undefined }),
      })
    }
    return bad(`未知站源: ${source}`)
  }

  if (path === 'detail') {
    const source = sourceOf(url)
    const id = (url.searchParams.get('id') || url.searchParams.get('playlet_id') || '').trim()
    if (!id) return bad('缺少短剧 id')

    if (!source || source === 'qimao') return json({ ok: true, data: await fetchById(id) })
    if (source === 'hongguo') return json({ ok: true, data: await hongguo.hongguoDetail(id) })
    if (source === 'huangju') return json({ ok: true, data: await huangju.huangjuDetail(id) })
    return bad(`未知站源: ${source}`)
  }

  if (path === 'play') {
    if (method !== 'GET') return bad(`不支持的方法: ${method}`, 405)
    const source = sourceOf(url)
    const dramaId = (url.searchParams.get('drama_id') || url.searchParams.get('series_id') || '').trim()
    const episodeId = (url.searchParams.get('episode_id') || url.searchParams.get('video_id') || '').trim()
    if (!source) return bad('缺少 source')
    if (!episodeId) return bad('缺少 episode_id')

    if (source === 'hongguo') {
      if (!dramaId) return bad('红果取流需要 drama_id')
      const play = await hongguo.hongguoPlay(dramaId, episodeId)
      const proxyQs = new URLSearchParams({
        series_id: dramaId,
        episode_id: episodeId,
        url: play.url,
      })
      return json({
        ok: true,
        data: {
          url: `/api/hongguo/stream?${proxyQs}`,
          originUrl: play.url,
          referer: play.referer,
          quality: play.quality,
          variants: play.variants,
          proxy: true,
          mediaType: play.url.includes('.m3u8') ? 'hls' : 'mp4',
        },
      })
    }

    if (source === 'huangju') {
      const play = await huangju.huangjuPlay(episodeId)
      const proxyQs = new URLSearchParams({ source: 'huangju', episode_id: episodeId })
      return json({
        ok: true,
        data: {
          url: `/api/hongguo/stream?${proxyQs}`,
          originUrl: play.url,
          referer: play.referer,
          expiresAt: play.expiresAt,
          proxy: true,
          mediaType: play.url.includes('.m3u8') ? 'hls' : 'mp4',
        },
      })
    }

    return bad(`未知站源: ${source}`)
  }

  if (path === 'feed') {
    const countRaw = Number(url.searchParams.get('count') || '1')
    const count = Math.min(6, Math.max(1, Number.isFinite(countRaw) ? Math.floor(countRaw) : 1))
    const exclude = new Set(
      (url.searchParams.get('exclude') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    const results = await Promise.all(Array.from({ length: count }, () => fetchRandomFeedItem(exclude)))
    const seen = new Set(exclude)
    const items: FeedItem[] = []
    for (const item of results) {
      const id = String(item.drama.id)
      if (seen.has(id) || seen.has(item.drama.playlet_id)) continue
      seen.add(id)
      seen.add(item.drama.playlet_id)
      items.push(item)
    }
    while (items.length < count) {
      const item = await fetchRandomFeedItem(seen)
      seen.add(String(item.drama.id))
      seen.add(item.drama.playlet_id)
      items.push(item)
    }
    return json({ ok: true, data: { list: items } })
  }

  if (method !== 'GET') return bad(`不支持的方法: ${method}`, 405)
  return bad(`未知接口: ${method} ${url.pathname}`, 404)
}

export async function handleHongguoApi(request: Request, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/api\/hongguo\/?/, '') || ''
  try {
    const mac = await handleMacRoutes(request, url, path)
    if (mac) return mac
    return await handleLegacyRoutes(request, url, path)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '上游请求失败'
    // mac 路由错误用 detail；旧信封用 error
    if (
      ['filters', 'browse', 'latest', 'rank', 'episodes', 'stream', 'img', 'prefetch'].includes(path) ||
      (path === 'search' && !sourceOf(url)) ||
      (path === 'play' && !sourceOf(url))
    ) {
      return macBad(msg, 502)
    }
    return bad(msg, 502)
  }
}
