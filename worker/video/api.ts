import { cacheKey, withKvJsonCache } from '../kvCache.js'
import {
  DEFAULT_VIDEO_SOURCES,
  loadEnabledSourceEntries,
  type SourceEntry,
} from './sources.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=30',
}

const noStoreHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

type VideoEnv = { DB: D1Database; KV: KVNamespace }

const TTL = {
  sources: 300,
  classes: 1800,
  list: 600,
  search: 300,
  detail: 600,
  qq: 900,
  'qq/list': 600,
} as const

function json(data: unknown, status = 200, store = true) {
  return new Response(JSON.stringify(data), {
    status,
    headers: store ? jsonHeaders : noStoreHeaders,
  })
}

function bad(message: string, status = 400) {
  return json({ error: message }, status, false)
}

function findSource(sources: SourceEntry[], name: string | null, primary: string) {
  if (!sources.length) {
    const fallback = DEFAULT_VIDEO_SOURCES[0]!
    return { name: fallback.name, url: fallback.url }
  }
  if (!name) return sources.find((s) => s.name === primary) ?? sources[0]!
  return sources.find((s) => s.name === name) ?? sources.find((s) => s.name === primary) ?? sources[0]!
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

/** 腾讯视频频道页：只取片名/封面，前端点进站内搜索 */
async function fetchQqChannel(pageId: string) {
  const guid = 'video-home-qq'
  const url =
    `https://pbaccess.video.qq.com/trpc.vector_layout.page_view.PageService/getPage` +
    `?video_appid=3000010&vversion_platform=2&vdevice_guid=${guid}`
  const body = {
    page_params: {
      page_type: 'channel',
      page_id: pageId,
      scene: 'channel',
      new_mark_label_enabled: '1',
      skip_privacy_types: '0',
      support_click_scan: '1',
    },
    page_bypass_params: {
      params: {
        platform_id: '2',
        caller_id: '3000010',
        data_mode: 'default',
        user_mode: 'default',
        page_type: 'channel',
        page_id: pageId,
        scene: 'channel',
        new_mark_label_enabled: '1',
      },
      scene: 'channel',
      app_version: '',
      abtest_bypass_id: guid,
    },
    page_context: null,
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://v.qq.com',
      referer: 'https://v.qq.com/',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`qq ${res.status}`)
  const data = (await res.json()) as Record<string, unknown>
  if (data.ret !== 0 && data.ret !== '0') {
    throw new Error(String(data.msg || '腾讯频道失败'))
  }
  return {
    list: extractQqTitles(data.data),
    menus: extractQqMenus(data.data),
    page_id: pageId,
  }
}

function cleanQqTitle(raw: string) {
  return raw.split('|')[0]!.replace(/\s+/g, ' ').trim()
}

function extractQqMenus(root: unknown) {
  type Menu = { title: string; filter: string }
  const menus: Menu[] = []
  const seen = new Set<string>()

  function walk(obj: unknown, moduleType: string) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item, moduleType)
      return
    }
    const rec = obj as Record<string, unknown>
    const type = typeof rec.type === 'string' ? rec.type : ''
    const nextType = type.startsWith('pc_') ? type : moduleType

    if (nextType === 'pc_hot_filter_child') {
      const params =
        rec.params && typeof rec.params === 'object'
          ? (rec.params as Record<string, unknown>)
          : null
      if (params) {
        const title = String(params.label_title || '').trim()
        const filter = String(params.filter_value || '').trim()
        const key = `${title}|${filter}`
        if (title && filter && !seen.has(key)) {
          seen.add(key)
          menus.push({ title, filter })
        }
      }
    }

    for (const value of Object.values(rec)) walk(value, nextType)
  }

  walk(root, '')
  return menus
}

function normalizeQqFilter(filter: string) {
  const raw = filter.trim()
  if (!raw) return 'sort=75'
  if (!/(?:^|&)sort=/.test(raw)) return `sort=75&${raw}`
  return raw
}

