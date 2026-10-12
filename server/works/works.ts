import type { AppDb } from '../utils/db.js'

/** 作品 = 前台 /works 页「项目经历」里的每一条记录 */
export type WorkRow = {
  id: string
  title: string
  role: string
  period: string
  description: string
  image: string
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
  /** 图片地址：站内路径（/xxx.jpg）或 data:image/*;base64 */
  image: string
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
  image: string
  enabled: boolean
  sortOrder: number
}

/** base64 图片的字符上限，约对应 2MB 原图 */
export const MAX_IMAGE_LENGTH = 3_000_000

/** 表为空时写入的默认作品，与前台旧假数据保持一致 */
export const DEFAULT_WORKS: Omit<WorkInput, 'sortOrder'>[] = [
  {
    title: '智能协作平台',
    role: '前端负责人',
    period: '2024.03 — 2025.01',
    description:
      '从零搭建多端协作产品，负责组件体系、权限与实时同步，支撑日活万级团队协作场景。',
    image: '/home-hero.jpg',
    enabled: true,
  },
  {
    title: '内容创作中台',
    role: '全栈开发',
    period: '2023.06 — 2024.02',
    description: '打通选题、生产、审核与分发链路，沉淀可复用素材库与审核流，显著缩短内容上线周期。',
    image: '/home-hero.jpg',
    enabled: true,
  },
  {
    title: '数据可视化大屏',
    role: '前端开发',
    period: '2022.11 — 2023.05',
    description: '面向运营与管理层的实时看板，完成地图、图表与告警联动，保障大促期间稳定展示。',
    image: '/home-hero.jpg',
    enabled: true,
  },
  {
    title: '移动端增长工具',
    role: '独立开发',
    period: '2022.03 — 2022.10',
    description: '活动页搭建与投放归因一体化工具，支持配置化落地页与渠道追踪，服务多场营销活动。',
    image: '/home-hero.jpg',
    enabled: true,
  },
]

const COLUMNS = 'id, title, role, period, description, image, sort_order, enabled, created_at, updated_at'

export function toWork(row: WorkRow): Work {
  return {
    id: row.id,
    title: row.title,
    role: row.role ?? '',
    period: row.period ?? '',
    description: row.description ?? '',
    image: row.image ?? '',
    sortOrder: Number(row.sort_order ?? 0),
    enabled: Number(row.enabled) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
        image MEDIUMTEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        enabled TINYINT NOT NULL DEFAULT 1,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        PRIMARY KEY (id),
        KEY idx_works_sort (sort_order, enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    )
    .run()

  const count = await db.prepare('SELECT COUNT(*) AS c FROM works').first<{ c: number }>()
  if (Number(count?.c ?? 0) > 0) return

  const now = new Date().toISOString()
  await db.batch(
    DEFAULT_WORKS.map((work, index) =>
      db
        .prepare(
          `INSERT INTO works (id, title, role, period, description, image, sort_order, enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          work.title,
          work.role,
          work.period,
          work.description,
          work.image,
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
    ? `SELECT ${COLUMNS} FROM works WHERE enabled = 1 ORDER BY sort_order ASC, created_at DESC`
    : `SELECT ${COLUMNS} FROM works ORDER BY sort_order ASC, created_at DESC`
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

function normalizeImage(image: string) {
  const value = image.trim()
  if (!value) throw new Error('请填写作品图片')
  if (value.length > MAX_IMAGE_LENGTH) throw new Error('图片过大，请压缩后再上传')
  if (value.startsWith('data:image/')) {
    if (!/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(value)) {
      throw new Error('图片数据无效')
    }
    return value
  }
  if (value.startsWith('/') || /^https?:\/\//i.test(value)) return value
  throw new Error('图片需为站内路径、http(s) 地址或 base64 数据')
}

function parseInput(input: WorkInput) {
  const title = input.title.trim()
  if (!title) throw new Error('请填写作品标题')
  return {
    title,
    role: input.role.trim(),
    period: input.period.trim(),
    description: input.description.trim(),
    image: normalizeImage(input.image),
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
      `INSERT INTO works (id, title, role, period, description, image, sort_order, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      data.title,
      data.role,
      data.period,
      data.description,
      data.image,
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
       SET title = ?, role = ?, period = ?, description = ?, image = ?, sort_order = ?, enabled = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      data.title,
      data.role,
      data.period,
      data.description,
      data.image,
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