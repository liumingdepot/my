import { findEducationSourceById, listEducationSources } from './sources.js'
import { searchBiliVideos } from './bili.js'
import { getEducationCookie } from './config.js'
import {
  ANTI_CRAWL_MSG,
  AntiCrawlError,
  fetchEducationDetail,
  handleEducationProxy,
  resolveEducationVideo,
} from './play.js'

function json(data: unknown, status = 200, cache = true) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': status === 200 && cache ? 'public, max-age=30' : 'no-store',
    },
  })
}

export type PublicEducationClass = {
  typeName: string
  typeId: string
}

export type PublicEducationFilterOption = {
  n: string
  v: string
}

export type PublicEducationFilter = {
  key: string
  name: string
  value: PublicEducationFilterOption[]
}

export type PublicEducationSource = {
  id: string
  name: string
  sortOrder: number
  classes: PublicEducationClass[]
  filter: Record<string, PublicEducationFilter[]>
}

function parseSourceExt(ext: string): {
  classes: PublicEducationClass[]
  filter: Record<string, PublicEducationFilter[]>
} {
  try {
    const data = JSON.parse(ext) as {
      classes?: Array<{ type_name?: string; type_id?: string }>
      filter?: Record<string, Array<{ key?: string; name?: string; value?: Array<{ n?: string; v?: string }> }>>
    }
    const classes = (Array.isArray(data.classes) ? data.classes : [])
      .map((item) => ({
        typeName: String(item.type_name ?? '').trim(),
        typeId: String(item.type_id ?? '').trim(),
      }))
      .filter((item) => item.typeName && item.typeId)

    const filter: Record<string, PublicEducationFilter[]> = {}
    const rawFilter = data.filter && typeof data.filter === 'object' ? data.filter : {}
    for (const [key, list] of Object.entries(rawFilter)) {
      if (!Array.isArray(list)) continue
      filter[key] = list
        .map((item) => ({
          key: String(item.key ?? '').trim(),
          name: String(item.name ?? '').trim(),
          value: (Array.isArray(item.value) ? item.value : [])
            .map((opt) => ({
              n: String(opt.n ?? '').trim(),
              v: String(opt.v ?? '').trim(),
            }))
            .filter((opt) => opt.n && opt.v),
        }))
        .filter((item) => item.key && item.name && item.value.length)
    }

    return { classes, filter }
  } catch {
    return { classes: [], filter: {} }
  }
}

export function isEducationApi(pathname: string) {
  return (
    pathname === '/api/education/sources' ||
    pathname === '/api/education/videos' ||
    pathname === '/api/education/detail' ||
    pathname === '/api/education/play' ||
    pathname === '/api/education/proxy'
  )
}

export async function handleEducationApi(
  request: Request,
  url: URL,
  env: { DB: D1Database },
) {
  if (url.pathname === '/api/education/proxy') {
    return handleEducationProxy(request, url)
  }

  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (url.pathname === '/api/education/detail') {
    const bvid = (url.searchParams.get('bvid') ?? '').trim()
    if (!bvid) return json({ error: '缺少 bvid' }, 400, false)

    try {
      const { cookie } = await getEducationCookie(env.DB)
      const result = await fetchEducationDetail({
        bvid,
        adminCookie: cookie,
      })
      return json(result, 200, false)
    } catch (error) {
      const isAnti =
        error instanceof AntiCrawlError ||
        (error instanceof Error && error.name === 'AntiCrawlError')
      const message = isAnti
        ? ANTI_CRAWL_MSG
        : error instanceof Error
          ? error.message
          : '视频详情加载失败'
      return json({ error: message }, 502, false)
    }
  }

  if (url.pathname === '/api/education/play') {
    const bvid = (url.searchParams.get('bvid') ?? '').trim()
    const qn = Number(url.searchParams.get('qn') ?? 80)
    const cid = Number(url.searchParams.get('cid') ?? 0)
    if (!bvid) return json({ error: '缺少 bvid' }, 400, false)

    try {
      const { cookie } = await getEducationCookie(env.DB)
      const result = await resolveEducationVideo({
        bvid,
        cid: Number.isFinite(cid) && cid > 0 ? cid : undefined,
        qn: Number.isFinite(qn) ? qn : 80,
        adminCookie: cookie,
        origin: url.origin,
      })
      return json(result, 200, false)
    } catch (error) {
      const isAnti =
        error instanceof AntiCrawlError ||
        (error instanceof Error && error.name === 'AntiCrawlError')
      const message = isAnti
        ? ANTI_CRAWL_MSG
        : error instanceof Error
          ? error.message
          : '视频解析失败'
      return json({ error: message }, 502, false)
    }
  }

  if (url.pathname === '/api/education/sources') {
    const rows = await listEducationSources(env.DB)
    const sources: PublicEducationSource[] = rows.map((row) => {
      const parsed = parseSourceExt(row.ext)
      return {
        id: row.id,
        name: row.name,
        sortOrder: row.sortOrder,
        classes: parsed.classes,
        filter: parsed.filter,
      }
    })
    return json({ sources })
  }

  if (url.pathname === '/api/education/videos') {
    const sourceId = (url.searchParams.get('sourceId') ?? '').trim()
    const typeId = (url.searchParams.get('typeId') ?? '').trim()
    const keywordParam = (url.searchParams.get('keyword') ?? '').trim()
    const q = (url.searchParams.get('q') ?? '').trim()
    const page = Number(url.searchParams.get('page') ?? 1)
    const duration = Number(url.searchParams.get('duration') ?? 0)

    if (!sourceId) return json({ error: '缺少 sourceId' }, 400)

    const source = await findEducationSourceById(env.DB, sourceId)
    if (!source) return json({ error: '教育源不存在' }, 404)

    const parsed = parseSourceExt(source.ext)
    const allowed = new Set(parsed.classes.map((item) => item.typeId))
    if (typeId && !allowed.has(typeId)) {
      return json({ error: '分类不存在' }, 400)
    }

    // 教育范围内：必须带上当前源/分类关键词，用户搜索词只作补充
    const scope = keywordParam || typeId || source.name
    const keyword = q ? `${scope} ${q}` : scope
    try {
      const result = await searchBiliVideos(env.DB, {
        keyword,
        page: Number.isFinite(page) ? page : 1,
        duration: Number.isFinite(duration) ? duration : 0,
      })
      return json(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'B站视频加载失败'
      return json({ error: message }, 502)
    }
  }

  return json({ error: 'Not found' }, 404)
}
