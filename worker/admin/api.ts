import { verifyPassword } from './password.js'
import { ensureSchema } from './schema.js'
import {
  buildSessionCookie,
  clearSessionCookie,
  createSession,
  destroySession,
  requireSession,
} from './session.js'
import { json, toPublicUser, type AdminEnv } from './types.js'
import {
  createUser,
  deleteUser,
  findById,
  findByUsername,
  isRole,
  isStatus,
  listUsers,
  updateUser,
  updateUserStatus,
} from './users.js'
import {
  createVideoSource,
  deleteVideoSource,
  findVideoSourceById,
  listVideoSources,
  patchVideoSourceEnabled,
  updateVideoSource,
} from '../video/sources.js'
import {
  createGame,
  deleteGame,
  findGameById,
  importedGameId,
  isGameCategory,
  listGames,
  setGameRecommended,
  updateGame,
  upsertGame,
  type GameCategory,
} from '../game/games.js'
import { scrapeYikmFcGames } from '../game/scrape.js'
import {
  createEducationSource,
  deleteEducationSource,
  findEducationSourceById,
  listEducationSources,
  resolveEducationExtInput,
  resolveEducationImport,
  updateEducationSource,
} from '../education/sources.js'
import { getEducationCookie, setEducationCookie } from '../education/config.js'

function isSecure(request: Request) {
  return new URL(request.url).protocol === 'https:'
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

export function isAdminApi(pathname: string) {
  return pathname === '/api/admin' || pathname.startsWith('/api/admin/')
}

export async function handleAdminApi(request: Request, env: AdminEnv) {
  await ensureSchema(env)

  const url = new URL(request.url)
  const { pathname } = url
  const method = request.method.toUpperCase()

  if (pathname === '/api/admin/login' && method === 'POST') {
    return handleLogin(request, env)
  }
  if (pathname === '/api/admin/logout' && method === 'POST') {
    return handleLogout(request, env)
  }
  if (pathname === '/api/admin/me' && method === 'GET') {
    return handleMe(request, env)
  }
  if (pathname === '/api/admin/users' && method === 'GET') {
    return handleListUsers(request, env)
  }
  if (pathname === '/api/admin/users' && method === 'POST') {
    return handleCreateUser(request, env)
  }

  const userMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
  if (userMatch) {
    const id = decodeURIComponent(userMatch[1]!)
    if (method === 'PUT') return handleUpdateUser(request, env, id)
    if (method === 'DELETE') return handleDeleteUser(request, env, id)
  }

  const statusMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/status$/)
  if (statusMatch && method === 'PATCH') {
    return handlePatchStatus(request, env, decodeURIComponent(statusMatch[1]!))
  }

  if (pathname === '/api/admin/video-sources' && method === 'GET') {
    return handleListVideoSources(request, env)
  }
  if (pathname === '/api/admin/video-sources' && method === 'POST') {
    return handleCreateVideoSource(request, env)
  }

  const sourceMatch = pathname.match(/^\/api\/admin\/video-sources\/([^/]+)$/)
  if (sourceMatch) {
    const id = decodeURIComponent(sourceMatch[1]!)
    if (method === 'PUT') return handleUpdateVideoSource(request, env, id)
    if (method === 'DELETE') return handleDeleteVideoSource(request, env, id)
  }

  const sourceEnabledMatch = pathname.match(/^\/api\/admin\/video-sources\/([^/]+)\/enabled$/)
  if (sourceEnabledMatch && method === 'PATCH') {
    return handlePatchVideoSourceEnabled(
      request,
      env,
      decodeURIComponent(sourceEnabledMatch[1]!),
    )
  }

  if (pathname === '/api/admin/games' && method === 'GET') {
    return handleListGames(request, env)
  }
  if (pathname === '/api/admin/games' && method === 'POST') {
    return handleCreateGame(request, env)
  }
  if (pathname === '/api/admin/games/import-yikm' && method === 'POST') {
    return handleImportYikmGames(request, env)
  }

  const gameRecommendedMatch = pathname.match(/^\/api\/admin\/games\/([^/]+)\/recommended$/)
  if (gameRecommendedMatch && method === 'PATCH') {
    return handlePatchGameRecommended(
      request,
      env,
      decodeURIComponent(gameRecommendedMatch[1]!),
    )
  }

  const gameMatch = pathname.match(/^\/api\/admin\/games\/([^/]+)$/)
  if (gameMatch) {
    const id = decodeURIComponent(gameMatch[1]!)
    if (method === 'PUT') return handleUpdateGame(request, env, id)
    if (method === 'DELETE') return handleDeleteGame(request, env, id)
  }

  if (pathname === '/api/admin/education-sources' && method === 'GET') {
    return handleListEducationSources(request, env)
  }
  if (pathname === '/api/admin/education-sources' && method === 'POST') {
    return handleCreateEducationSource(request, env)
  }
  if (pathname === '/api/admin/education-sources/import' && method === 'POST') {
    return handleImportEducationSources(request, env)
  }

  if (pathname === '/api/admin/education-cookie' && method === 'GET') {
    return handleGetEducationCookie(request, env)
  }
  if (pathname === '/api/admin/education-cookie' && method === 'PUT') {
    return handlePutEducationCookie(request, env)
  }

  const educationMatch = pathname.match(/^\/api\/admin\/education-sources\/([^/]+)$/)
  if (educationMatch) {
    const id = decodeURIComponent(educationMatch[1]!)
    if (method === 'PUT') return handleUpdateEducationSource(request, env, id)
    if (method === 'DELETE') return handleDeleteEducationSource(request, env, id)
  }

  return json({ error: 'Not found' }, 404)
}

