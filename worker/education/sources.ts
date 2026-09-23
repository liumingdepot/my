import { EDUCATION_SEEDS } from './seed.js'

export type EducationSourceRow = {
  id: string
  name: string
  ext: string
  sort_order: number
  created_at: string
  updated_at: string
}

export type EducationSource = {
  id: string
  name: string
  ext: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type EducationSourceInput = {
  name: string
  ext: string
  sortOrder: number
}

const SELECT_COLS = `id, name, ext, sort_order, created_at, updated_at`

export function toEducationSource(row: EducationSourceRow): EducationSource {
  return {
    id: row.id,
    name: row.name,
    ext: row.ext,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function ensureEducationSourcesTable(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS education_sources (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        ext TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_education_sources_updated ON education_sources (updated_at DESC)`,
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_education_sources_sort ON education_sources (sort_order ASC, name ASC)`,
    ),
  ])

  try {
    await db
      .prepare(`ALTER TABLE education_sources ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`)
      .run()
  } catch {
    /* column already exists */
  }

  // Only seed on first setup (empty table). Never re-insert after rename/delete.
  const countRow = await db
    .prepare('SELECT COUNT(*) AS c FROM education_sources')
    .first<{ c: number }>()
  if ((countRow?.c ?? 0) > 0) return

  const now = new Date().toISOString()
  for (let index = 0; index < EDUCATION_SEEDS.length; index++) {
    const seed = EDUCATION_SEEDS[index]!
    const sortOrder = index + 1
    const ext = JSON.stringify(
      {
        homeContent: seed.ext.homeContent,
        classes: seed.ext.classes,
        filter: seed.ext.filter,
      },
      null,
      2,
    )
    await db
      .prepare(
        `INSERT INTO education_sources (id, name, ext, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), seed.name, ext, sortOrder, now, now)
      .run()
  }
}

export async function listEducationSources(db: D1Database) {
  await ensureEducationSourcesTable(db)
  const result = await db
    .prepare(
      `SELECT ${SELECT_COLS}
       FROM education_sources ORDER BY sort_order ASC, name ASC`,
    )
    .all<EducationSourceRow>()
  return (result.results ?? []).map(toEducationSource)
}

export async function findEducationSourceById(db: D1Database, id: string) {
  await ensureEducationSourcesTable(db)
  const row = await db
    .prepare(`SELECT ${SELECT_COLS} FROM education_sources WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<EducationSourceRow>()
  return row ? toEducationSource(row) : null
}

export async function createEducationSource(db: D1Database, input: EducationSourceInput) {
  await ensureEducationSourcesTable(db)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  try {
    await db
      .prepare(
        `INSERT INTO education_sources (id, name, ext, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, input.name, input.ext, input.sortOrder, now, now)
      .run()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('UNIQUE')) throw new Error('名称已存在')
    throw error
  }
  const source = await findEducationSourceById(db, id)
  if (!source) throw new Error('创建失败')
  return source
}

export async function updateEducationSource(
  db: D1Database,
  id: string,
  input: EducationSourceInput,
) {
  await ensureEducationSourcesTable(db)
  const now = new Date().toISOString()
  try {
    const result = await db
      .prepare(
        `UPDATE education_sources
         SET name = ?, ext = ?, sort_order = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(input.name, input.ext, input.sortOrder, now, id)
      .run()
    if (!result.success || (result.meta.changes ?? 0) === 0) {
      throw new Error('教育源不存在')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('UNIQUE')) throw new Error('名称已存在')
    throw error
  }
  const source = await findEducationSourceById(db, id)
  if (!source) throw new Error('更新失败')
  return source
}

export async function deleteEducationSource(db: D1Database, id: string) {
  await ensureEducationSourcesTable(db)
  const result = await db.prepare('DELETE FROM education_sources WHERE id = ?').bind(id).run()
  return result.success && (result.meta.changes ?? 0) > 0
}

export type NormalizeEducationExtResult =
  | { ok: true; ext: string; homeContent: string; classCount: number; filterCount: number }
  | { ok: false; error: string }

/**
 * Normalize pasted csp_Bili ext:
 * - ignore cookie (global config instead)
 * - keep homeContent / classes / filter
 */
export function normalizeEducationExt(raw: string): NormalizeEducationExtResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: '请填写 ext JSON' }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { ok: false, error: 'ext 不是合法 JSON' }
  }
  return normalizeEducationExtObject(parsed)
}

export function normalizeEducationExtObject(parsed: unknown): NormalizeEducationExtResult {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'ext 需为 JSON 对象' }
  }

  const obj = parsed as Record<string, unknown>
  const homeContent =
    typeof obj.homeContent === 'string' ? obj.homeContent.trim() : ''
  const classes = Array.isArray(obj.classes) ? obj.classes : []
  const filter =
    obj.filter && typeof obj.filter === 'object' && !Array.isArray(obj.filter)
      ? (obj.filter as Record<string, unknown>)
      : {}

  if (!classes.length && Object.keys(filter).length === 0) {
    return { ok: false, error: 'ext 至少需要 classes 或 filter' }
  }

  const cleaned = {
    homeContent,
    classes,
    filter,
  }

  return {
    ok: true,
    ext: JSON.stringify(cleaned, null, 2),
    homeContent,
    classCount: classes.length,
    filterCount: Object.keys(filter).length,
  }
}

