import type { AppDb } from '../utils/db.js'

export const GAME_CATEGORIES = ['FC', 'SFC', '街机'] as const

export type GameCategory = (typeof GAME_CATEGORIES)[number]

export type GameRow = {
  id: string
  name: string
  download_url: string
  image_url: string
  category: string
  genre: string
  sort_order: number
  recommended: number
  created_at: string
  updated_at: string
}

export type Game = {
  id: string
  name: string
  downloadUrl: string
  imageUrl: string
  category: GameCategory
  genre: string
  sortOrder: number
  recommended: boolean
  createdAt: string
  updatedAt: string
}

const GAME_SELECT =
  `id, name, download_url, image_url, category, genre, sort_order, recommended, created_at, updated_at`

export function isGameCategory(value: unknown): value is GameCategory {
  return typeof value === 'string' && (GAME_CATEGORIES as readonly string[]).includes(value)
}

export function toGame(row: GameRow): Game {
  return {
    id: row.id,
    name: row.name,
    downloadUrl: row.download_url,
    imageUrl: row.image_url,
    category: row.category as GameCategory,
    genre: row.genre,
    sortOrder: Number(row.sort_order) || 0,
    recommended: Boolean(row.recommended),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Schema via mysql-schema.sql — no-op kept for call-site compatibility. */
export async function ensureGamesTable(_db: AppDb) {
  /* tables applied by scripts/mysql-schema.sql */
}

export async function listFeaturedGames(db: AppDb, limit = 12, category?: string) {
  await ensureGamesTable(db)
  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 12), 48)
  if (category && isGameCategory(category)) {
    const result = await db
      .prepare(
        `SELECT ${GAME_SELECT}
         FROM games WHERE recommended = 1 AND category = ?
         ORDER BY sort_order ASC, name ASC
         LIMIT ?`,
      )
      .bind(category, safeLimit)
      .all<GameRow>()
    return (result.results ?? []).map(toGame)
  }
  const result = await db
    .prepare(
      `SELECT ${GAME_SELECT}
       FROM games WHERE recommended = 1
       ORDER BY sort_order ASC, name ASC
       LIMIT ?`,
    )
    .bind(safeLimit)
    .all<GameRow>()
  return (result.results ?? []).map(toGame)
}

export type PublicGameQuery = {
  page?: number
  pageSize?: number
  q?: string
  category?: string
  genre?: string
  recommended?: boolean
}

export async function listPublicGames(db: AppDb, query: PublicGameQuery = {}) {
  await ensureGamesTable(db)
  const page = Math.max(1, Math.floor(query.page ?? 1) || 1)
  const pageSize = Math.min(48, Math.max(1, Math.floor(query.pageSize ?? 24) || 24))
  const q = query.q?.trim() ?? ''
  const category = query.category?.trim() ?? ''
  const genre = query.genre?.trim() ?? ''
  const recommendedOnly = query.recommended === true

  const where: string[] = []
  const binds: (string | number)[] = []

  if (category && isGameCategory(category)) {
    where.push('category = ?')
    binds.push(category)
  }
  if (recommendedOnly) {
    where.push('recommended = 1')
  }
  if (genre) {
    where.push('genre LIKE ?')
    binds.push(`%${genre.replace(/[%_]/g, '')}%`)
  }
  if (q) {
    where.push('(name LIKE ? OR genre LIKE ? OR category LIKE ?)')
    const like = `%${q.replace(/[%_]/g, '')}%`
    binds.push(like, like, like)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS c FROM games ${whereSql}`)
    .bind(...binds)
    .first<{ c: number }>()
  const total = countRow?.c ?? 0

  const offset = (page - 1) * pageSize
  const result = await db
    .prepare(
      `SELECT ${GAME_SELECT}
       FROM games ${whereSql}
       ORDER BY sort_order ASC, name ASC
       LIMIT ? OFFSET ?`,
    )
    .bind(...binds, pageSize, offset)
    .all<GameRow>()

  return {
    items: (result.results ?? []).map(toGame),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export async function findGameById(db: AppDb, id: string) {
  await ensureGamesTable(db)
  const row = await db
    .prepare(`SELECT ${GAME_SELECT} FROM games WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<GameRow>()
  return row ? toGame(row) : null
}