function encodeQqCtx(obj: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeQqCtx(raw: string) {
  const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

/**
 * 腾讯视频频道筛选列表
 * https://pbaccess.video.qq.com/.../MVLPageHTTPService/getMVLPage
 */
async function fetchQqFilterList(channelId: string, filter: string, pageContext?: unknown) {
  const url =
    'https://pbaccess.video.qq.com/trpc.multi_vector_layout.mvl_controller.MVLPageHTTPService/getMVLPage' +
    '?&vversion_platform=2'
  const body: Record<string, unknown> = {
    page_params: {
      channel_id: channelId,
      filter_params: normalizeQqFilter(filter),
      page_type: 'operation',
      page_id: 'channel_list',
    },
  }
  if (pageContext && typeof pageContext === 'object') {
    body.page_context = pageContext
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      origin: 'https://v.qq.com',
      referer: 'https://v.qq.com/',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`qq mvl ${res.status}`)
  const data = (await res.json()) as Record<string, unknown>
  if (data.ret !== 0 && data.ret !== '0') {
    throw new Error(String(data.msg || '腾讯列表失败'))
  }
  const root = data.data as Record<string, unknown> | undefined
  return {
    list: extractMvlPosters(root),
    filters: extractMvlFilters(root),
    has_next: Boolean(root?.has_next_page),
    next_page_context: root?.page_context ?? null,
    channel_id: channelId,
    filter: normalizeQqFilter(filter),
  }
}

function extractMvlFilters(root: unknown) {
  type Opt = { n: string; v: string }
  type Group = { key: string; name: string; options: Opt[] }
  const order: string[] = []
  const map = new Map<string, Group>()

  function walk(obj: unknown) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item)
      return
    }
    const rec = obj as Record<string, unknown>
    if (rec.type === 'searchlist_filter_card' && rec.params && typeof rec.params === 'object') {
      const p = rec.params as Record<string, unknown>
      const key = String(p.index_item_key || '').trim()
      const name = String(p.index_name || '').trim()
      const n = String(p.option_name || '').trim()
      const v = String(p.option_value || '').trim()
      if (key && name && n && v) {
        let group = map.get(key)
        if (!group) {
          group = { key, name, options: [] }
          map.set(key, group)
          order.push(key)
        }
        if (!group.options.some((o) => o.v === v)) {
          group.options.push({ n, v })
        }
      }
    }
    for (const value of Object.values(rec)) walk(value)
  }

  walk(root)
  return order.map((k) => map.get(k)!)
}

function upgradeQqCoverUrl(url: string) {
  const raw = url.trim()
  if (!raw) return ''
  // 腾讯封面 /350 /750 为缩略图；/0 或去后缀为原图，明显更清晰
  return raw.replace(/\/\d+(\?|$)/, '/0$1').replace(/\/\d+$/, '/0')
}

function pickQqCover(p: Record<string, unknown>, prefer: 'vt' | 'hz') {
  const vt = upgradeQqCoverUrl(String(p.new_pic_vt || '').trim())
  const hz = upgradeQqCoverUrl(
    String(p.new_pic_hz || p.pic_1280x720 || p.image_url || '').trim(),
  )
  if (prefer === 'hz') return hz || vt
  return vt || hz
}

function extractMvlPosters(root: unknown) {
  const list: {
    title: string
    pic: string
    pic_hz: string
    sub: string
    cid: string
    year: string
    score: string
    badge: string
  }[] = []
  const seen = new Set<string>()

  function parseMark(raw: unknown) {
    try {
      const mark = JSON.parse(String(raw || '{}')) as Record<
        string,
        { info?: { text?: string } }
      >
      return {
        year: String(mark['1']?.info?.text || '').trim(),
        badge: String(mark['2']?.info?.text || '').trim(),
        score: String(mark['4']?.info?.text || '').trim(),
      }
    } catch {
      return { year: '', badge: '', score: '' }
    }
  }

  function walk(obj: unknown) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item)
      return
    }
    const rec = obj as Record<string, unknown>
    if (rec.type === 'searchlist_poster_card' && rec.params && typeof rec.params === 'object') {
      const p = rec.params as Record<string, unknown>
      const cid = String(p.cid || '').trim()
      const title = cleanQqTitle(String(p.title || ''))
      const pic = pickQqCover(p, 'vt')
      const pic_hz = pickQqCover(p, 'hz')
      const sub = String(p.sub_title || p.protagonist_name || p.second_title || '')
        .replace(/^\[|\]$/g, '')
        .trim()
      const mark = parseMark(p.latest_mark_label)
      const year = String(p.year || mark.year || '').trim()
      const badge = mark.badge && mark.badge !== year ? mark.badge : ''
      const score = mark.score
      if (cid && title && !seen.has(cid)) {
        seen.add(cid)
        list.push({ title, pic, pic_hz, sub, cid, year, score, badge })
      }
    }
    for (const value of Object.values(rec)) walk(value)
  }

  walk(root)
  return list
}

