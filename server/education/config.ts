import type { AppDb } from '../utils/db.js'

const CONFIG_ID = 'default'

export type EducationCookieConfig = {
  cookie: string
  updatedAt: string
}

/** Schema applied via mysql-schema.sql; ensure default row exists. */
export async function ensureEducationConfigTable(db: AppDb) {
  const row = await db
    .prepare('SELECT id FROM education_config WHERE id = ?')
    .bind(CONFIG_ID)
    .first<{ id: string }>()

  if (row) return

  await db
    .prepare('INSERT INTO education_config (id, cookie, updated_at) VALUES (?, ?, ?)')
    .bind(CONFIG_ID, '', new Date().toISOString())
    .run()
}

export async function getEducationCookie(db: AppDb): Promise<EducationCookieConfig> {
  await ensureEducationConfigTable(db)
  const row = await db
    .prepare('SELECT cookie, updated_at FROM education_config WHERE id = ?')
    .bind(CONFIG_ID)
    .first<{ cookie: string; updated_at: string }>()

  return {
    cookie: row?.cookie ?? '',
    updatedAt: row?.updated_at || new Date().toISOString(),
  }
}

export async function setEducationCookie(
  db: AppDb,
  cookie: string,
): Promise<EducationCookieConfig> {
  await ensureEducationConfigTable(db)
  const updatedAt = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO education_config (id, cookie, updated_at) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE cookie = VALUES(cookie), updated_at = VALUES(updated_at)`,
    )
    .bind(CONFIG_ID, cookie, updatedAt)
    .run()

  return { cookie, updatedAt }
}
