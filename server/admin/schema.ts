import type { AdminEnv } from './types.js'
import { ensureEducationConfigTable } from '../education/config.js'
import { ensureAgnesApiKeysTable, importEnvAgnesKeysIfEmpty } from './agnesKeys.js'

const SEED_USERNAME = 'admin'
const SEED_PASSWORD = 'admin123'

export async function ensureSchema(env: AdminEnv) {
  // Tables come from scripts/mysql-schema.sql — only seed defaults here.
  await ensureEducationConfigTable(env.DB)
  await ensureAgnesApiKeysTable(env.DB)
  await importEnvAgnesKeysIfEmpty(env.DB, env.AGNES_API_KEY)

  const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM users').first<{ c: number }>()
  if (Number(count?.c ?? 0) > 0) return

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