async function handleLogin(request: Request, env: AdminEnv) {
  const body = await readJson<{ username?: string; password?: string }>(request)
  const username = body?.username?.trim() ?? ''
  const password = body?.password ?? ''
  if (!username || !password) {
    return json({ error: '请填写用户名和密码' }, 400)
  }

  const user = await findByUsername(env.DB, username)
  if (!user || user.status !== 'active') {
    return json({ error: '用户名或密码错误' }, 401)
  }
  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) {
    return json({ error: '用户名或密码错误' }, 401)
  }

  const token = await createSession(env, {
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
  })

  return json(
    {
      user: toPublicUser(user),
      loggedInAt: new Date().toISOString(),
    },
    200,
    {
      'Set-Cookie': buildSessionCookie(token, isSecure(request)),
    },
  )
}

async function handleLogout(request: Request, env: AdminEnv) {
  await destroySession(env, request)
  return json(
    { ok: true },
    200,
    {
      'Set-Cookie': clearSessionCookie(isSecure(request)),
    },
  )
}

async function handleMe(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)
  const user = await findById(env.DB, session.userId)
  if (!user || user.status !== 'active') {
    await destroySession(env, request)
    return json({ error: '未登录' }, 401, { 'Set-Cookie': clearSessionCookie(isSecure(request)) })
  }
  return json({ user: toPublicUser(user) })
}

async function handleListUsers(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)
  const users = await listUsers(env.DB)
  return json({ users })
}

async function handleCreateUser(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const body = await readJson<{
    username?: string
    displayName?: string
    email?: string
    password?: string
    role?: string
    status?: string
  }>(request)

  const username = body?.username?.trim() ?? ''
  const displayName = body?.displayName?.trim() ?? ''
  const email = body?.email?.trim() ?? ''
  const password = body?.password ?? ''
  const role = body?.role
  const status = body?.status ?? 'active'

  if (!username) return json({ error: '请填写用户名' }, 400)
  if (!displayName) return json({ error: '请填写显示名称' }, 400)
  if (!password || password.length < 6) return json({ error: '密码至少 6 位' }, 400)
  if (!isRole(role)) return json({ error: '角色无效' }, 400)
  if (!isStatus(status)) return json({ error: '状态无效' }, 400)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: '邮箱格式不正确' }, 400)
  }

  const exists = await findByUsername(env.DB, username)
  if (exists) return json({ error: '用户名已存在' }, 409)

  try {
    const user = await createUser(env.DB, {
      username,
      displayName,
      email,
      password,
      role,
      status,
    })
    return json({ user }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('UNIQUE')) return json({ error: '用户名已存在' }, 409)
    return json({ error: '创建失败' }, 500)
  }
}

async function handleUpdateUser(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const existing = await findById(env.DB, id)
  if (!existing) return json({ error: '用户不存在' }, 404)

  const body = await readJson<{
    username?: string
    displayName?: string
    email?: string
    password?: string
    role?: string
    status?: string
  }>(request)

  const username = body?.username?.trim() ?? ''
  const displayName = body?.displayName?.trim() ?? ''
  const email = body?.email?.trim() ?? ''
  const password = body?.password?.trim() || undefined
  const role = body?.role
  const status = body?.status

  if (!username) return json({ error: '请填写用户名' }, 400)
  if (!displayName) return json({ error: '请填写显示名称' }, 400)
  if (!isRole(role)) return json({ error: '角色无效' }, 400)
  if (!isStatus(status)) return json({ error: '状态无效' }, 400)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: '邮箱格式不正确' }, 400)
  }
  if (password !== undefined && password.length < 6) {
    return json({ error: '密码至少 6 位' }, 400)
  }

  const conflict = await findByUsername(env.DB, username)
  if (conflict && conflict.id !== id) return json({ error: '用户名已存在' }, 409)

  try {
    const user = await updateUser(env.DB, id, {
      username,
      displayName,
      email,
      role,
      status,
      password,
    })
    return json({ user })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('UNIQUE')) return json({ error: '用户名已存在' }, 409)
    return json({ error: '更新失败' }, 500)
  }
}

