const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

/** MacCMS-style public sources */
export const VIDEO_SOURCES = [
  { name: '量子', url: 'https://cj.lziapi.com/api.php/provide/vod/' },
  { name: '红牛', url: 'https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/' },
  { name: '新浪', url: 'https://api.xinlangapi.com/xinlangapi.php/provide/vod/' },
  { name: '非凡', url: 'https://ffzy4.tv/api.php/provide/vod/' },
  { name: '无尽', url: 'https://api.wujinapi.com/api.php/provide/vod/' },
  { name: '金鹰', url: 'https://jinyingzy.com/provide/vod/' },
  { name: '茅台', url: 'https://caiji.maotai999.vip/api.php/provide/vod/from/mtm3u8/at/json/' },
  { name: '福利1', url: 'https://lbapi9.com/api.php/provide/vod/' },
  { name: '福利2', url: 'http://fhapi9.com/api.php/provide/vod/' },
] as const

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders })
}

function bad(message: string, status = 400) {
  return json({ error: message }, status)
}

function findSource(name: string | null) {
  if (!name) return VIDEO_SOURCES[0]
  return VIDEO_SOURCES.find((s) => s.name === name) ?? VIDEO_SOURCES[0]
}

async function fetchUpstream(url: string) {
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      accept: 'application/json,text/plain,*/*',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`upstream ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

function normalizeList(data: Record<string, unknown>, sourceName: string) {
  const list = Array.isArray(data.list) ? data.list : []
  return {
    list: list.map((raw) => {
      const item = raw as Record<string, unknown>
      return {
        vod_id: item.vod_id,
        vod_name: String(item.vod_name ?? ''),
        vod_pic: String(item.vod_pic ?? ''),
        vod_remarks: String(item.vod_remarks ?? ''),
        vod_blurb: String(item.vod_blurb ?? item.vod_content ?? ''),
        vod_actor: String(item.vod_actor ?? ''),
        vod_director: String(item.vod_director ?? ''),
        vod_area: String(item.vod_area ?? ''),
        vod_year: String(item.vod_year ?? item.vod_pubdate ?? ''),
        vod_en: String(item.vod_en ?? ''),
        type_id: item.type_id,
        type_name: String(item.type_name ?? ''),
        vod_play_url: String(item.vod_play_url ?? ''),
        source: sourceName,
      }
    }),
    page: Number(data.page ?? 1),
    pagecount: Number(data.pagecount ?? 1),
    total: Number(data.total ?? list.length),
  }
}

function isAllowedStreamUrl(raw: string) {
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function rewritePlaylist(body: string, playlistUrl: string, proxyBase: string) {
  const base = new URL(playlistUrl)
  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        if (trimmed.startsWith('#EXT-X-KEY') || trimmed.startsWith('#EXT-X-MAP')) {
          return trimmed.replace(/URI="([^"]+)"/g, (_, uri: string) => {
            const abs = new URL(uri, base).toString()
            return `URI="${proxyBase}${encodeURIComponent(abs)}"`
          })
        }
        return line
      }
      const abs = new URL(trimmed, base).toString()
      return `${proxyBase}${encodeURIComponent(abs)}`
    })
    .join('\n')
}

/** 茅台采集接口禁止 wd 搜索，用站内联想拿 id，再拉 m3u8 详情。 */
async function searchMaotai(source: { name: string; url: string }, q: string, pg: number) {
  const pageSize = 20
  const suggestUrl = new URL('/index.php/ajax/suggest', source.url)
  suggestUrl.searchParams.set('mid', '1')
  suggestUrl.searchParams.set('wd', q)
  suggestUrl.searchParams.set('limit', '60')
  const data = await fetchUpstream(suggestUrl.toString())
  const hits = Array.isArray(data.list) ? (data.list as Record<string, unknown>[]) : []
  const pagecount = Math.max(1, Math.ceil(hits.length / pageSize))
  const ids = hits
    .slice((pg - 1) * pageSize, pg * pageSize)
    .map((item) => String(item.id ?? ''))
    .filter(Boolean)
  if (!ids.length) {
    return { list: [], page: pg, pagecount, total: hits.length }
  }
  const detail = await fetchUpstream(`${source.url}?ac=videolist&ids=${ids.join(',')}`)
  const normalized = normalizeList(detail, source.name)
  const order = new Map(ids.map((id, index) => [id, index]))
  normalized.list.sort(
    (a, b) => (order.get(String(a.vod_id)) ?? 99) - (order.get(String(b.vod_id)) ?? 99),
  )
  return { ...normalized, page: pg, pagecount, total: hits.length }
}

export async function handleVideoApi(request: Request, url: URL): Promise<Response> {
  if (request.method !== 'GET') {
    return bad('请使用 GET', 405)
  }

  const path = url.pathname.replace(/^\/api\/video\/?/, '')

  try {
    switch (path) {
      case 'sources':
        return json({ list: VIDEO_SOURCES.map((s) => ({ name: s.name })) })

      case 'search': {
        const q = url.searchParams.get('q')?.trim()
        if (!q) return bad('请输入关键词')
        const pg = Number(url.searchParams.get('pg') || '1') || 1
        const source = findSource(url.searchParams.get('source'))
        if (source.name === '茅台') {
          return json(await searchMaotai(source, q, pg))
        }
        const data = await fetchUpstream(
          `${source.url}?ac=videolist&wd=${encodeURIComponent(q)}&pg=${pg}`,
        )
        return json(normalizeList(data, source.name))
      }

      case 'list': {
        const t = url.searchParams.get('t')?.trim()
        if (!t) return bad('缺少分类')
        const pg = Number(url.searchParams.get('pg') || '1') || 1
        const source = findSource(url.searchParams.get('source'))
        const data = await fetchUpstream(`${source.url}?ac=videolist&t=${encodeURIComponent(t)}&pg=${pg}`)
        return json(normalizeList(data, source.name))
      }

      case 'detail': {
        const ids = url.searchParams.get('ids')?.trim()
        if (!ids) return bad('缺少 id')
        const source = findSource(url.searchParams.get('source'))
        const data = await fetchUpstream(`${source.url}?ac=detail&ids=${encodeURIComponent(ids)}`)
        return json(normalizeList(data, source.name))
      }

      case 'stream': {
        const target = url.searchParams.get('url')?.trim()
        if (!target || !isAllowedStreamUrl(target)) return bad('无效地址')
        const upstream = await fetch(target, {
          headers: {
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            accept: '*/*',
            referer: new URL(target).origin + '/',
          },
          signal: AbortSignal.timeout(20_000),
        })
        if (!upstream.ok) return bad('拉流失败', 502)

        const contentType = upstream.headers.get('content-type') || ''
        const isPlaylist =
          contentType.includes('mpegurl') ||
          contentType.includes('m3u8') ||
          target.includes('.m3u8')

        if (isPlaylist) {
          const text = await upstream.text()
          const proxyBase = `${url.origin}/api/video/stream?url=`
          const rewritten = rewritePlaylist(text, target, proxyBase)
          return new Response(rewritten, {
            headers: {
              'content-type': 'application/vnd.apple.mpegurl; charset=utf-8',
              'cache-control': 'no-store',
              'access-control-allow-origin': '*',
            },
          })
        }

        return new Response(upstream.body, {
          headers: {
            'content-type': contentType || 'application/octet-stream',
            'cache-control': 'public, max-age=60',
            'access-control-allow-origin': '*',
          },
        })
      }

      default:
        return bad('未知接口', 404)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '请求失败'
    return bad(message, 502)
  }
}
