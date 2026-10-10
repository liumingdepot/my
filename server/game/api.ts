import type { AppDb } from '../utils/db.js'
import { fetchYikmGameCheats } from './cheat.js'
import { findGameById, listFeaturedGames, listPublicGames } from './games.js'
import {
  browseYikmArcadePage,
  browseYikmFcPage,
  browseYikmJavaPage,
  browseYikmWebPage,
  buildYikmJavaEmbedHtml,
  normalizeYikmFcPlayId,
  resolveYikmLiveDetail,
  searchYikmArcadeGames,
  searchYikmFcGames,
  searchYikmJavaGames,
  searchYikmLiveGames,
  searchYikmWebGames,
  yikmArcadeTagFromGenre,
  yikmFcTagFromGenre,
  yikmJavaTagFromGenre,
  yikmWebTagFromGenre,
} from './scrape.js'
import { mergeZipBuffers } from './zipMerge.js'

const ROM_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const MAX_FC_ROM_BYTES = 4 * 1024 * 1024
const MAX_ARCADE_ROM_BYTES = 64 * 1024 * 1024
/** 拳皇 wing 等 Flash 约 40MB+ */
const MAX_WEB_ROM_BYTES = 64 * 1024 * 1024
/** Java MIDlet JAR */
const MAX_JAVA_ROM_BYTES = 32 * 1024 * 1024
const MAX_BIOS_BYTES = 8 * 1024 * 1024
const BIOS_CDN = 'https://file.1990i.com/fbneobios'
const FLASHROM_CDN = 'https://file.1990i.com/flashrom'

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

function isFlashromApiPath(pathname: string) {
  return pathname === '/api/game/flashrom' || pathname.startsWith('/api/game/flashrom/')
}

/** 浏览器侧 Ruffle 相对资源根（同域代理）；无 rombase 时为空 */
function flashBaseForClient(rombase?: string) {
  const base = (rombase ?? '').trim().replace(/^\/+|\/+$/g, '')
  if (!base) return ''
  return `/api/game/flashrom/${base
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')}/`
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
    category: 'FC' | '街机' | '网页游戏' | '怀旧java'
    downloadUrl?: string
    rombase?: string
  },
  downloadUrl = '',
) {
  const flashBase = item.category === '网页游戏' ? flashBaseForClient(item.rombase) : ''
  return {
    id: item.id,
    name: item.name,
    downloadUrl: downloadUrl || item.downloadUrl || '',
    imageUrl: item.imageUrl,
    category: item.category,
    genre: item.genre,
    flashBase,
    sortOrder: 0,
    recommended: false,
    createdAt: '',
    updatedAt: '',
  }
}

