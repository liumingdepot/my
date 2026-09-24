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

export type GameInput = {
  name: string
  downloadUrl: string
  imageUrl: string
  category: GameCategory
  genre: string
  sortOrder: number
  recommended: boolean
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

export async function ensureGamesTable(db: D1Database) {
  await db
    .prepare(
      `
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        download_url TEXT NOT NULL,
        image_url TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL CHECK (category IN ('FC', 'SFC', '街机')),
        genre TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        recommended INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `,
    )
    .run()

  // 旧库缺列时先补列，再建依赖该列的索引
  try {
    await db.prepare(`ALTER TABLE games ADD COLUMN recommended INTEGER NOT NULL DEFAULT 0`).run()
  } catch {
    /* column already exists */
  }

  try {
    await db.prepare(`ALTER TABLE games ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`).run()
  } catch {
    /* column already exists */
  }

  await db.batch([
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_games_category ON games (category, name)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_games_sort ON games (sort_order ASC, name ASC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_games_updated ON games (updated_at DESC)`),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_games_recommended ON games (recommended, sort_order ASC)`,
    ),
  ])
}

async function nextSortOrder(db: D1Database) {
  const row = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM games')
    .first<{ m: number }>()
  return (row?.m ?? 0) + 1
}

export async function listGames(db: D1Database) {
  await ensureGamesTable(db)
  const result = await db
    .prepare(
      `SELECT ${GAME_SELECT}
       FROM games ORDER BY sort_order ASC, name ASC`,
    )
    .all<GameRow>()
  return (result.results ?? []).map(toGame)
}

export async function listFeaturedGames(db: D1Database, limit = 12) {
  await ensureGamesTable(db)
  const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 12), 48)
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

export async function listPublicGames(db: D1Database, query: PublicGameQuery = {}) {
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

export async function findGameById(db: D1Database, id: string) {
  await ensureGamesTable(db)
  const row = await db
    .prepare(`SELECT ${GAME_SELECT} FROM games WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<GameRow>()
  return row ? toGame(row) : null
}

export async function createGame(db: D1Database, input: GameInput) {
  await ensureGamesTable(db)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const sortOrder =
    Number.isFinite(input.sortOrder) && input.sortOrder > 0
      ? Math.trunc(input.sortOrder)
      : await nextSortOrder(db)
  await db
    .prepare(
      `INSERT INTO games (id, name, download_url, image_url, category, genre, sort_order, recommended, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.name,
      input.downloadUrl,
      input.imageUrl,
      input.category,
      input.genre,
      sortOrder,
      input.recommended ? 1 : 0,
      now,
      now,
    )
    .run()
  const game = await findGameById(db, id)
  if (!game) throw new Error('创建失败')
  return game
}

export async function updateGame(db: D1Database, id: string, input: GameInput) {
  await ensureGamesTable(db)
  const now = new Date().toISOString()
  const sortOrder = Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0
  const result = await db
    .prepare(
      `UPDATE games
       SET name = ?, download_url = ?, image_url = ?, category = ?, genre = ?, sort_order = ?, recommended = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.name,
      input.downloadUrl,
      input.imageUrl,
      input.category,
      input.genre,
      sortOrder,
      input.recommended ? 1 : 0,
      now,
      id,
    )
    .run()
  if (!result.success || (result.meta.changes ?? 0) === 0) {
    throw new Error('游戏不存在')
  }
  const game = await findGameById(db, id)
  if (!game) throw new Error('更新失败')
  return game
}

export async function setGameRecommended(db: D1Database, id: string, recommended: boolean) {
  await ensureGamesTable(db)
  const now = new Date().toISOString()
  const result = await db
    .prepare(`UPDATE games SET recommended = ?, updated_at = ? WHERE id = ?`)
    .bind(recommended ? 1 : 0, now, id)
    .run()
  if (!result.success || (result.meta.changes ?? 0) === 0) {
    throw new Error('游戏不存在')
  }
  const game = await findGameById(db, id)
  if (!game) throw new Error('更新失败')
  return game
}

export async function deleteGame(db: D1Database, id: string) {
  await ensureGamesTable(db)
  const result = await db.prepare('DELETE FROM games WHERE id = ?').bind(id).run()
  return result.success && (result.meta.changes ?? 0) > 0
}

export async function deleteAllGames(db: D1Database) {
  await ensureGamesTable(db)
  const result = await db.prepare('DELETE FROM games').run()
  return {
    ok: Boolean(result.success),
    deleted: result.meta.changes ?? 0,
  }
}

/** Stable id for imported catalogue rows, e.g. yikm-4137 */
export function importedGameId(source: string, sourceId: string) {
  return `${source}-${sourceId}`
}

/** Upsert catalogue row; preserves recommended on update. */
export async function upsertGame(db: D1Database, id: string, input: Omit<GameInput, 'recommended'>) {
  await ensureGamesTable(db)
  const existing = await findGameById(db, id)
  const now = new Date().toISOString()
  const sortOrder = Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0
  if (existing) {
    await db
      .prepare(
        `UPDATE games
         SET name = ?, download_url = ?, image_url = ?, category = ?, genre = ?, sort_order = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        input.name,
        input.downloadUrl,
        input.imageUrl,
        input.category,
        input.genre,
        sortOrder,
        now,
        id,
      )
      .run()
    const game = await findGameById(db, id)
    if (!game) throw new Error('更新失败')
    return { game, created: false as const }
  }

  await db
    .prepare(
      `INSERT INTO games (id, name, download_url, image_url, category, genre, sort_order, recommended, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
    .bind(
      id,
      input.name,
      input.downloadUrl,
      input.imageUrl,
      input.category,
      input.genre,
      sortOrder,
      now,
      now,
    )
    .run()
  const game = await findGameById(db, id)
  if (!game) throw new Error('创建失败')
  return { game, created: true as const }
}
