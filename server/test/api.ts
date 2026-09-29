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

export function isTestApi(pathname: string) {
  return pathname.startsWith('/api/test')
}

export async function handleTestApi(request: Request, url: URL): Promise<Response> {
  const path = url.pathname.replace(/^\/api\/test\/?/, '') || ''
  const method = request.method.toUpperCase()

  if (method !== 'GET') {
    return bad(`不支持的方法: ${method}`, 405)
  }

  try {
    if (path === '' || path === 'ping') {
      return json({
        ok: true,
        module: 'test',
        message: '七猫短剧 API 代理正常',
        now: new Date().toISOString(),
      })
    }

    if (path === 'search') {
      const name = (url.searchParams.get('name') || url.searchParams.get('q') || '').trim()
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
      const id = (url.searchParams.get('id') || '').trim()
      if (!id) return bad('缺少短剧 id')
      const detail = await fetchById(id)
      return json({ ok: true, data: detail })
    }

    /** 抖音式首页：随机分类 → 随机作品 → 随机一集；count 可一次取多条 */
    if (path === 'feed') {
      const countRaw = Number(url.searchParams.get('count') || '1')
      const count = Math.min(6, Math.max(1, Number.isFinite(countRaw) ? Math.floor(countRaw) : 1))
      const exclude = new Set(
        (url.searchParams.get('exclude') || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
      const results = await Promise.all(
        Array.from({ length: count }, () => fetchRandomFeedItem(exclude)),
      )
      const seen = new Set(exclude)
      const items: FeedItem[] = []
      for (const item of results) {
        const id = String(item.drama.id)
        if (seen.has(id) || seen.has(item.drama.playlet_id)) continue
        seen.add(id)
        seen.add(item.drama.playlet_id)
        items.push(item)
      }
      // 并行可能撞车，不足时串行补齐
      while (items.length < count) {
        const item = await fetchRandomFeedItem(seen)
        seen.add(String(item.drama.id))
        seen.add(item.drama.playlet_id)
        items.push(item)
      }
      return json({ ok: true, data: { list: items } })
    }

    return bad(`未知测试接口: ${method} ${url.pathname}`, 404)
  } catch (e) {
    return bad(e instanceof Error ? e.message : '上游请求失败', 502)
  }
}