function looksLikeUrl(text: string) {
  return /^https?:\/\//i.test(text.trim())
}

async function fetchRemoteJson(url: string): Promise<unknown> {
  // Encode non-ASCII path segments（如 /json/少儿教育.json）
  let fetchUrl = url.trim()
  try {
    const u = new URL(fetchUrl)
    u.pathname = u.pathname
      .split('/')
      .map((seg) => {
        if (!seg) return seg
        try {
          return encodeURIComponent(decodeURIComponent(seg))
        } catch {
          return encodeURIComponent(seg)
        }
      })
      .join('/')
    fetchUrl = u.toString()
  } catch {
    /* keep original */
  }

  const res = await fetch(fetchUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
    },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`拉取 ext 失败（HTTP ${res.status}）`)
  const text = await res.text()
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('远程 ext 不是合法 JSON')
  }
}

export function cleanTvboxSiteName(name: string) {
  return name
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[┃｜|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type ResolvedTvboxSite = {
  name: string
  key: string
  ext: string
  homeContent: string
  classCount: number
  filterCount: number
}

/**
 * Resolve admin input into stored ext:
 * - JSON object with classes/filter
 * - URL string → fetch remote csp_Bili JSON
 * - TVBox site entry `{ api, ext: url|json, name, key }`
 */
export async function resolveEducationExtInput(
  raw: string,
  preferredName = '',
): Promise<
  | { ok: true; name: string; ext: string; homeContent: string; classCount: number; filterCount: number }
  | { ok: false; error: string }
> {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: '请填写 ext / TVBox 源配置' }

  // Plain URL
  if (looksLikeUrl(trimmed) && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    try {
      const remote = await fetchRemoteJson(trimmed)
      const normalized = normalizeEducationExtObject(remote)
      if (!normalized.ok) return normalized
      const name = (preferredName || normalized.homeContent).trim()
      if (!name) return { ok: false, error: '请填写名称（或在远程 JSON 中提供 homeContent）' }
      return { ...normalized, name }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '拉取远程 ext 失败' }
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { ok: false, error: '不是合法 JSON / URL' }
  }

  // TVBox site object
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const site = parsed as Record<string, unknown>
    const extField = site.ext
    const api = typeof site.api === 'string' ? site.api : ''
    const isTvboxSite =
      Boolean(api.includes('Bili') || site.key || site.type === 3) &&
      (typeof extField === 'string' || (extField && typeof extField === 'object'))

    if (isTvboxSite && extField !== undefined) {
      let extObj: unknown
      if (typeof extField === 'string' && looksLikeUrl(extField)) {
        try {
          extObj = await fetchRemoteJson(extField.trim())
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : '拉取远程 ext 失败' }
        }
      } else if (typeof extField === 'string') {
        try {
          extObj = JSON.parse(extField)
        } catch {
          return { ok: false, error: 'site.ext 不是合法 JSON' }
        }
      } else {
        extObj = extField
      }

      const normalized = normalizeEducationExtObject(extObj)
      if (!normalized.ok) return normalized

      // Prefer TVBox key（少儿教育 / 小学课堂），再回落 homeContent
      const siteName =
        preferredName ||
        (typeof site.key === 'string' ? site.key.trim() : '') ||
        normalized.homeContent ||
        (typeof site.name === 'string' ? cleanTvboxSiteName(site.name) : '')

      if (!siteName) return { ok: false, error: '缺少名称（key / name / homeContent）' }
      return { ...normalized, name: siteName }
    }
  }

  // Plain csp_Bili ext object
  const normalized = normalizeEducationExtObject(parsed)
  if (!normalized.ok) return normalized
  const name = (preferredName || normalized.homeContent).trim()
  if (!name) return { ok: false, error: '请填写名称（或在 ext 中提供 homeContent）' }
  return { ...normalized, name }
}

