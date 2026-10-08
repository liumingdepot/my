import { fetchById, fetchRandomFeedItem, searchByName, type FeedItem } from './qimao.js'
import * as hongguo from './hongguo.js'
import * as huangju from './huangju.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders })
}

function bad(message: string, status = 400) {
  return json({ ok: false, error: message }, status)
}

export function isTestApi(pathname: string) {
  return pathname.startsWith('/api/test')
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

/** 红果媒体 CDN 白名单，避免开放代理 */
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

  if (!playUrl || !/^https?:\/\//i.test(playUrl)) return bad('播放地址无效')
  if (!isAllowedHongguoMediaUrl(playUrl)) return bad('不允许代理的媒体域名', 403)

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

  if (!upstream) {
    return bad('红果 CDN 拒绝访问（防盗链），请稍后重试或换一集', 502)
  }

  if (!upstream.ok && upstream.status !== 206) {
    const status = upstream.status
    try {
      await upstream.body?.cancel()
    } catch {
      /* ignore */
    }
    return bad(`红果媒体上游错误 HTTP ${status}`, 502)
  }

  const contentType = upstream.headers.get('content-type') || ''
  if (contentType.includes('mpegurl') || playUrl.includes('.m3u8')) {
    const text = await upstream.text()
    if (!text.trim().startsWith('#EXTM3U')) return bad('红果播放列表无效', 502)
    const base = new URL(playUrl)
    const rewritten = text
      .split('\n')
      .map((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return line
        const abs = new URL(trimmed, base).toString()
        const qs = new URLSearchParams({
          source: 'hongguo',
          drama_id: opts.dramaId,
          episode_id: opts.episodeId,
          url: abs,
        })
        return `/api/test/stream?${qs}`
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

export async function handleTestApi(request: Request, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/api\/test\/?/, '') || ''
  const method = request.method.toUpperCase()

  if (method !== 'GET' && !(method === 'POST' && path.startsWith('stream'))) {
    // stream 仅 GET；其余写操作暂不开放
  }

  try {
    if (path === '' || path === 'ping' || path === 'health') {
      return json({
        ok: true,
        data: {
          module: 'test',
          message: '红果 / 剧果 站源代理',
          sources: SOURCES.map((s) => s.id),
          now: new Date().toISOString(),
        },
      })
    }

    if (path === 'sources') {
      return json({ ok: true, data: SOURCES })
    }

    if (path === 'categories') {
      const source = sourceOf(url) || 'hongguo'
      if (source === 'hongguo') {
        return json({ ok: true, data: await hongguo.hongguoCategories() })
      }
      if (source === 'huangju') {
        return json({ ok: true, data: await huangju.huangjuCategories() })
      }
      return bad(`未知站源: ${source}`)
    }

    // —— 红果 / 剧果 搜索 ——
    if (path === 'search') {
      const source = sourceOf(url)
      const name = (url.searchParams.get('name') || url.searchParams.get('q') || url.searchParams.get('query') || '').trim()
      const pageRaw = Number(url.searchParams.get('page') || '1')
      const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
      const category = (url.searchParams.get('category') || '').trim()

      // 兼容旧短剧模块：无 source 时走七猫
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
        if (name) {
          const data = await hongguo.hongguoSearch(name, page)
          return json({ ok: true, data })
        }
        const data = await hongguo.hongguoCatalog({ page, category })
        return json({ ok: true, data })
      }

      if (source === 'huangju') {
        if (!name && !category) {
          // 无关键词时返回热门目录
          const data = await huangju.huangjuCatalog({ page, category: '' })
          return json({ ok: true, data })
        }
        const data = await huangju.huangjuCatalog({ page, category, query: name || undefined })
        return json({ ok: true, data })
      }

      return bad(`未知站源: ${source}`)
    }

    // —— 目录（显式） ——
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

    // —— 详情 ——
    if (path === 'detail') {
      const source = sourceOf(url)
      const id = (url.searchParams.get('id') || url.searchParams.get('playlet_id') || '').trim()
      if (!id) return bad('缺少短剧 id')

      if (!source || source === 'qimao') {
        const detail = await fetchById(id)
        return json({ ok: true, data: detail })
      }
      if (source === 'hongguo') {
        return json({ ok: true, data: await hongguo.hongguoDetail(id) })
      }
      if (source === 'huangju') {
        return json({ ok: true, data: await huangju.huangjuDetail(id) })
      }
      return bad(`未知站源: ${source}`)
    }

    // —— 取流 ——
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
        // CDN 防盗链：浏览器直链会 403，统一走本机代理并带 Referer
        const proxyQs = new URLSearchParams({
          source: 'hongguo',
          drama_id: dramaId,
          episode_id: episodeId,
          url: play.url,
        })
        return json({
          ok: true,
          data: {
            url: `/api/test/stream?${proxyQs}`,
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
        const proxyQs = new URLSearchParams({
          source: 'huangju',
          episode_id: episodeId,
        })
        return json({
          ok: true,
          data: {
            url: `/api/test/stream?${proxyQs}`,
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

    // —— 媒体代理（红果 Referer / 剧果 CloudFront Cookie） ——
    if (path === 'stream') {
      if (method !== 'GET' && method !== 'HEAD') return bad(`不支持的方法: ${method}`, 405)
      const source = sourceOf(url)
      const episodeId = (url.searchParams.get('episode_id') || '').trim()
      const dramaId = (url.searchParams.get('drama_id') || url.searchParams.get('series_id') || '').trim()
      const target = (url.searchParams.get('url') || '').trim()

      if (source === 'hongguo') {
        return proxyHongguoStream(request, { dramaId, episodeId, target })
      }

      if (source === 'huangju') {
        if (!episodeId && !target) return bad('缺少 episode_id 或 url')
        let playUrl = target
        let cookie = ''
        let referer = 'https://huangju.net/'
        if (episodeId) {
          const play = await huangju.huangjuPlay(episodeId)
          cookie = play.cookie || ''
          referer = play.referer
          // 未指定具体分片/列表 url 时，用取流主地址
          if (!playUrl) playUrl = play.url
        }
        if (!playUrl || !/^https?:\/\//i.test(playUrl)) return bad('播放地址无效')

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
        // m3u8：改写分片地址到本代理（带绝对 url）
        if (contentType.includes('mpegurl') || playUrl.includes('.m3u8')) {
          const text = await upstream.text()
          if (!text.trim().startsWith('#EXTM3U')) {
            return bad('剧果播放列表无效', 502)
          }
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
              return `/api/test/stream?${qs}`
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

        const headers = new Headers()
        headers.set('content-type', contentType)
        headers.set('cache-control', 'no-store')
        headers.set('access-control-allow-origin', '*')
        const len = upstream.headers.get('content-length')
        if (len) headers.set('content-length', len)
        const range = upstream.headers.get('content-range')
        if (range) headers.set('content-range', range)
        const acceptRanges = upstream.headers.get('accept-ranges')
        if (acceptRanges) headers.set('accept-ranges', acceptRanges)

        return new Response(upstream.body, { status: upstream.status, headers })
      }

      return bad(`不支持的代理站源: ${source || '(空)'}`)
    }

    // —— 旧七猫 feed（短剧首页仍用） ——
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

    if (method !== 'GET') {
      return bad(`不支持的方法: ${method}`, 405)
    }

    return bad(`未知测试接口: ${method} ${url.pathname}`, 404)
  } catch (e) {
    return bad(e instanceof Error ? e.message : '上游请求失败', 502)
  }
}