function extractQqTitles(root: unknown) {
  type Hit = { title: string; pic: string; sub: string; cid: string; prefer: number }
  const byCid = new Map<string, Hit>()

  function preferOf(moduleType: string) {
    if (moduleType === 'pc_video' || moduleType === 'pc_shelves') return 3
    if (moduleType === 'pc_chasing') return 2
    if (moduleType === 'pc_carousel') return 1
    return 0
  }

  function walk(obj: unknown, moduleType: string) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item, moduleType)
      return
    }
    const rec = obj as Record<string, unknown>
    const type = typeof rec.type === 'string' ? rec.type : ''
    const nextType = type.startsWith('pc_') ? type : moduleType
    if (nextType === 'pc_card_ad') return

    const params =
      rec.params && typeof rec.params === 'object'
        ? (rec.params as Record<string, unknown>)
        : null
    if (params) {
      const title = cleanQqTitle(String(params.title || ''))
      const cid = String(params.cid || '').trim()
      const pic = upgradeQqCoverUrl(String(params.pic_1280x720 || '').trim())
      const sub = String(params.sub_title || '').trim()
      const prefer = preferOf(nextType)
      if (title && cid && prefer > 0) {
        const prev = byCid.get(cid)
        if (!prev || prefer > prev.prefer) {
          byCid.set(cid, {
            title,
            pic: pic || prev?.pic || '',
            sub: sub || prev?.sub || '',
            cid,
            prefer,
          })
        } else if (prev && !prev.pic && pic) {
          prev.pic = pic
        }
      }
    }

    for (const value of Object.values(rec)) walk(value, nextType)
  }

  walk(root, '')
  return [...byCid.values()]
    .filter((i) => i.title.length >= 2)
    .map(({ title, pic, sub, cid }) => ({ title, pic, sub, cid }))
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
        vod_content: String(item.vod_content ?? item.vod_blurb ?? ''),
        vod_actor: String(item.vod_actor ?? ''),
        vod_director: String(item.vod_director ?? ''),
        vod_area: String(item.vod_area ?? ''),
        vod_year: String(item.vod_year ?? item.vod_pubdate ?? ''),
        vod_en: String(item.vod_en ?? ''),
        vod_class: String(item.vod_class ?? ''),
        vod_score: String(item.vod_score ?? ''),
        vod_douban_score: String(item.vod_douban_score ?? ''),
        type_id: item.type_id,
        type_name: String(item.type_name ?? ''),
        vod_play_url: String(item.vod_play_url ?? ''),
        vod_play_from: String(item.vod_play_from ?? ''),
        source: sourceName,
      }
    }),
    page: Number(data.page ?? 1),
    pagecount: Number(data.pagecount ?? 1),
    total: Number(data.total ?? list.length),
  }
}

