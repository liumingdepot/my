/**
 * 七猫短剧 Nitro API —— 旧短剧模块专用
 * 前缀: /api/duanju
 */
import { fetchById, fetchRandomFeedItem, searchByName, type FeedItem } from './qimao.js'

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

export function isDuanjuApi(pathname: string) {
  return pathname.startsWith('/api/duanju')
}

export async function handleDuanjuApi(request: Request, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/api\/duanju\/?/, '') || ''
  const method = request.method.toUpperCase()

  if (method !== 'GET') {
    return bad(`不支持的方法: ${method}`, 405)
  }

  try {
    if (path === '' || path === 'ping' || path === 'health') {
      return json({
        ok: true,
        data: {
          module: 'duanju',
          message: '七猫短剧代理',
          now: new Date().toISOString(),
        },
      })
    }

    if (path === 'search') {
      const name = (
        url.searchParams.get('name') ||
        url.searchParams.get('q') ||
        url.searchParams.get('query') ||
        ''
      ).trim()
      if (!name) return bad('缺少搜索关键词 name')
      const pageRaw = Number(url.searchParams.get('page') || '1')
      const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
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

    if (path === 'detail') {
      const id = (url.searchParams.get('id') || url.searchParams.get('playlet_id') || '').trim()
      if (!id) return bad('缺少短剧 id')
      const detail = await fetchById(id)
      return json({ ok: true, data: detail })
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

    return bad(`未知短剧接口: ${method} ${url.pathname}`, 404)
  } catch (e) {
    return bad(e instanceof Error ? e.message : '上游请求失败', 502)
  }
}
