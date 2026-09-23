import { findGameById, listFeaturedGames, listPublicGames } from './games.js'

const ROM_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const MAX_ROM_BYTES = 4 * 1024 * 1024

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'public, max-age=30',
    },
  })
}

export function isGameApi(pathname: string) {
  return (
    pathname === '/api/game/featured' ||
    pathname === '/api/game/list' ||
    pathname === '/api/game/detail' ||
    pathname === '/api/game/rom'
  )
}

export async function handleGameApi(request: Request, url: URL, env: { DB: D1Database }) {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (url.pathname === '/api/game/featured') {
    const limit = Number(url.searchParams.get('limit') ?? 12)
    const games = await listFeaturedGames(env.DB, Number.isFinite(limit) ? limit : 12)
    return json({ games })
  }

  if (url.pathname === '/api/game/list') {
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 24)
    const q = url.searchParams.get('q') ?? ''
    const category = url.searchParams.get('category') ?? ''
    const result = await listPublicGames(env.DB, {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 24,
      q,
      category,
    })
    return json(result)
  }

  if (url.pathname === '/api/game/detail') {
    const id = url.searchParams.get('id')?.trim() ?? ''
    if (!id) return json({ error: '缺少游戏 id' }, 400)
    const game = await findGameById(env.DB, id)
    if (!game) return json({ error: '游戏不存在' }, 404)
    return json({ game })
  }

  if (url.pathname === '/api/game/rom') {
    const id = url.searchParams.get('id')?.trim() ?? ''
    if (!id) return json({ error: '缺少游戏 id' }, 400)

    const game = await findGameById(env.DB, id)
    if (!game) return json({ error: '游戏不存在' }, 404)
    if (game.category !== 'FC') {
      return json({ error: '仅支持在线运行 FC 游戏' }, 400)
    }

    try {
      const upstream = await fetch(game.downloadUrl, {
        headers: {
          'user-agent': ROM_UA,
          accept: '*/*',
          referer: 'https://www.yikm.net/',
        },
        signal: AbortSignal.timeout(45_000),
      })
      if (!upstream.ok) {
        return json({ error: `ROM 拉取失败 (${upstream.status})` }, 502)
      }

      const lengthHeader = upstream.headers.get('content-length')
      if (lengthHeader && Number(lengthHeader) > MAX_ROM_BYTES) {
        return json({ error: 'ROM 文件过大' }, 413)
      }

      const buf = await upstream.arrayBuffer()
      if (buf.byteLength > MAX_ROM_BYTES) {
        return json({ error: 'ROM 文件过大' }, 413)
      }

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
      return new Response(buf, {
        status: 200,
        headers: {
          'content-type': contentType,
          'cache-control': 'public, max-age=86400',
          'access-control-allow-origin': '*',
          'content-disposition': `inline; filename="${encodeURIComponent(game.name)}.nes"`,
        },
      })
    } catch (err) {
      console.error('[game api] rom', err)
      return json({ error: 'ROM 不可用' }, 502)
    }
  }

  return json({ error: 'Not found' }, 404)
}
