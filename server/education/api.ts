import type { AppDb } from '../utils/db.js'
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

type EducationEnv = {
  DB: AppDb
  BILI_COOKIE?: string
}

function json(data: unknown, status = 200, cache = true) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': status === 200 && cache ? 'public, max-age=30' : 'no-store',
    },
  })
}

export async function handleEducationApi(
  request: Request,
  url: URL,
  env: EducationEnv,
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
      const result = await fetchEducationDetail({
        bvid,
        adminCookie: getEducationCookie(env),
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
      const result = await resolveEducationVideo({
        bvid,
        cid: Number.isFinite(cid) && cid > 0 ? cid : undefined,
        qn: Number.isFinite(qn) ? qn : 80,
        adminCookie: getEducationCookie(env),
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
    return json({ sources: listEducationSources() })
  }

  if (url.pathname === '/api/education/videos') {
    const sourceId = (url.searchParams.get('sourceId') ?? '').trim()
    const typeId = (url.searchParams.get('typeId') ?? '').trim()
    const keywordParam = (url.searchParams.get('keyword') ?? '').trim()
    const q = (url.searchParams.get('q') ?? '').trim()
    const page = Number(url.searchParams.get('page') ?? 1)
    const duration = Number(url.searchParams.get('duration') ?? 0)

    if (!sourceId) return json({ error: '缺少 sourceId' }, 400)

    const source = findEducationSourceById(sourceId)
    if (!source) return json({ error: '教育源不存在' }, 404)

    const allowed = new Set(source.classes.map((item) => item.typeId))
    if (typeId && !allowed.has(typeId)) {
      return json({ error: '分类不存在' }, 400)
    }

    // 教育范围内：必须带上当前源/分类关键词，用户搜索词只作补充
    const scope = keywordParam || typeId || source.name
    const keyword = q ? `${scope} ${q}` : scope
    try {
      const result = await searchBiliVideos(
        {
          keyword,
          page: Number.isFinite(page) ? page : 1,
          duration: Number.isFinite(duration) ? duration : 0,
        },
        getEducationCookie(env),
      )
      return json(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'B站视频加载失败'
      return json({ error: message }, 502)
    }
  }

  return json({ error: 'Not found' }, 404)
}