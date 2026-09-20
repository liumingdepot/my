import type { AdminEnv } from './types.js'
import { ensureVideoSourcesTable } from './videoSources.js'

const SEED_USERNAME = 'admin'
const SEED_PASSWORD = 'admin123'

export async function ensureSchema(env: AdminEnv) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        display_name TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
        status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
        created_at TEXT NOT NULL
      )
    `),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)`),
  ])

  await ensureVideoSourcesTable(env.DB)

  const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first<{ c: number }>()
  if ((count?.c ?? 0) > 0) return

  const { hashPassword } = await import('./password.js')
  const passwordHash = await hashPassword(SEED_PASSWORD)
  await env.DB.prepare(
    `INSERT INTO users (id, username, display_name, email, password_hash, role, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      SEED_USERNAME,
      '管理员',
      'admin@example.com',
      passwordHash,
      'admin',
      'active',
      new Date().toISOString(),
    )
    .run()
}
