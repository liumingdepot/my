import { SEED_VIDEO_SOURCES } from '../video/defaults.js'
import type { PublicVideoSource, VideoSourceRow } from './types.js'

export function toPublicVideoSource(row: VideoSourceRow): PublicVideoSource {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    sortOrder: row.sort_order,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function ensureVideoSourcesTable(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS video_sources (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_video_sources_sort ON video_sources (sort_order, name)`),
  ])

  const count = await db.prepare('SELECT COUNT(*) AS c FROM video_sources').first<{ c: number }>()
  if ((count?.c ?? 0) > 0) return

  const now = new Date().toISOString()
  const stmts = SEED_VIDEO_SOURCES.map((source, index) =>
    db
      .prepare(
        `INSERT INTO video_sources (id, name, url, sort_order, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(crypto.randomUUID(), source.name, source.url, index + 1, now, now),
  )
  if (stmts.length) await db.batch(stmts)
}

export async function listVideoSources(db: D1Database): Promise<PublicVideoSource[]> {
  const result = await db
    .prepare(
      `SELECT id, name, url, sort_order, enabled, created_at, updated_at
       FROM video_sources
       ORDER BY sort_order ASC, name ASC`,
    )
    .all<VideoSourceRow>()
  return (result.results ?? []).map(toPublicVideoSource)
}

export async function listEnabledVideoSources(db: D1Database): Promise<PublicVideoSource[]> {
  const result = await db
    .prepare(
      `SELECT id, name, url, sort_order, enabled, created_at, updated_at
       FROM video_sources
       WHERE enabled = 1
       ORDER BY sort_order ASC, name ASC`,
    )
    .all<VideoSourceRow>()
  return (result.results ?? []).map(toPublicVideoSource)
}

export async function findVideoSourceById(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT id, name, url, sort_order, enabled, created_at, updated_at
       FROM video_sources WHERE id = ? LIMIT 1`,
    )
    .bind(id)
    .first<VideoSourceRow>()
}

export async function findVideoSourceByName(db: D1Database, name: string) {
  return db
    .prepare(
      `SELECT id, name, url, sort_order, enabled, created_at, updated_at
       FROM video_sources WHERE name = ? LIMIT 1`,
    )
    .bind(name.trim())
    .first<VideoSourceRow>()
}

export type CreateVideoSourceInput = {
  name: string
  url: string
  sortOrder?: number
  enabled?: boolean
}

export async function createVideoSource(db: D1Database, input: CreateVideoSourceInput) {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const sortOrder =
    input.sortOrder ??
    ((await db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM video_sources').first<{ m: number }>())?.m ??
      0) + 1

  await db
    .prepare(
      `INSERT INTO video_sources (id, name, url, sort_order, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.name.trim(), input.url.trim(), sortOrder, input.enabled === false ? 0 : 1, now, now)
    .run()

  const row = await findVideoSourceById(db, id)
  return row ? toPublicVideoSource(row) : null
}

export type UpdateVideoSourceInput = {
  name: string
  url: string
  sortOrder: number
  enabled: boolean
}

export async function updateVideoSource(db: D1Database, id: string, input: UpdateVideoSourceInput) {
  const now = new Date().toISOString()
  await db
    .prepare(
      `UPDATE video_sources
       SET name = ?, url = ?, sort_order = ?, enabled = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(input.name.trim(), input.url.trim(), input.sortOrder, input.enabled ? 1 : 0, now, id)
    .run()

  const row = await findVideoSourceById(db, id)
  return row ? toPublicVideoSource(row) : null
}

export async function updateVideoSourceEnabled(db: D1Database, id: string, enabled: boolean) {
  const now = new Date().toISOString()
  await db
    .prepare(`UPDATE video_sources SET enabled = ?, updated_at = ? WHERE id = ?`)
    .bind(enabled ? 1 : 0, now, id)
    .run()
  const row = await findVideoSourceById(db, id)
  return row ? toPublicVideoSource(row) : null
}

export async function deleteVideoSource(db: D1Database, id: string) {
  const result = await db.prepare(`DELETE FROM video_sources WHERE id = ?`).bind(id).run()
  return (result.meta.changes ?? 0) > 0
}