async function handlePatchStatus(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const existing = await findById(env.DB, id)
  if (!existing) return json({ error: '用户不存在' }, 404)

  const body = await readJson<{ status?: string }>(request)
  if (!isStatus(body?.status)) return json({ error: '状态无效' }, 400)

  if (session.userId === id && body.status === 'disabled') {
    return json({ error: '不能停用当前登录账号' }, 400)
  }

  const user = await updateUserStatus(env.DB, id, body.status)
  return json({ user })
}

async function handleDeleteUser(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  if (session.userId === id) {
    return json({ error: '不能删除当前登录账号' }, 400)
  }

  const existing = await findById(env.DB, id)
  if (!existing) return json({ error: '用户不存在' }, 404)

  const ok = await deleteUser(env.DB, id)
  if (!ok) return json({ error: '删除失败' }, 500)
  return json({ ok: true })
}

type VideoSourceBody = {
  name?: string
  url?: string
  enabled?: boolean
  sortOrder?: number
}

function parseVideoSourceBody(body: VideoSourceBody | null) {
  const name = body?.name?.trim() ?? ''
  const url = body?.url?.trim() ?? ''
  const enabled = body?.enabled !== false
  const sortOrder = Number.isFinite(body?.sortOrder) ? Number(body?.sortOrder) : 0
  return { name, url, enabled, sortOrder }
}

async function handleListVideoSources(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)
  const sources = await listVideoSources(env.DB)
  return json({ sources })
}

