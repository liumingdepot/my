const CONFIG_ID = 'default'

export type EducationCookieConfig = {
  cookie: string
  updatedAt: string
}

export async function ensureEducationConfigTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS education_config (
        id TEXT PRIMARY KEY NOT NULL,
        cookie TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      )`,
    )
    .run()

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

export async function getEducationCookie(db: D1Database): Promise<EducationCookieConfig> {
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
  db: D1Database,
  cookie: string,
): Promise<EducationCookieConfig> {
  await ensureEducationConfigTable(db)
  const updatedAt = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO education_config (id, cookie, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET cookie = excluded.cookie, updated_at = excluded.updated_at`,
    )
    .bind(CONFIG_ID, cookie, updatedAt)
    .run()

  return { cookie, updatedAt }
}
