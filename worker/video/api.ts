import type { AdminEnv } from '../admin/types.js'
import { ensureVideoSourcesTable, listEnabledVideoSources } from '../admin/videoSources.js'
import { FALLBACK_VIDEO_SOURCES } from './defaults.js'

const LIVE_PLAYLIST_URL = 'https://live.zbds.top/tv/iptv4.m3u'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

type SourceEntry = { name: string; url: string }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders })
}

function bad(message: string, status = 400) {
  return json({ error: message }, status)
}

async function loadSources(env: AdminEnv): Promise<SourceEntry[]> {
  try {
    await ensureVideoSourcesTable(env.DB)
    const rows = await listEnabledVideoSources(env.DB)
    if (rows.length) {
      return rows.map((row) => ({ name: row.name, url: row.url }))
    }
  } catch {
    /* fall through to hardcoded fallback */
  }
  return FALLBACK_VIDEO_SOURCES.map((s) => ({ name: s.name, url: s.url }))
}

function findSource(sources: SourceEntry[], name: string | null) {
  if (!name) return sources[0]!
  return sources.find((s) => s.name === name) ?? sources[0]!
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

type LiveChannel = {
  name: string
  url: string
  logo: string
  group: string
  tvgId: string
}

function attr(line: string, key: string) {
  return new RegExp(`${key}="([^"]*)"`).exec(line)?.[1] ?? ''
}

/** Parse IPTV #EXTINF playlist into channel list (http/https only). */
function parseIptvM3u(text: string): LiveChannel[] {
  const lines = text.split(/\r?\n/)
  const list: LiveChannel[] = []
  let pending: Omit<LiveChannel, 'url'> | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#EXTINF:')) {
      const name = trimmed.includes(',') ? trimmed.slice(trimmed.lastIndexOf(',') + 1).trim() : ''
      pending = {
        name,
        logo: attr(trimmed, 'tvg-logo'),
        group: attr(trimmed, 'group-title') || '未分组',
        tvgId: attr(trimmed, 'tvg-id') || attr(trimmed, 'tvg-name') || name,
      }
      continue
    }
    if (trimmed.startsWith('#') || !pending) continue
    if (/^https?:\/\//i.test(trimmed)) {
      list.push({ ...pending, url: trimmed })
    }
    pending = null
  }
  return list
}

/** 茅台采集接口禁止 wd 搜索，用站内联想拿 id，再拉 m3u8 详情。 */
async function searchMaotai(source: SourceEntry, q: string, pg: number) {
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

export async function handleVideoApi(request: Request, url: URL, env: AdminEnv): Promise<Response> {
  if (request.method !== 'GET') {
    return bad('请使用 GET', 405)
  }

  const path = url.pathname.replace(/^\/api\/video\/?/, '')

  try {
    switch (path) {
      case 'sources': {
        const sources = await loadSources(env)
        return json({ list: sources.map((s) => ({ name: s.name })) })
      }

      case 'search': {
        const q = url.searchParams.get('q')?.trim()
        if (!q) return bad('请输入关键词')
        const pg = Number(url.searchParams.get('pg') || '1') || 1
        const sources = await loadSources(env)
        const source = findSource(sources, url.searchParams.get('source'))
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
        const sources = await loadSources(env)
        const source = findSource(sources, url.searchParams.get('source'))
        const data = await fetchUpstream(`${source.url}?ac=videolist&t=${encodeURIComponent(t)}&pg=${pg}`)
        return json(normalizeList(data, source.name))
      }

      case 'detail': {
        const ids = url.searchParams.get('ids')?.trim()
        if (!ids) return bad('缺少 id')
        const sources = await loadSources(env)
        const source = findSource(sources, url.searchParams.get('source'))
        const data = await fetchUpstream(`${source.url}?ac=detail&ids=${encodeURIComponent(ids)}`)
        return json(normalizeList(data, source.name))
      }

      case 'live': {
        const upstream = await fetch(LIVE_PLAYLIST_URL, {
          headers: {
            'user-agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            accept: 'application/vnd.apple.mpegurl,audio/x-mpegurl,text/plain,*/*',
          },
          signal: AbortSignal.timeout(30_000),
        })
        if (!upstream.ok) return bad('直播源拉取失败', 502)
        const text = await upstream.text()
        const list = parseIptvM3u(text)
        const groups = [...new Set(list.map((c) => c.group))]
        return new Response(JSON.stringify({ list, groups }), {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'public, max-age=300',
          },
        })
      }

      case 'stream': {
        const target = url.searchParams.get('url')?.trim()
        if (!target || !isAllowedStreamUrl(target)) return bad('无效地址')
        const forcePlaylist = url.searchParams.get('playlist') === '1'
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
          forcePlaylist ||
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
