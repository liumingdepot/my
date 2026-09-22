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
  return json({ ok: true })
}