async function handleCreateVideoSource(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const body = await readJson<VideoSourceBody>(request)
  const input = parseVideoSourceBody(body)
  if (!input.name) return json({ error: '请填写名称' }, 400)
  if (!input.url) return json({ error: '请填写接口地址' }, 400)

  try {
    const source = await createVideoSource(env.DB, input)
    await invalidateVideoSourceCache(env)
    return json({ source }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建失败'
    if (message.includes('已存在')) return json({ error: message }, 409)
    if (message.includes('URL')) return json({ error: message }, 400)
    return json({ error: message }, 500)
  }
}

async function handleUpdateVideoSource(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const existing = await findVideoSourceById(env.DB, id)
  if (!existing) return json({ error: '采集源不存在' }, 404)

  const body = await readJson<VideoSourceBody>(request)
  const input = parseVideoSourceBody(body)
  if (!input.name) return json({ error: '请填写名称' }, 400)
  if (!input.url) return json({ error: '请填写接口地址' }, 400)

  try {
    const source = await updateVideoSource(env.DB, id, input)
    await invalidateVideoSourceCache(env)
    return json({ source })
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新失败'
    if (message.includes('已存在')) return json({ error: message }, 409)
    if (message.includes('URL') || message.includes('不存在')) return json({ error: message }, 400)
    return json({ error: message }, 500)
  }
}

async function handlePatchVideoSourceEnabled(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const existing = await findVideoSourceById(env.DB, id)
  if (!existing) return json({ error: '采集源不存在' }, 404)

  const body = await readJson<{ enabled?: boolean }>(request)
  if (typeof body?.enabled !== 'boolean') return json({ error: '状态无效' }, 400)

  try {
    const source = await patchVideoSourceEnabled(env.DB, id, body.enabled)
    await invalidateVideoSourceCache(env)
    return json({ source })
  } catch (error) {
    const message = error instanceof Error ? error.message : '操作失败'
    return json({ error: message }, 500)
  }
}

async function handleDeleteVideoSource(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const existing = await findVideoSourceById(env.DB, id)
  if (!existing) return json({ error: '采集源不存在' }, 404)

  const ok = await deleteVideoSource(env.DB, id)
  if (!ok) return json({ error: '删除失败' }, 500)
  await invalidateVideoSourceCache(env)
  return json({ ok: true })
}

function isHttpUrl(value: string) {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

async function invalidateVideoSourceCache(env: AdminEnv) {
  try {
    await env.KV.delete('video:sources')
  } catch (err) {
    console.error('[admin] invalidate video cache', err)
  }
}

type GameBody = {
  name?: string
  downloadUrl?: string
  imageUrl?: string
  category?: string
  genre?: string
  recommended?: boolean
}

function parseGameBody(body: GameBody | null) {
  const name = body?.name?.trim() ?? ''
  const downloadUrl = body?.downloadUrl?.trim() ?? ''
  const imageUrl = body?.imageUrl?.trim() ?? ''
  const category = body?.category?.trim() ?? ''
  const genre = body?.genre?.trim() ?? ''
  const recommended = Boolean(body?.recommended)
  return { name, downloadUrl, imageUrl, category, genre, recommended }
}

async function handleListGames(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)
  const games = await listGames(env.DB)
  return json({ games })
}

async function handleCreateGame(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const body = await readJson<GameBody>(request)
  const input = parseGameBody(body)
  if (!input.name) return json({ error: '请填写游戏名称' }, 400)
  if (!input.downloadUrl) return json({ error: '请填写游戏下载地址' }, 400)
  if (!isHttpUrl(input.downloadUrl)) return json({ error: '下载地址需为有效的 http(s) 链接' }, 400)
  if (input.imageUrl && !isHttpUrl(input.imageUrl)) {
    return json({ error: '游戏图片需为有效的 http(s) 链接' }, 400)
  }
  if (!isGameCategory(input.category)) return json({ error: '请选择游戏分类' }, 400)
  if (!input.genre) return json({ error: '请填写游戏类型' }, 400)

  try {
    const game = await createGame(env.DB, {
      name: input.name,
      downloadUrl: input.downloadUrl,
      imageUrl: input.imageUrl,
      category: input.category as GameCategory,
      genre: input.genre,
      recommended: input.recommended,
    })
    return json({ game }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建失败'
    return json({ error: message }, 500)
  }
}

async function handleUpdateGame(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const existing = await findGameById(env.DB, id)
  if (!existing) return json({ error: '游戏不存在' }, 404)

  const body = await readJson<GameBody>(request)
  const input = parseGameBody(body)
  if (!input.name) return json({ error: '请填写游戏名称' }, 400)
  if (!input.downloadUrl) return json({ error: '请填写游戏下载地址' }, 400)
  if (!isHttpUrl(input.downloadUrl)) return json({ error: '下载地址需为有效的 http(s) 链接' }, 400)
  if (input.imageUrl && !isHttpUrl(input.imageUrl)) {
    return json({ error: '游戏图片需为有效的 http(s) 链接' }, 400)
  }
  if (!isGameCategory(input.category)) return json({ error: '请选择游戏分类' }, 400)
  if (!input.genre) return json({ error: '请填写游戏类型' }, 400)

  try {
    const game = await updateGame(env.DB, id, {
      name: input.name,
      downloadUrl: input.downloadUrl,
      imageUrl: input.imageUrl,
      category: input.category as GameCategory,
      genre: input.genre,
      recommended: input.recommended,
    })
    return json({ game })
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新失败'
    if (message.includes('不存在')) return json({ error: message }, 404)
    return json({ error: message }, 500)
  }
}

async function handlePatchGameRecommended(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const existing = await findGameById(env.DB, id)
  if (!existing) return json({ error: '游戏不存在' }, 404)

  const body = await readJson<{ recommended?: boolean }>(request)
  if (typeof body?.recommended !== 'boolean') {
    return json({ error: '请指定是否推荐' }, 400)
  }

  try {
    const game = await setGameRecommended(env.DB, id, body.recommended)
    return json({ game })
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新失败'
    return json({ error: message }, 500)
  }
}

async function handleDeleteGame(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const existing = await findGameById(env.DB, id)
  if (!existing) return json({ error: '游戏不存在' }, 404)

  const ok = await deleteGame(env.DB, id)
  if (!ok) return json({ error: '删除失败' }, 500)
  return json({ ok: true })
}

type ImportYikmBody = {
  fromPage?: number
  toPage?: number
}

async function handleImportYikmGames(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const body = await readJson<ImportYikmBody>(request)
  const fromPage = Number(body?.fromPage ?? 1)
  const toPage = Number(body?.toPage ?? 10)
  if (!Number.isFinite(fromPage) || !Number.isFinite(toPage) || fromPage < 1 || toPage < fromPage) {
    return json({ error: '分页参数无效' }, 400)
  }
  if (toPage - fromPage > 9) {
    return json({ error: '单次最多采集 10 页' }, 400)
  }

  try {
    const scraped = await scrapeYikmFcGames({ fromPage, toPage, category: 'FC' })
    let created = 0
    let updated = 0
    for (const item of scraped) {
      const id = importedGameId('yikm', item.sourceId)
      const result = await upsertGame(env.DB, id, {
        name: item.name,
        downloadUrl: item.downloadUrl,
        imageUrl: item.imageUrl,
        category: item.category,
        genre: item.genre,
      })
      if (result.created) created += 1
      else updated += 1
    }
    const games = await listGames(env.DB)
    return json({
      ok: true,
      scraped: scraped.length,
      created,
      updated,
      fromPage,
      toPage,
      games,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '采集失败'
    return json({ error: message }, 502)
  }
}

type EducationBody = {
  name?: string
  ext?: string
  sortOrder?: number
}

async function handleListEducationSources(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)
  const sources = await listEducationSources(env.DB)
  return json({ sources })
}

async function handleCreateEducationSource(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const body = await readJson<EducationBody>(request)
  const resolved = await resolveEducationExtInput(body?.ext ?? '', body?.name?.trim() ?? '')
  if (!resolved.ok) return json({ error: resolved.error }, 400)

  const sortOrder = Number(body?.sortOrder ?? 0)
  if (!Number.isFinite(sortOrder)) return json({ error: '排序需为数字' }, 400)

  try {
    const source = await createEducationSource(env.DB, {
      name: resolved.name,
      ext: resolved.ext,
      sortOrder: Math.trunc(sortOrder),
    })
    return json({ source }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建失败'
    if (message.includes('已存在')) return json({ error: message }, 409)
    return json({ error: message }, 500)
  }
}

async function handleUpdateEducationSource(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const existing = await findEducationSourceById(env.DB, id)
  if (!existing) return json({ error: '教育源不存在' }, 404)

  const body = await readJson<EducationBody>(request)
  const resolved = await resolveEducationExtInput(
    body?.ext ?? '',
    body?.name?.trim() || existing.name,
  )
  if (!resolved.ok) return json({ error: resolved.error }, 400)

  const sortOrder = Number(body?.sortOrder ?? existing.sortOrder)
  if (!Number.isFinite(sortOrder)) return json({ error: '排序需为数字' }, 400)

  try {
    const source = await updateEducationSource(env.DB, id, {
      name: resolved.name,
      ext: resolved.ext,
      sortOrder: Math.trunc(sortOrder),
    })
    return json({ source })
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新失败'
    if (message.includes('不存在')) return json({ error: message }, 404)
    if (message.includes('已存在')) return json({ error: message }, 409)
    return json({ error: message }, 500)
  }
}

async function handleImportEducationSources(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const body = await readJson<{ raw?: string }>(request)
  const raw = typeof body?.raw === 'string' ? body.raw : ''
  const resolved = await resolveEducationImport(raw)
  if (!resolved.ok) return json({ error: resolved.error }, 400)

  const existing = await listEducationSources(env.DB)
  const byName = new Map(existing.map((item) => [item.name.toLowerCase(), item]))
  let nextOrder =
    existing.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1

  const created: Awaited<ReturnType<typeof createEducationSource>>[] = []
  const updated: Awaited<ReturnType<typeof updateEducationSource>>[] = []
  const failed = [...resolved.failed]

  for (const site of resolved.sites) {
    const prev = byName.get(site.name.toLowerCase())
    try {
      if (prev) {
        const source = await updateEducationSource(env.DB, prev.id, {
          name: site.name,
          ext: site.ext,
          sortOrder: prev.sortOrder,
        })
        updated.push(source)
        byName.set(site.name.toLowerCase(), source)
      } else {
        const source = await createEducationSource(env.DB, {
          name: site.name,
          ext: site.ext,
          sortOrder: nextOrder,
        })
        created.push(source)
        byName.set(site.name.toLowerCase(), source)
        nextOrder += 1
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '写入失败'
      failed.push({ label: site.name, reason: message })
    }
  }

  const sources = await listEducationSources(env.DB)
  return json({
    created: created.length,
    updated: updated.length,
    failed,
    sources,
  })
}

async function handleDeleteEducationSource(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const existing = await findEducationSourceById(env.DB, id)
  if (!existing) return json({ error: '教育源不存在' }, 404)

  const ok = await deleteEducationSource(env.DB, id)
  if (!ok) return json({ error: '删除失败' }, 500)
  return json({ ok: true })
}

async function handleGetEducationCookie(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)
  const config = await getEducationCookie(env.DB)
  return json({ cookie: config.cookie, updatedAt: config.updatedAt })
}

async function handlePutEducationCookie(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const body = await readJson<{ cookie?: string }>(request)
  if (typeof body?.cookie !== 'string') {
    return json({ error: '请填写 cookie' }, 400)
  }

  const config = await setEducationCookie(env.DB, body.cookie.trim())
  return json({ cookie: config.cookie, updatedAt: config.updatedAt })
}