export type EducationImportFailure = { label: string; reason: string }

/**
 * Parse one or many TVBox site entries / ext payloads for batch import.
 * Continues on per-item errors so partial success is possible.
 */
export async function resolveEducationImport(
  raw: string,
): Promise<
  | { ok: true; sites: ResolvedTvboxSite[]; failed: EducationImportFailure[] }
  | { ok: false; error: string }
> {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: '请粘贴 TVBox 源 JSON' }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    // Allow paste of comma-separated objects without wrapping array brackets
    if (trimmed.startsWith('{')) {
      try {
        parsed = JSON.parse(`[${trimmed}]`)
      } catch {
        parsed = undefined
      }
    }
    if (parsed === undefined) {
      // single URL
      if (looksLikeUrl(trimmed)) {
        const one = await resolveEducationExtInput(trimmed)
        if (!one.ok) return one
        return {
          ok: true,
          failed: [],
          sites: [
            {
              name: one.name,
              key: one.name,
              ext: one.ext,
              homeContent: one.homeContent,
              classCount: one.classCount,
              filterCount: one.filterCount,
            },
          ],
        }
      }
      return { ok: false, error: '不是合法 JSON' }
    }
  }

  const list = Array.isArray(parsed) ? parsed : [parsed]
  const sites: ResolvedTvboxSite[] = []
  const failed: EducationImportFailure[] = []

  for (const item of list) {
    const obj =
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {}
    const label =
      (typeof obj.key === 'string' && obj.key.trim()) ||
      (typeof obj.name === 'string' && cleanTvboxSiteName(obj.name)) ||
      (typeof obj.ext === 'string' ? obj.ext.slice(0, 48) : '') ||
      '未命名'

    const resolved = await resolveEducationExtInput(JSON.stringify(item))
    if (!resolved.ok) {
      failed.push({ label, reason: resolved.error })
      continue
    }
    const key =
      (typeof obj.key === 'string' && obj.key.trim()) || resolved.name
    sites.push({
      name: resolved.name,
      key,
      ext: resolved.ext,
      homeContent: resolved.homeContent,
      classCount: resolved.classCount,
      filterCount: resolved.filterCount,
    })
  }

  if (!sites.length && !failed.length) {
    return { ok: false, error: '未解析到任何教育源' }
  }
  if (!sites.length) {
    return {
      ok: false,
      error: failed.map((item) => `${item.label}：${item.reason}`).join('；'),
    }
  }
  return { ok: true, sites, failed }
}
