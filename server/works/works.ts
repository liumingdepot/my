import type { AppDb } from '../utils/db.js'

/** 作品 = 前台 /works 页「项目经历」里的每一条记录 */
export type WorkRow = {
  id: string
  title: string
  role: string
  period: string
  description: string
  badge: string
  company: string
  platform: string
  stack: string
  highlights: string
  link: string
  featured: number
  sort_order: number
  enabled: number
  created_at: string
  updated_at: string
}

export type Work = {
  id: string
  title: string
  role: string
  period: string
  description: string
  /** 角标，如「精选 · 省级核心系统」 */
  badge: string
  /** 所属公司 / 团队 */
  company: string
  /** 端类型：PC / 移动 / PC+移动 / 大屏 等 */
  platform: string
  /** 技术栈，逗号分隔 */
  stack: string
  /** 亮点，换行分隔 */
  highlights: string
  /** 项目外链（可选） */
  link: string
  featured: boolean
  sortOrder: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type WorkInput = {
  title: string
  role: string
  period: string
  description: string
  badge: string
  company: string
  platform: string
  stack: string
  highlights: string
  link: string
  featured: boolean
  enabled: boolean
  sortOrder: number
}

/** 表为空时写入的默认作品，与前台旧假数据保持一致 */
export const DEFAULT_WORKS: Omit<WorkInput, 'sortOrder'>[] = [
  {
    title: '智能协作平台',
    role: '前端负责人',
    period: '2024.03 — 2025.01',
    description:
      '从零搭建多端协作产品，负责组件体系、权限与实时同步，支撑日活万级团队协作场景。',
    badge: '',
    company: '',
    platform: 'PC + 移动',
    stack: 'React, TypeScript, Vite',
    highlights: '',
    link: '',
    featured: false,
    enabled: true,
  },
  {
    title: '内容创作中台',
    role: '全栈开发',
    period: '2023.06 — 2024.02',
    description: '打通选题、生产、审核与分发链路，沉淀可复用素材库与审核流，显著缩短内容上线周期。',
    badge: '',
    company: '',
    platform: 'PC',
    stack: 'Vue3, Node.js',
    highlights: '',
    link: '',
    featured: false,
    enabled: true,
  },
  {
    title: '数据可视化大屏',
    role: '前端开发',
    period: '2022.11 — 2023.05',
    description: '面向运营与管理层的实时看板，完成地图、图表与告警联动，保障大促期间稳定展示。',
    badge: '',
    company: '',
    platform: '大屏',
    stack: 'ECharts, GIS, Vue',
    highlights: '',
    link: '',
    featured: false,
    enabled: true,
  },
  {
    title: '移动端增长工具',
    role: '独立开发',
    period: '2022.03 — 2022.10',
    description: '活动页搭建与投放归因一体化工具，支持配置化落地页与渠道追踪，服务多场营销活动。',
    badge: '',
    company: '',
    platform: '移动',
    stack: 'UniApp, H5',
    highlights: '',
    link: '',
    featured: false,
    enabled: true,
  },
]

const COLUMNS =
  'id, title, role, period, description, badge, company, platform, stack, highlights, link, featured, sort_order, enabled, created_at, updated_at'

const EXTRA_COLUMNS: { name: string; ddl: string }[] = [
  { name: 'badge', ddl: "ADD COLUMN badge VARCHAR(191) NOT NULL DEFAULT '' AFTER description" },
  { name: 'company', ddl: "ADD COLUMN company VARCHAR(191) NOT NULL DEFAULT '' AFTER badge" },
  { name: 'platform', ddl: "ADD COLUMN platform VARCHAR(64) NOT NULL DEFAULT '' AFTER company" },
  { name: 'stack', ddl: 'ADD COLUMN stack TEXT NULL AFTER platform' },
  { name: 'highlights', ddl: 'ADD COLUMN highlights TEXT NULL AFTER stack' },
  { name: 'link', ddl: "ADD COLUMN link VARCHAR(512) NOT NULL DEFAULT '' AFTER highlights" },
  { name: 'featured', ddl: 'ADD COLUMN featured TINYINT NOT NULL DEFAULT 0 AFTER link' },
]

export function toWork(row: WorkRow): Work {
  return {
    id: row.id,
    title: row.title,
    role: row.role ?? '',
    period: row.period ?? '',
    description: row.description ?? '',
    badge: row.badge ?? '',
    company: row.company ?? '',
    platform: row.platform ?? '',
    stack: row.stack ?? '',
    highlights: row.highlights ?? '',
    link: row.link ?? '',
    featured: Number(row.featured) === 1,
    sortOrder: Number(row.sort_order ?? 0),
    enabled: Number(row.enabled) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function ensureWorkColumns(db: AppDb) {
  const existing = await db
    .prepare(
      `SELECT COLUMN_NAME AS name
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'works'`,
    )
    .all<{ name: string }>()
  const names = new Set((existing.results ?? []).map((row) => row.name))

  if (names.has('image')) {
    await db.prepare('ALTER TABLE works DROP COLUMN image').run()
    names.delete('image')
  }

  for (const column of EXTRA_COLUMNS) {
    if (names.has(column.name)) continue
    await db.prepare(`ALTER TABLE works ${column.ddl}`).run()
  }
}

export async function ensureWorksTable(db: AppDb) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS works (
        id VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        role VARCHAR(191) NOT NULL DEFAULT '',
        period VARCHAR(191) NOT NULL DEFAULT '',
        description TEXT NOT NULL,
        badge VARCHAR(191) NOT NULL DEFAULT '',
        company VARCHAR(191) NOT NULL DEFAULT '',
        platform VARCHAR(64) NOT NULL DEFAULT '',
        stack TEXT NULL,
        highlights TEXT NULL,
        link VARCHAR(512) NOT NULL DEFAULT '',
        featured TINYINT NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        enabled TINYINT NOT NULL DEFAULT 1,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        PRIMARY KEY (id),
        KEY idx_works_sort (sort_order, enabled),
        KEY idx_works_featured (featured, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    )
    .run()

  await ensureWorkColumns(db)

  const count = await db.prepare('SELECT COUNT(*) AS c FROM works').first<{ c: number }>()
  if (Number(count?.c ?? 0) > 0) return

  const now = new Date().toISOString()
  await db.batch(
    DEFAULT_WORKS.map((work, index) =>
      db
        .prepare(
          `INSERT INTO works (
            id, title, role, period, description,
            badge, company, platform, stack, highlights, link, featured,
            sort_order, enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          work.title,
          work.role,
          work.period,
          work.description,
          work.badge,
          work.company,
          work.platform,
          work.stack,
          work.highlights,
          work.link,
          work.featured ? 1 : 0,
          index + 1,
          work.enabled ? 1 : 0,
          now,
          now,
        ),
    ),
  )
}

export async function listWorks(db: AppDb, opts?: { enabledOnly?: boolean }): Promise<Work[]> {
  await ensureWorksTable(db)
  const sql = opts?.enabledOnly
    ? `SELECT ${COLUMNS} FROM works WHERE enabled = 1 ORDER BY featured DESC, sort_order ASC, created_at DESC`
    : `SELECT ${COLUMNS} FROM works ORDER BY featured DESC, sort_order ASC, created_at DESC`
  const result = await db.prepare(sql).all<WorkRow>()
  return (result.results ?? []).map(toWork)
}

export async function findWorkById(db: AppDb, id: string) {
  await ensureWorksTable(db)
  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM works WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<WorkRow>()
  return row ? toWork(row) : null
}

function normalizeLink(link: string) {
  const value = link.trim()
  if (!value) return ''
  if (value.startsWith('/') || /^https?:\/\//i.test(value)) return value
  throw new Error('项目链接需为站内路径或 http(s) 地址')
}

function parseInput(input: WorkInput) {
  const title = input.title.trim()
  if (!title) throw new Error('请填写作品标题')
  return {
    title,
    role: input.role.trim(),
    period: input.period.trim(),
    description: input.description.trim(),
    badge: input.badge.trim(),
    company: input.company.trim(),
    platform: input.platform.trim(),
    stack: input.stack.trim(),
    highlights: input.highlights.trim(),
    link: normalizeLink(input.link),
    featured: Boolean(input.featured),
    enabled: input.enabled,
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
  }
}

export async function createWork(db: AppDb, input: WorkInput) {
  await ensureWorksTable(db)
  const data = parseInput(input)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const sortOrder =
    data.sortOrder > 0
      ? data.sortOrder
      : ((await db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM works').first<{
          m: number
        }>())?.m ?? 0) + 1

  await db
    .prepare(
      `INSERT INTO works (
        id, title, role, period, description,
        badge, company, platform, stack, highlights, link, featured,
        sort_order, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      data.title,
      data.role,
      data.period,
      data.description,
      data.badge,
      data.company,
      data.platform,
      data.stack,
      data.highlights,
      data.link,
      data.featured ? 1 : 0,
      sortOrder,
      data.enabled ? 1 : 0,
      now,
      now,
    )
    .run()

  return (await findWorkById(db, id))!
}

export async function updateWork(db: AppDb, id: string, input: WorkInput) {
  await ensureWorksTable(db)
  const existing = await findWorkById(db, id)
  if (!existing) throw new Error('作品不存在')
  const data = parseInput(input)

  const now = new Date().toISOString()
  await db
    .prepare(
      `UPDATE works
       SET title = ?, role = ?, period = ?, description = ?,
           badge = ?, company = ?, platform = ?, stack = ?, highlights = ?, link = ?, featured = ?,
           sort_order = ?, enabled = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      data.title,
      data.role,
      data.period,
      data.description,
      data.badge,
      data.company,
      data.platform,
      data.stack,
      data.highlights,
      data.link,
      data.featured ? 1 : 0,
      data.sortOrder,
      data.enabled ? 1 : 0,
      now,
      id,
    )
    .run()

  return (await findWorkById(db, id))!
}

export async function patchWorkEnabled(db: AppDb, id: string, enabled: boolean) {
  await ensureWorksTable(db)
  const existing = await findWorkById(db, id)
  if (!existing) throw new Error('作品不存在')

  const now = new Date().toISOString()
  await db
    .prepare('UPDATE works SET enabled = ?, updated_at = ? WHERE id = ?')
    .bind(enabled ? 1 : 0, now, id)
    .run()

  return (await findWorkById(db, id))!
}

export async function deleteWork(db: AppDb, id: string) {
  await ensureWorksTable(db)
  const result = await db.prepare('DELETE FROM works WHERE id = ?').bind(id).run()
  return (result.meta?.changes ?? 0) > 0
}