/** 茅台采集接口禁止 wd 搜索，用站内联想拿 id，再拉详情 */
async function searchMaotai(source: SourceEntry, q: string, pg: number) {
  const pageSize = 20
  const origin = new URL(source.url).origin
  const suggestUrl = new URL('/index.php/ajax/suggest', origin)
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

export async function handleVideoApi(
  request: Request,
  url: URL,
  env: VideoEnv,
): Promise<Response> {
  if (request.method !== 'GET') {
    return bad('请使用 GET', 405)
  }

  const path = url.pathname.replace(/^\/api\/video\/?/, '')

  try {
    switch (path) {
      case 'sources': {
        const payload = await withKvJsonCache(env.KV, 'video:sources', TTL.sources, async () => {
          const { sources, primary } = await loadEnabledSourceEntries(env.DB)
          return {
            list: sources.map((s) => ({ name: s.name })),
            primary,
          }
        })
        return json(payload)
      }

      case 'classes': {
        const sourceName = url.searchParams.get('source') || ''
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('video:classes', { source: sourceName }),
          TTL.classes,
          async () => {
            const { sources, primary } = await loadEnabledSourceEntries(env.DB)
            const source = findSource(sources, sourceName || primary, primary)
            const data = await fetchUpstream(`${source.url}?ac=list`)
            const classes = Array.isArray(data.class) ? data.class : []
            return { list: classes, source: source.name }
          },
        )
        return json(payload)
      }

      case 'search': {
        const q = url.searchParams.get('q')?.trim()
        if (!q) return bad('请输入关键词')
        const pg = Number(url.searchParams.get('pg') || '1') || 1
        const sourceParam = url.searchParams.get('source') || ''
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('video:search', { q, pg, source: sourceParam }),
          TTL.search,
          async () => {
            const { sources, primary } = await loadEnabledSourceEntries(env.DB)
            const source = findSource(sources, sourceParam || null, primary)
            if (source.name === '茅台') return searchMaotai(source, q, pg)
            const data = await fetchUpstream(
              `${source.url}?ac=videolist&wd=${encodeURIComponent(q)}&pg=${pg}`,
            )
            return normalizeList(data, source.name)
          },
        )
        return json(payload)
      }

      case 'list': {
        const t = url.searchParams.get('t')?.trim()
        if (!t) return bad('缺少分类')
        const pg = Number(url.searchParams.get('pg') || '1') || 1
        const sourceParam = url.searchParams.get('source') || ''
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('video:list', { t, pg, source: sourceParam }),
          TTL.list,
          async () => {
            const { sources, primary } = await loadEnabledSourceEntries(env.DB)
            const source = findSource(sources, sourceParam || null, primary)
            const data = await fetchUpstream(
              `${source.url}?ac=videolist&t=${encodeURIComponent(t)}&pg=${pg}`,
            )
            return normalizeList(data, source.name)
          },
        )
        return json(payload)
      }

      case 'detail': {
        const ids = url.searchParams.get('ids')?.trim()
        if (!ids) return bad('缺少 id')
        const sourceParam = url.searchParams.get('source') || ''
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('video:detail', { ids, source: sourceParam }),
          TTL.detail,
          async () => {
            const { sources, primary } = await loadEnabledSourceEntries(env.DB)
            const source = findSource(sources, sourceParam || null, primary)
            const data = await fetchUpstream(
              `${source.url}?ac=detail&ids=${encodeURIComponent(ids)}`,
            )
            return normalizeList(data, source.name)
          },
        )
        return json(payload)
      }

      case 'qq': {
        const pageId = url.searchParams.get('page_id')?.trim() || '100101'
        if (!/^\d{4,8}$/.test(pageId)) return bad('无效 page_id')
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('video:qq', { pageId }),
          TTL.qq,
          () => fetchQqChannel(pageId),
        )
        return json(payload)
      }

      case 'qq/list': {
        const channelId = url.searchParams.get('channel_id')?.trim() || ''
        if (!/^\d{4,8}$/.test(channelId)) return bad('无效 channel_id')
        const filter = url.searchParams.get('filter')?.trim() || 'sort=75'
        if (!/^[\w.=&\-,%]+$/.test(filter) || filter.length > 500) return bad('无效 filter')
        let pageContext: unknown
        const ctxRaw = url.searchParams.get('ctx')?.trim()
        if (ctxRaw) {
          try {
            pageContext = decodeQqCtx(ctxRaw)
          } catch {
            return bad('无效 ctx')
          }
        }
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('video:qq/list', { channelId, filter, ctx: ctxRaw || '' }),
          TTL['qq/list'],
          async () => {
            const result = await fetchQqFilterList(channelId, filter, pageContext)
            return {
              list: result.list,
              filters: result.filters,
              has_next: result.has_next,
              next_ctx:
                result.next_page_context != null ? encodeQqCtx(result.next_page_context) : '',
              channel_id: result.channel_id,
              filter: result.filter,
            }
          },
        )
        return json(payload)
      }

      default:
        return bad('未知接口', 404)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '请求失败'
    return bad(message, 502)
  }
}
