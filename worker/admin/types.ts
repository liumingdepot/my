export type UserRole = 'admin' | 'editor' | 'viewer'
export type UserStatus = 'active' | 'disabled'

export type UserRow = {
  id: string
  username: string
  display_name: string
  email: string
  password_hash: string
  role: UserRole
  status: UserStatus
  created_at: string
}

export type PublicUser = {
  id: string
  username: string
  displayName: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string
}

export type SessionPayload = {
  userId: string
  username: string
  displayName: string
  role: UserRole
}

export type AdminEnv = {
  DB: D1Database
  KV: KVNamespace
  AGNES_API_KEY?: string
}

export const SESSION_COOKIE = 'admin_session'
export const SESSION_TTL_SEC = 60 * 60 * 24 * 7

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  }
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

export function text(message: string, status = 200) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
