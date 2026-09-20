import {
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  type AdminEnv,
  type SessionPayload,
} from './types.js'

function sessionKey(token: string) {
  return `session:${token}`
}

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

export async function createSession(env: AdminEnv, payload: SessionPayload) {
  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll('-', '')
  await env.KV.put(sessionKey(token), JSON.stringify(payload), {
    expirationTtl: SESSION_TTL_SEC,
  })
  return token
}

export async function readSession(env: AdminEnv, request: Request): Promise<SessionPayload | null> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return null
  const raw = await env.KV.get(sessionKey(token))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SessionPayload
    if (!parsed?.userId || !parsed.username) return null
    return parsed
  } catch {
    return null
  }
}

export async function destroySession(env: AdminEnv, request: Request) {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return
  await env.KV.delete(sessionKey(token))
}

export async function requireSession(env: AdminEnv, request: Request) {
  const session = await readSession(env, request)
  if (!session) return null
  return session
}
