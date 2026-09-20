import { toPublicUser, type PublicUser, type UserRole, type UserRow, type UserStatus } from './types.js'
import { hashPassword } from './password.js'

const ROLES = new Set<UserRole>(['admin', 'editor', 'viewer'])
const STATUSES = new Set<UserStatus>(['active', 'disabled'])

export function isRole(value: unknown): value is UserRole {
  return typeof value === 'string' && ROLES.has(value as UserRole)
}

export function isStatus(value: unknown): value is UserStatus {
  return typeof value === 'string' && STATUSES.has(value as UserStatus)
}

export async function listUsers(db: D1Database): Promise<PublicUser[]> {
  const result = await db
    .prepare(
      `SELECT id, username, display_name, email, password_hash, role, status, created_at
       FROM users
       ORDER BY datetime(created_at) DESC`,
    )
    .all<UserRow>()
  return (result.results ?? []).map(toPublicUser)
}

export async function findByUsername(db: D1Database, username: string) {
  return db
    .prepare(
      `SELECT id, username, display_name, email, password_hash, role, status, created_at
       FROM users WHERE username = ? COLLATE NOCASE LIMIT 1`,
    )
    .bind(username.trim())
    .first<UserRow>()
}

export async function findById(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT id, username, display_name, email, password_hash, role, status, created_at
       FROM users WHERE id = ? LIMIT 1`,
    )
    .bind(id)
    .first<UserRow>()
}

export type CreateUserInput = {
  username: string
  displayName: string
  email: string
  password: string
  role: UserRole
  status: UserStatus
}

export async function createUser(db: D1Database, input: CreateUserInput) {
  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(input.password)
  const createdAt = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO users (id, username, display_name, email, password_hash, role, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.username.trim(),
      input.displayName.trim(),
      input.email.trim(),
      passwordHash,
      input.role,
      input.status,
      createdAt,
    )
    .run()
  const row = await findById(db, id)
  return row ? toPublicUser(row) : null
}

export type UpdateUserInput = {
  username: string
  displayName: string
  email: string
  role: UserRole
  status: UserStatus
  password?: string
}

export async function updateUser(db: D1Database, id: string, input: UpdateUserInput) {
  if (input.password) {
    const passwordHash = await hashPassword(input.password)
    await db
      .prepare(
        `UPDATE users
         SET username = ?, display_name = ?, email = ?, role = ?, status = ?, password_hash = ?
         WHERE id = ?`,
      )
      .bind(
        input.username.trim(),
        input.displayName.trim(),
        input.email.trim(),
        input.role,
        input.status,
        passwordHash,
        id,
      )
      .run()
  } else {
    await db
      .prepare(
        `UPDATE users
         SET username = ?, display_name = ?, email = ?, role = ?, status = ?
         WHERE id = ?`,
      )
      .bind(
        input.username.trim(),
        input.displayName.trim(),
        input.email.trim(),
        input.role,
        input.status,
        id,
      )
      .run()
  }
  const row = await findById(db, id)
  return row ? toPublicUser(row) : null
}

export async function updateUserStatus(db: D1Database, id: string, status: UserStatus) {
  await db.prepare(`UPDATE users SET status = ? WHERE id = ?`).bind(status, id).run()
  const row = await findById(db, id)
  return row ? toPublicUser(row) : null
}

export async function deleteUser(db: D1Database, id: string) {
  const result = await db.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run()
  return (result.meta.changes ?? 0) > 0
}
