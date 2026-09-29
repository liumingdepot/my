import {
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  type AdminEnv,
  type SessionPayload,
} from './types.js'

export function readCookie(request: Request, name: string) {
  const header = request.headers.get('Cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=')
    if (rawKey === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function buildSessionCookie(token: string, secure: boolean, maxAge = SESSION_TTL_SEC) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookie(secure: boolean) {
  return buildSessionCookie('', secure, 0)
}

function toMysqlDatetime(d: Date) {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

export async function createSession(env: AdminEnv, payload: SessionPayload) {
  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '')
  const expiresAt = toMysqlDatetime(new Date(Date.now() + SESSION_TTL_SEC * 1000))
  await env.DB.prepare(
    `INSERT INTO sessions (token, payload, expires_at) VALUES (?, ?, ?)`,
  )
    .bind(token, JSON.stringify(payload), expiresAt)
    .run()
  return token
}

export async function readSession(env: AdminEnv, request: Request): Promise<SessionPayload | null> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null
  const row = await env.DB.prepare(
    `SELECT payload FROM sessions WHERE token = ? AND expires_at > NOW() LIMIT 1`,
  )
    .bind(token)
    .first<{ payload: string | SessionPayload }>()
  if (!row?.payload) return null
  try {
    const parsed =
      typeof row.payload === 'string'
        ? (JSON.parse(row.payload) as SessionPayload)
        : row.payload
    if (!parsed?.userId || !parsed.username) return null
    return parsed
  } catch {
    return null
  }
}

export async function destroySession(env: AdminEnv, request: Request) {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return
  await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run()
}

export async function requireSession(env: AdminEnv, request: Request) {
  const session = await readSession(env, request)
  if (!session) return null
  return session
}
