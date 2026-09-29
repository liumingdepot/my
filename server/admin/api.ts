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
import { deleteCache } from '../utils/cache.js'
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
  createEducationSource,
  deleteEducationSource,
  findEducationSourceById,
  listEducationSources,
  resolveEducationExtInput,
  resolveEducationImport,
  updateEducationSource,
} from '../education/sources.js'
import { getEducationCookie, setEducationCookie } from '../education/config.js'
import {
  createAgnesApiKey,
  deleteAgnesApiKey,
  findAgnesApiKeyById,
  isAgnesBaseUrl,
  listAgnesApiKeys,
  patchAgnesApiKeyEnabled,
  patchAgnesApiKeysEnabledByBase,
  updateAgnesApiKey,
} from './agnesKeys.js'

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

  if (pathname === '/api/admin/agnes-keys' && method === 'GET') {
    return handleListAgnesKeys(request, env)
  }
  if (pathname === '/api/admin/agnes-keys' && method === 'POST') {
    return handleCreateAgnesKey(request, env)
  }
  if (pathname === '/api/admin/agnes-keys/bulk-enabled' && method === 'PATCH') {
    return handleBulkPatchAgnesKeysEnabled(request, env)
  }

  const agnesKeyMatch = pathname.match(/^\/api\/admin\/agnes-keys\/([^/]+)$/)
  if (agnesKeyMatch) {
    const id = decodeURIComponent(agnesKeyMatch[1]!)
    if (method === 'PUT') return handleUpdateAgnesKey(request, env, id)
    if (method === 'DELETE') return handleDeleteAgnesKey(request, env, id)
  }

  const agnesEnabledMatch = pathname.match(/^\/api\/admin\/agnes-keys\/([^/]+)\/enabled$/)
  if (agnesEnabledMatch && method === 'PATCH') {
    return handlePatchAgnesKeyEnabled(request, env, decodeURIComponent(agnesEnabledMatch[1]!))
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
    if (/UNIQUE|Duplicate entry/i.test(message)) return json({ error: '用户名已存在' }, 409)
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
    if (/UNIQUE|Duplicate entry/i.test(message)) return json({ error: '用户名已存在' }, 409)
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

async function invalidateVideoSourceCache(_env: AdminEnv) {
  try {
    deleteCache('video:sources')
  } catch (err) {
    console.error('[admin] invalidate video cache', err)
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

async function handleListAgnesKeys(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)
  const items = await listAgnesApiKeys(env.DB)
  return json({ items })
}

async function handleCreateAgnesKey(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const body = await readJson<{ apiKey?: string; baseUrl?: string; enabled?: boolean }>(request)
  const apiKey = body?.apiKey?.trim() ?? ''
  const baseUrl = body?.baseUrl?.trim() ?? ''
  if (!apiKey) return json({ error: '请填写密钥' }, 400)
  if (!isAgnesBaseUrl(baseUrl)) return json({ error: '请选择 Base URL' }, 400)

  try {
    const item = await createAgnesApiKey(env.DB, {
      apiKey,
      baseUrl,
      enabled: body?.enabled !== false,
    })
    if (!item) return json({ error: '创建失败' }, 500)
    return json({ item }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建失败'
    return json({ error: message }, 400)
  }
}

async function handleUpdateAgnesKey(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const existing = await findAgnesApiKeyById(env.DB, id)
  if (!existing) return json({ error: '密钥不存在' }, 404)

  const body = await readJson<{ apiKey?: string; baseUrl?: string; enabled?: boolean }>(request)
  const apiKey = body?.apiKey?.trim() ?? ''
  const baseUrl = body?.baseUrl?.trim() ?? ''
  if (!apiKey) return json({ error: '请填写密钥' }, 400)
  if (!isAgnesBaseUrl(baseUrl)) return json({ error: '请选择 Base URL' }, 400)

  try {
    const item = await updateAgnesApiKey(env.DB, id, {
      apiKey,
      baseUrl,
      enabled: body?.enabled !== false,
    })
    if (!item) return json({ error: '更新失败' }, 500)
    return json({ item })
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新失败'
    return json({ error: message }, 400)
  }
}

async function handleDeleteAgnesKey(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const existing = await findAgnesApiKeyById(env.DB, id)
  if (!existing) return json({ error: '密钥不存在' }, 404)

  const ok = await deleteAgnesApiKey(env.DB, id)
  if (!ok) return json({ error: '删除失败' }, 500)
  return json({ ok: true })
}

async function handlePatchAgnesKeyEnabled(request: Request, env: AdminEnv, id: string) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const existing = await findAgnesApiKeyById(env.DB, id)
  if (!existing) return json({ error: '密钥不存在' }, 404)

  const body = await readJson<{ enabled?: boolean }>(request)
  if (typeof body?.enabled !== 'boolean') return json({ error: '请指定启用状态' }, 400)

  const item = await patchAgnesApiKeyEnabled(env.DB, id, body.enabled)
  if (!item) return json({ error: '更新失败' }, 500)
  return json({ item })
}

async function handleBulkPatchAgnesKeysEnabled(request: Request, env: AdminEnv) {
  const session = await requireSession(env, request)
  if (!session) return json({ error: '未登录' }, 401)

  const body = await readJson<{ baseUrl?: string; enabled?: boolean }>(request)
  const baseUrl = body?.baseUrl?.trim() ?? ''
  if (!isAgnesBaseUrl(baseUrl)) return json({ error: '请选择 Base URL' }, 400)
  if (typeof body?.enabled !== 'boolean') return json({ error: '请指定启用状态' }, 400)

  const result = await patchAgnesApiKeysEnabledByBase(env.DB, baseUrl, body.enabled)
  return json(result)
}