async function fetchUpstreamBytes(upstreamUrl: string, timeoutMs: number) {
  const upstream = await fetch(upstreamUrl, {
    headers: {
      'user-agent': ROM_UA,
      accept: '*/*',
      referer: 'https://www.yikm.net/',
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!upstream.ok) {
    throw new Error(`文件拉取失败 (${upstream.status})`)
  }
  return {
    bytes: new Uint8Array(await upstream.arrayBuffer()),
    contentType: upstream.headers.get('content-type') || 'application/octet-stream',
  }
}

function binaryResponseHeaders(filename: string, contentType: string, contentLength?: string | number) {
  const safeName = filename.replace(/[^\w.\-]+/g, '_')
  const headers: Record<string, string> = {
    'content-type': contentType || 'application/octet-stream',
    'cache-control': 'public, max-age=86400',
    'access-control-allow-origin': '*',
    'content-disposition': `inline; filename="${safeName}"`,
  }
  if (contentLength !== undefined && contentLength !== '') {
    headers['content-length'] = String(contentLength)
  }
  return headers
}

/**
 * EmulatorJS stable 会把 EJS_biosUrl 的 zip 解压成散文件，FBNeo 认不到 pgm/neogeo romset。
 * 将 BIOS 条目并入游戏 zip 后，FBNeo 可从同一 romset 内读到所需文件。
 */
async function proxyArcadeRomWithBios(
  downloadUrl: string,
  filename: string,
  timeoutMs: number,
  headOnly = false,
) {
  const safeName = filename.replace(/[^\w.\-]+/g, '_')

  // EmulatorJS 先 HEAD 探活；合并后的体积与上游不一致，HEAD 不返回 content-length，避免错误命中本地缓存
  if (headOnly) {
    const upstream = await fetch(downloadUrl, {
      method: 'HEAD',
      headers: {
        'user-agent': ROM_UA,
        accept: '*/*',
        referer: 'https://www.yikm.net/',
      },
      signal: AbortSignal.timeout(Math.min(timeoutMs, 30_000)),
    })
    if (!upstream.ok) {
      return json({ error: `文件拉取失败 (${upstream.status})` }, 502)
    }
    return new Response(null, {
      status: 200,
      headers: binaryResponseHeaders(safeName, 'application/zip'),
    })
  }

  const biosFile = arcadeBiosFileFromDownloadUrl(downloadUrl)
  const rom = await fetchUpstreamBytes(downloadUrl, timeoutMs)
  if (rom.bytes.byteLength > MAX_ARCADE_ROM_BYTES) {
    return json({ error: '文件过大' }, 413)
  }

  let body = rom.bytes
  if (biosFile) {
    try {
      const bios = await fetchUpstreamBytes(`${BIOS_CDN}/${biosFile}`, Math.min(timeoutMs, 60_000))
      if (bios.bytes.byteLength <= MAX_BIOS_BYTES) {
        body = mergeZipBuffers(rom.bytes, bios.bytes)
      }
    } catch (err) {
      console.warn('[game api] arcade bios merge skipped', err)
    }
  }

  if (body.byteLength > MAX_ARCADE_ROM_BYTES + MAX_BIOS_BYTES) {
    return json({ error: '文件过大' }, 413)
  }

  return new Response(body, {
    status: 200,
    headers: binaryResponseHeaders(safeName, 'application/zip', body.byteLength),
  })
}

async function proxyBinary(
  upstreamUrl: string,
  options: {
    maxBytes: number
    filename: string
    timeoutMs?: number
    stream?: boolean
    headOnly?: boolean
  },
) {
  const method = options.headOnly ? 'HEAD' : 'GET'
  const upstream = await fetch(upstreamUrl, {
    method,
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
  const headers = binaryResponseHeaders(
    options.filename,
    upstream.headers.get('content-type') || 'application/octet-stream',
    lengthHeader || undefined,
  )

  if (options.headOnly) {
    return new Response(null, { status: 200, headers })
  }

  if (options.stream && upstream.body) {
    return new Response(upstream.body, { status: 200, headers })
  }

  const buf = await upstream.arrayBuffer()
  if (buf.byteLength > options.maxBytes) {
    return json({ error: '文件过大' }, 413)
  }
  return new Response(buf, {
    status: 200,
    headers: binaryResponseHeaders(
      options.filename,
      headers['content-type'] || 'application/octet-stream',
      buf.byteLength,
    ),
  })
}

export function isGameApi(pathname: string) {
  return (
    pathname === '/api/game/featured' ||
    pathname === '/api/game/list' ||
    pathname === '/api/game/detail' ||
    pathname === '/api/game/cheat' ||
    pathname === '/api/game/java-embed' ||
    isRomApiPath(pathname) ||
    isBiosApiPath(pathname) ||
    isFlashromApiPath(pathname)
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

async function handleWebLiveList(url: URL) {
  const page = Number(url.searchParams.get('page') ?? 1)
  const pageSize = Number(url.searchParams.get('pageSize') ?? 20)
  const q = (url.searchParams.get('q') ?? '').trim()
  const genre = (url.searchParams.get('genre') ?? '').trim()

  try {
    if (q) {
      const result = await searchYikmWebGames({
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

    const result = await browseYikmWebPage({
      page: Number.isFinite(page) ? page : 1,
      tag: yikmWebTagFromGenre(genre),
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
    console.error('[game api] web list', err)
    return json({ error: err instanceof Error ? err.message : '网页游戏列表加载失败' }, 502)
  }
}

async function handleJavaLiveList(url: URL) {
  const page = Number(url.searchParams.get('page') ?? 1)
  const pageSize = Number(url.searchParams.get('pageSize') ?? 20)
  const q = (url.searchParams.get('q') ?? '').trim()
  const genre = (url.searchParams.get('genre') ?? '').trim()

  try {
    if (q) {
      const result = await searchYikmJavaGames({
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

    const result = await browseYikmJavaPage({
      page: Number.isFinite(page) ? page : 1,
      tag: yikmJavaTagFromGenre(genre),
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
    console.error('[game api] java list', err)
    return json({ error: err instanceof Error ? err.message : '怀旧java 列表加载失败' }, 502)
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
  const isAssetPath =
    isRomApiPath(url.pathname) || isBiosApiPath(url.pathname) || isFlashromApiPath(url.pathname)
  // EmulatorJS 下载 ROM/BIOS 前会发 HEAD 探测 content-length
  if (request.method !== 'GET' && !(request.method === 'HEAD' && isAssetPath)) {
    return json({ error: 'Method not allowed' }, 405)
  }
  const headOnly = request.method === 'HEAD'

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

    if (category === '网页游戏') {
      try {
        const result = await browseYikmWebPage({ page: 1, tag: '' })
        const games = result.items
          .slice(0, Number.isFinite(limit) ? limit : 12)
          .map((item) => toPublicLiveGame(item))
        return json({ games })
      } catch (err) {
        console.error('[game api] web featured', err)
        return json({ games: [] })
      }
    }

    if (category === '怀旧java') {
      try {
        const result = await browseYikmJavaPage({ page: 1, tag: '' })
        const games = result.items
          .slice(0, Number.isFinite(limit) ? limit : 12)
          .map((item) => toPublicLiveGame(item))
        return json({ games })
      } catch (err) {
        console.error('[game api] java featured', err)
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

    // 搜索页：FC + 街机 + 网页游戏 + 怀旧java 合并展示
    if (q && (category === '' || category === 'all')) {
      return handleUnifiedLiveSearch(url)
    }
    if (category === 'FC') return handleFcLiveList(url)
    if (category === '街机') return handleArcadeLiveList(url)
    if (category === '网页游戏') return handleWebLiveList(url)
    if (category === '怀旧java') return handleJavaLiveList(url)

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

  if (url.pathname === '/api/game/cheat') {
    const id = url.searchParams.get('id')?.trim() ?? ''
    if (!id) return json({ error: '缺少游戏 id' }, 400)

    const playId = normalizeYikmFcPlayId(id)
    // 非 yikm playId（本地入库数据）没有金手指源，返回空列表而非报错
    if (!playId) return json({ cheats: [] })

    try {
      const cheats = await fetchYikmGameCheats(playId)
      return json({ cheats })
    } catch (err) {
      console.error('[game api] cheat', err)
      return json({ cheats: [] })
    }
  }

  if (url.pathname === '/api/game/java-embed') {
    const id = url.searchParams.get('id')?.trim() ?? ''
    const playId = normalizeYikmFcPlayId(id)
    if (!playId) return json({ error: '缺少游戏 id' }, 400)

    try {
      const detail = await resolveYikmLiveDetail(playId)
      if (!detail || detail.category !== '怀旧java') {
        return json({ error: '游戏不存在或不是怀旧java' }, 404)
      }
      const jarName = decodeURIComponent(detail.downloadUrl.split('/').pop() || 'game.jar')
      const jarUrl = `/api/game/rom/${encodeURIComponent(jarName)}?id=${encodeURIComponent(playId)}`
      const html = await buildYikmJavaEmbedHtml({ playId, jarUrl })
      if (!html) return json({ error: '嵌入页生成失败' }, 502)
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
          'X-Frame-Options': 'SAMEORIGIN',
          // jQuery / j2me 会注册 unload；Chrome 默认在 iframe 里拦截
          'Permissions-Policy': 'unload=*, autoplay=*, fullscreen=*, gamepad=*',
        },
      })
    } catch (err) {
      console.error('[game api] java-embed', err)
      return json({ error: err instanceof Error ? err.message : '嵌入页加载失败' }, 502)
    }
  }

  if (isRomApiPath(url.pathname)) {
    const id = url.searchParams.get('id')?.trim() ?? ''
    if (!id) return json({ error: '缺少游戏 id' }, 400)

    const playId = normalizeYikmFcPlayId(id)
    if (playId) {
      try {
        const detail = await resolveYikmLiveDetail(playId)
        if (!detail) return json({ error: '游戏不存在' }, 404)
        if (detail.category === '网页游戏') {
          const filename = detail.downloadUrl.split('/').pop() || 'game.swf'
          return await proxyBinary(detail.downloadUrl, {
            maxBytes: MAX_WEB_ROM_BYTES,
            filename: decodeURIComponent(filename),
            timeoutMs: 180_000,
            stream: true,
            headOnly,
          })
        }
        if (detail.category === '怀旧java') {
          const filename = detail.downloadUrl.split('/').pop() || 'game.jar'
          return await proxyBinary(detail.downloadUrl, {
            maxBytes: MAX_JAVA_ROM_BYTES,
            filename: decodeURIComponent(filename),
            timeoutMs: 180_000,
            stream: true,
            headOnly,
          })
        }
        if (detail.category === '街机') {
          const filename = arcadeRomsetFileFromDownloadUrl(detail.downloadUrl)
          return await proxyArcadeRomWithBios(detail.downloadUrl, filename, 90_000, headOnly)
        }
        return await proxyBinary(detail.downloadUrl, {
          maxBytes: MAX_FC_ROM_BYTES,
          filename: `${detail.name}.nes`,
          timeoutMs: 45_000,
          headOnly,
        })
      } catch (err) {
        console.error('[game api] live rom', err)
        return json({ error: 'ROM 不可用' }, 502)
      }
    }

    const game = await findGameById(env.DB, id)
    if (!game) return json({ error: '游戏不存在' }, 404)
    if (
      game.category !== 'FC' &&
      game.category !== '街机' &&
      game.category !== '网页游戏' &&
      game.category !== '怀旧java'
    ) {
      return json({ error: '当前分类暂不支持在线运行' }, 400)
    }

    try {
      if (game.category === '网页游戏') {
        const filename = game.downloadUrl.split('/').pop() || 'game.swf'
        return await proxyBinary(game.downloadUrl, {
          maxBytes: MAX_WEB_ROM_BYTES,
          filename: decodeURIComponent(filename),
          timeoutMs: 180_000,
          stream: true,
          headOnly,
        })
      }
      if (game.category === '怀旧java') {
        const filename = game.downloadUrl.split('/').pop() || 'game.jar'
        return await proxyBinary(game.downloadUrl, {
          maxBytes: MAX_JAVA_ROM_BYTES,
          filename: decodeURIComponent(filename),
          timeoutMs: 180_000,
          stream: true,
          headOnly,
        })
      }
      if (game.category === '街机') {
        const filename = arcadeRomsetFileFromDownloadUrl(game.downloadUrl)
        return await proxyArcadeRomWithBios(game.downloadUrl, filename, 90_000, headOnly)
      }
      return await proxyBinary(game.downloadUrl, {
        maxBytes: MAX_FC_ROM_BYTES,
        filename: `${game.name}.nes`,
        timeoutMs: 45_000,
        headOnly,
      })
    } catch (err) {
      console.error('[game api] rom', err)
      return json({ error: 'ROM 不可用' }, 502)
    }
  }

  if (isFlashromApiPath(url.pathname)) {
    const prefix = '/api/game/flashrom/'
    if (!url.pathname.startsWith(prefix)) {
      return json({ error: '缺少资源路径' }, 400)
    }
    const rel = decodeURIComponent(url.pathname.slice(prefix.length)).replace(/^\/+/, '')
    if (!rel || rel.includes('..') || rel.includes('\\')) {
      return json({ error: '非法资源路径' }, 400)
    }
    const upstream = `${FLASHROM_CDN}/${rel
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/')}`
    const filename = rel.split('/').pop() || 'asset.bin'
    try {
      return await proxyBinary(upstream, {
        maxBytes: MAX_WEB_ROM_BYTES,
        filename,
        timeoutMs: 180_000,
        stream: true,
        headOnly,
      })
    } catch (err) {
      console.error('[game api] flashrom', err)
      return json({ error: 'Flash 资源不可用' }, 502)
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
        headOnly,
      })
    } catch (err) {
      console.error('[game api] bios', err)
      return json({ error: 'BIOS 不可用' }, 502)
    }
  }

  return json({ error: 'Not found' }, 404)
}
