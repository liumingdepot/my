import type { AppDb } from '../utils/db.js'
import { findGameById, listFeaturedGames, listPublicGames } from './games.js'
import {
  browseYikmArcadePage,
  browseYikmFcPage,
  normalizeYikmFcPlayId,
  resolveYikmLiveDetail,
  searchYikmArcadeGames,
  searchYikmFcGames,
  searchYikmLiveGames,
  yikmArcadeTagFromGenre,
  yikmFcTagFromGenre,
} from './scrape.js'

const ROM_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const MAX_FC_ROM_BYTES = 4 * 1024 * 1024
const MAX_ARCADE_ROM_BYTES = 64 * 1024 * 1024
const MAX_BIOS_BYTES = 8 * 1024 * 1024
const BIOS_CDN = 'https://file.1990i.com/fbneobios'

/** 根据街机 downloadUrl 路径推断所需 BIOS（FBNeo） */
export function arcadeBiosFileFromDownloadUrl(downloadUrl: string): string | null {
  if (/\/snk-neo-geo\//i.test(downloadUrl)) return 'neogeo.zip'
  if (/\/pgm\//i.test(downloadUrl)) return 'pgm.zip'
  return null
}

/** FBNeo 认的是 zip 文件名（romset），必须与 CDN 上的名称一致 */
export function arcadeRomsetFileFromDownloadUrl(downloadUrl: string): string {
  try {
    const name = decodeURIComponent(new URL(downloadUrl).pathname.split('/').pop() || '')
    if (/\.zip$/i.test(name)) return name
  } catch {
    /* ignore */
  }
  return 'rom.zip'
}

function isRomApiPath(pathname: string) {
  return pathname === '/api/game/rom' || pathname.startsWith('/api/game/rom/')
}

function isBiosApiPath(pathname: string) {
  return pathname === '/api/game/bios' || pathname.startsWith('/api/game/bios/')
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'public, max-age=30',
    },
  })
}

function toPublicLiveGame(
  item: {
    id: string
    name: string
    imageUrl: string
    genre: string
    category: 'FC' | '街机'
    downloadUrl?: string
  },
  downloadUrl = '',
) {
  return {
    id: item.id,
    name: item.name,
    downloadUrl: downloadUrl || item.downloadUrl || '',
    imageUrl: item.imageUrl,
    category: item.category,
    genre: item.genre,
    sortOrder: 0,
    recommended: false,
    createdAt: '',
    updatedAt: '',
  }
}

