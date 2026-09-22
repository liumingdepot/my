/** 默认采集源：表为空时写入 */
export const DEFAULT_VIDEO_SOURCES = [
  { name: '量子', url: 'https://cj.lziapi.com/api.php/provide/vod/' },
  { name: '红牛', url: 'https://www.hongniuzy2.com/api.php/provide/vod/from/hnm3u8/at/json/' },
  { name: '新浪', url: 'https://api.xinlangapi.com/xinlangapi.php/provide/vod/' },
  { name: '非凡', url: 'http://ffzy.tv/api.php/provide/vod/' },
  { name: '无尽', url: 'https://api.wujinapi.com/api.php/provide/vod/' },
  { name: '金鹰', url: 'https://jinyingzy.com/provide/vod/' },
  { name: '茅台', url: 'https://caiji.maotai999.vip/api.php/provide/vod/from/mtm3u8/at/json/' },
  { name: '电影天堂', url: 'http://caiji.dyttzyapi.com/api.php/provide/vod/' },
  { name: '天涯采集', url: 'http://tyyszy.com/api.php/provide/vod/' },
  { name: '极速资源', url: 'https://jszyapi.com/api.php/provide/vod/' },
  { name: '建安采集', url: 'http://154.219.117.232:9981/jacloudapi.php/provide/vod/' },
  { name: '率率', url: 'https://suoniapi.com/api.php/provide/vod/' },
  { name: '百度', url: 'https://api.apibdzy.com/api.php/provide/vod/' },
  { name: '暴風', url: 'https://bfzyapi.com/api.php/provide/vod/' },
  { name: '电影天堂m3u8', url: 'http://caiji.dyttzyapi.com/api.php/provide/vod/from/dyttm3u8/at/m3u8/' },
  { name: '红牛资源', url: 'https://www.hongniuzy2.com/api.php/provide/vod/' },
  { name: '闪电资源', url: 'http://sdzyapi.com/api.php/provide/vod/' },
  { name: '光速资源', url: 'https://api.guangsuapi.com/api.php/provide/vod/' },
] as const

export type VideoSourceRow = {
  id: string
  name: string
  url: string
  enabled: number
  sort_order: number
  created_at: string
  updated_at: string
}

export type VideoSource = {
  id: string
  name: string
  url: string
  enabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type SourceEntry = { name: string; url: string }

export function toVideoSource(row: VideoSourceRow): VideoSource {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    enabled: row.enabled === 1,
    sortOrder: row.sort_order,
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
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_video_sources_sort ON video_sources (sort_order, name)`,
    ),
  ])

  const count = await db.prepare('SELECT COUNT(*) AS c FROM video_sources').first<{ c: number }>()
  if ((count?.c ?? 0) > 0) return

  const now = new Date().toISOString()
  const stmts = DEFAULT_VIDEO_SOURCES.map((source, index) =>
    db
      .prepare(
        `INSERT INTO video_sources (id, name, url, sort_order, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
      )
      .bind(crypto.randomUUID(), source.name, source.url, index + 1, now, now),
  )
  await db.batch(stmts)
}

export async function listVideoSources(db: D1Database, opts?: { enabledOnly?: boolean }) {
  await ensureVideoSourcesTable(db)
  const sql = opts?.enabledOnly
    ? `SELECT id, name, url, sort_order, enabled, created_at, updated_at
       FROM video_sources WHERE enabled = 1 ORDER BY sort_order ASC, name ASC`
    : `SELECT id, name, url, sort_order, enabled, created_at, updated_at
       FROM video_sources ORDER BY sort_order ASC, name ASC`
  const result = await db.prepare(sql).all<VideoSourceRow>()
  return (result.results ?? []).map(toVideoSource)
}

export async function loadEnabledSourceEntries(db: D1Database): Promise<{
  sources: SourceEntry[]
  primary: string
}> {
  const list = await listVideoSources(db, { enabledOnly: true })
  const sources = list.map((s) => ({ name: s.name, url: s.url }))
  const primary = list[0]?.name ?? DEFAULT_VIDEO_SOURCES[0]!.name
  return { sources, primary }
}

export async function findVideoSourceById(db: D1Database, id: string) {
  await ensureVideoSourcesTable(db)
  const row = await db
    .prepare(
      `SELECT id, name, url, sort_order, enabled, created_at, updated_at
       FROM video_sources WHERE id = ? LIMIT 1`,
    )
    .bind(id)
    .first<VideoSourceRow>()
  return row ? toVideoSource(row) : null
}

export async function findVideoSourceByName(db: D1Database, name: string) {
  await ensureVideoSourcesTable(db)
  const row = await db
    .prepare(
      `SELECT id, name, url, sort_order, enabled, created_at, updated_at
       FROM video_sources WHERE name = ? LIMIT 1`,
    )
    .bind(name.trim())
    .first<VideoSourceRow>()
  return row ? toVideoSource(row) : null
}

export type VideoSourceInput = {
  name: string
  url: string
  enabled: boolean
  sortOrder: number
}

function normalizeUrl(url: string) {
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('invalid')
    }
    return trimmed
  } catch {
    throw new Error('URL 无效，需为 http/https')
  }
}

export async function createVideoSource(db: D1Database, input: VideoSourceInput) {
  await ensureVideoSourcesTable(db)
  const name = input.name.trim()
  const url = normalizeUrl(input.url)
  if (!name) throw new Error('请填写名称')

  const exists = await findVideoSourceByName(db, name)
  if (exists) throw new Error('名称已存在')

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const sortOrder =
    Number.isFinite(input.sortOrder) && input.sortOrder > 0
      ? input.sortOrder
      : ((await db
          .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM video_sources')
          .first<{ m: number }>())?.m ?? 0) + 1

  await db
    .prepare(
      `INSERT INTO video_sources (id, name, url, sort_order, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, name, url, sortOrder, input.enabled ? 1 : 0, now, now)
    .run()

  return (await findVideoSourceById(db, id))!
}

export async function updateVideoSource(db: D1Database, id: string, input: VideoSourceInput) {
  await ensureVideoSourcesTable(db)
  const existing = await findVideoSourceById(db, id)
  if (!existing) throw new Error('采集源不存在')

  const name = input.name.trim()
  const url = normalizeUrl(input.url)
  if (!name) throw new Error('请填写名称')

  const conflict = await findVideoSourceByName(db, name)
  if (conflict && conflict.id !== id) throw new Error('名称已存在')

  const now = new Date().toISOString()
  await db
    .prepare(
      `UPDATE video_sources
       SET name = ?, url = ?, sort_order = ?, enabled = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(name, url, input.sortOrder, input.enabled ? 1 : 0, now, id)
    .run()

  return (await findVideoSourceById(db, id))!
}

export async function patchVideoSourceEnabled(db: D1Database, id: string, enabled: boolean) {
  await ensureVideoSourcesTable(db)
  const existing = await findVideoSourceById(db, id)
  if (!existing) throw new Error('采集源不存在')

  const now = new Date().toISOString()
  await db
    .prepare(`UPDATE video_sources SET enabled = ?, updated_at = ? WHERE id = ?`)
    .bind(enabled ? 1 : 0, now, id)
    .run()

  return (await findVideoSourceById(db, id))!
}

export async function deleteVideoSource(db: D1Database, id: string) {
  await ensureVideoSourcesTable(db)
  const existing = await findVideoSourceById(db, id)
  if (!existing) return false
  await db.prepare(`DELETE FROM video_sources WHERE id = ?`).bind(id).run()
  return true
}