async function proxyBinary(
  upstreamUrl: string,
  options: {
    maxBytes: number
    filename: string
    timeoutMs?: number
    stream?: boolean
  },
) {
  const upstream = await fetch(upstreamUrl, {
    headers: {
      'user-agent': ROM_UA,
      accept: '*/*',
      referer: 'https://www.yikm.net/',
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
  })
  if (!upstream.ok) {
    return json({ error: `文件拉取失败 (${upstream.status})` }, 502)
  }

  const lengthHeader = upstream.headers.get('content-length')
  if (lengthHeader && Number(lengthHeader) > options.maxBytes) {
    return json({ error: '文件过大' }, 413)
  }

  // filename 保持 ASCII romset 名（勿 encodeURIComponent），供 EmulatorJS 识别
  const safeName = options.filename.replace(/[^\w.\-]+/g, '_')
  const headers = {
    'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
    'cache-control': 'public, max-age=86400',
    'access-control-allow-origin': '*',
    'content-disposition': `inline; filename="${safeName}"`,
  }

  if (options.stream && upstream.body) {
    return new Response(upstream.body, { status: 200, headers })
  }

  const buf = await upstream.arrayBuffer()
  if (buf.byteLength > options.maxBytes) {
    return json({ error: '文件过大' }, 413)
  }
  return new Response(buf, { status: 200, headers })
}

export function isGameApi(pathname: string) {
  return (
    pathname === '/api/game/featured' ||
    pathname === '/api/game/list' ||
    pathname === '/api/game/detail' ||
    isRomApiPath(pathname) ||
    isBiosApiPath(pathname)
  )
}

async function handleFcLiveList(url: URL) {
  const page = Number(url.searchParams.get('page') ?? 1)
  const pageSize = Number(url.searchParams.get('pageSize') ?? 20)
  const q = (url.searchParams.get('q') ?? '').trim()
  const genre = (url.searchParams.get('genre') ?? '').trim()

  try {
    if (q) {
      const result = await searchYikmFcGames({
        q,
        page: Number.isFinite(page) ? page : 1,
        pageSize: Number.isFinite(pageSize) ? pageSize : 20,
      })
      return json({
        items: result.items.map((item) => toPublicLiveGame(item)),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        pageCount: result.pageCount,
      })
    }

    const result = await browseYikmFcPage({
      page: Number.isFinite(page) ? page : 1,
      tag: yikmFcTagFromGenre(genre),
    })
    const size = Number.isFinite(pageSize) ? Math.min(60, Math.max(1, Math.trunc(pageSize))) : 20
    const items = result.items.slice(0, size).map((item) => toPublicLiveGame(item))
    return json({
      items,
      total: result.total,
      page: result.page,
      pageSize: size,
      pageCount: result.pageCount,
    })
  } catch (err) {
    console.error('[game api] fc list', err)
    return json({ error: err instanceof Error ? err.message : 'FC 列表加载失败' }, 502)
  }
}

async function handleArcadeLiveList(url: URL) {
  const page = Number(url.searchParams.get('page') ?? 1)
  const pageSize = Number(url.searchParams.get('pageSize') ?? 20)
  const q = (url.searchParams.get('q') ?? '').trim()
  const genre = (url.searchParams.get('genre') ?? '').trim()

  try {
    if (q) {
      const result = await searchYikmArcadeGames({
        q,
        page: Number.isFinite(page) ? page : 1,
        pageSize: Number.isFinite(pageSize) ? pageSize : 20,
      })
      return json({
        items: result.items.map((item) => toPublicLiveGame(item)),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        pageCount: result.pageCount,
      })
    }

    const result = await browseYikmArcadePage({
      page: Number.isFinite(page) ? page : 1,
      tag: yikmArcadeTagFromGenre(genre),
    })
    const size = Number.isFinite(pageSize) ? Math.min(60, Math.max(1, Math.trunc(pageSize))) : 20
    const items = result.items.slice(0, size).map((item) => toPublicLiveGame(item))
    return json({
      items,
      total: result.total,
      page: result.page,
      pageSize: size,
      pageCount: result.pageCount,
    })
  } catch (err) {
    console.error('[game api] arcade list', err)
    return json({ error: err instanceof Error ? err.message : '街机列表加载失败' }, 502)
  }
}

async function handleUnifiedLiveSearch(url: URL) {
  const page = Number(url.searchParams.get('page') ?? 1)
  const pageSize = Number(url.searchParams.get('pageSize') ?? 20)
  const q = (url.searchParams.get('q') ?? '').trim()

  try {
    const result = await searchYikmLiveGames({
      q,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    })
    return json({
      items: result.items.map((item) => toPublicLiveGame(item)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      pageCount: result.pageCount,
    })
  } catch (err) {
    console.error('[game api] live search', err)
    return json({ error: err instanceof Error ? err.message : '搜索失败' }, 502)
  }
}

export async function handleGameApi(request: Request, url: URL, env: { DB: AppDb }) {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (url.pathname === '/api/game/featured') {
    const limit = Number(url.searchParams.get('limit') ?? 12)
    const category = url.searchParams.get('category') ?? ''

    if (category === 'FC') {
      try {
        const result = await browseYikmFcPage({ page: 1, tag: 0 })
        const games = result.items
          .slice(0, Number.isFinite(limit) ? limit : 12)
          .map((item) => toPublicLiveGame(item))
        return json({ games })
      } catch (err) {
        console.error('[game api] fc featured', err)
        return json({ games: [] })
      }
    }

    if (category === '街机') {
      try {
        const result = await browseYikmArcadePage({ page: 1, tag: 9 })
        const games = result.items
          .slice(0, Number.isFinite(limit) ? limit : 12)
          .map((item) => toPublicLiveGame(item))
        return json({ games })
      } catch (err) {
        console.error('[game api] arcade featured', err)
        return json({ games: [] })
      }
    }

    const games = await listFeaturedGames(
      env.DB,
      Number.isFinite(limit) ? limit : 12,
      category || undefined,
    )
    return json({ games })
  }

  if (url.pathname === '/api/game/list') {
    const category = url.searchParams.get('category') ?? ''
    const q = (url.searchParams.get('q') ?? '').trim()

    // 搜索页：FC + 街机合并展示
    if (q && (category === '' || category === 'all')) {
      return handleUnifiedLiveSearch(url)
    }
    if (category === 'FC') return handleFcLiveList(url)
    if (category === '街机') return handleArcadeLiveList(url)

    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 24)
    const genre = url.searchParams.get('genre') ?? ''
    const recommendedParam = url.searchParams.get('recommended')
    const recommended =
      recommendedParam === '1' || recommendedParam === 'true'
        ? true
        : recommendedParam === '0' || recommendedParam === 'false'
          ? false
          : undefined
    const result = await listPublicGames(env.DB, {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 24,
      q,
      category,
      genre,
      recommended,
    })
    return json(result)
  }

  if (url.pathname === '/api/game/detail') {
    const id = url.searchParams.get('id')?.trim() ?? ''
    if (!id) return json({ error: '缺少游戏 id' }, 400)

    const playId = normalizeYikmFcPlayId(id)
    if (playId) {
      try {
        const detail = await resolveYikmLiveDetail(playId)
        if (detail) return json({ game: toPublicLiveGame(detail, detail.downloadUrl) })
      } catch {
        return json({ error: '游戏详情加载失败' }, 502)
      }
    }

    const game = await findGameById(env.DB, id)
    if (!game) return json({ error: '游戏不存在' }, 404)
    return json({ game })
  }

  if (isRomApiPath(url.pathname)) {
    const id = url.searchParams.get('id')?.trim() ?? ''
    if (!id) return json({ error: '缺少游戏 id' }, 400)

    const playId = normalizeYikmFcPlayId(id)
    if (playId) {
      try {
        const detail = await resolveYikmLiveDetail(playId)
        if (!detail) return json({ error: '游戏不存在' }, 404)
        const isArcade = detail.category === '街机'
        const filename = isArcade
          ? arcadeRomsetFileFromDownloadUrl(detail.downloadUrl)
          : `${detail.name}.nes`
        return await proxyBinary(detail.downloadUrl, {
          maxBytes: isArcade ? MAX_ARCADE_ROM_BYTES : MAX_FC_ROM_BYTES,
          filename,
          timeoutMs: isArcade ? 90_000 : 45_000,
          stream: isArcade,
        })
      } catch (err) {
        console.error('[game api] live rom', err)
        return json({ error: 'ROM 不可用' }, 502)
      }
    }

    const game = await findGameById(env.DB, id)
    if (!game) return json({ error: '游戏不存在' }, 404)
    if (game.category !== 'FC' && game.category !== '街机') {
      return json({ error: '当前分类暂不支持在线运行' }, 400)
    }

    try {
      const isArcade = game.category === '街机'
      const filename = isArcade
        ? arcadeRomsetFileFromDownloadUrl(game.downloadUrl)
        : `${game.name}.nes`
      return await proxyBinary(game.downloadUrl, {
        maxBytes: isArcade ? MAX_ARCADE_ROM_BYTES : MAX_FC_ROM_BYTES,
        filename,
        timeoutMs: isArcade ? 90_000 : 45_000,
        stream: isArcade,
      })
    } catch (err) {
      console.error('[game api] rom', err)
      return json({ error: 'ROM 不可用' }, 502)
    }
  }

  if (isBiosApiPath(url.pathname)) {
    const id = url.searchParams.get('id')?.trim() ?? ''
    if (!id) return json({ error: '缺少游戏 id' }, 400)

    let downloadUrl = ''
    const playId = normalizeYikmFcPlayId(id)
    if (playId) {
      try {
        const detail = await resolveYikmLiveDetail(playId)
        if (!detail) return json({ error: '游戏不存在' }, 404)
        if (detail.category !== '街机') return json({ error: '仅街机需要 BIOS' }, 400)
        downloadUrl = detail.downloadUrl
      } catch (err) {
        console.error('[game api] live bios', err)
        return json({ error: 'BIOS 不可用' }, 502)
      }
    } else {
      const game = await findGameById(env.DB, id)
      if (!game) return json({ error: '游戏不存在' }, 404)
      if (game.category !== '街机') return json({ error: '仅街机需要 BIOS' }, 400)
      downloadUrl = game.downloadUrl
    }

    const biosFile = arcadeBiosFileFromDownloadUrl(downloadUrl)
    if (!biosFile) return json({ error: '该游戏无需 BIOS' }, 404)

    try {
      return await proxyBinary(`${BIOS_CDN}/${biosFile}`, {
        maxBytes: MAX_BIOS_BYTES,
        filename: biosFile,
        timeoutMs: 60_000,
        stream: true,
      })
    } catch (err) {
      console.error('[game api] bios', err)
      return json({ error: 'BIOS 不可用' }, 502)
    }
  }

  return json({ error: 'Not found' }, 404)
}
