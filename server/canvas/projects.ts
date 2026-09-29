import type { AppDb } from '../utils/db.js'

export type CanvasProjectRow = {
  id: string
  title: string
  prompt: string
  content: string
  created_at: string
  updated_at: string
}

export type CanvasProject = {
  id: string
  title: string
  prompt: string
  content: string
  createdAt: string
  updatedAt: string
}

export async function ensureCanvasProjectsTable(db: AppDb) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS canvas_projects (
        id VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        prompt MEDIUMTEXT NOT NULL,
        content MEDIUMTEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        PRIMARY KEY (id),
        KEY idx_canvas_projects_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    )
    .run()
}

function mapRow(row: CanvasProjectRow): CanvasProject {
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt || '',
    content: row.content || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listCanvasProjects(db: AppDb): Promise<CanvasProject[]> {
  await ensureCanvasProjectsTable(db)
  const { results } = await db
    .prepare(
      `SELECT id, title, prompt, content, created_at, updated_at
       FROM canvas_projects
       ORDER BY updated_at DESC`,
    )
    .all<CanvasProjectRow>()
  return results.map(mapRow)
}

export async function findCanvasProjectById(
  db: AppDb,
  id: string,
): Promise<CanvasProject | null> {
  await ensureCanvasProjectsTable(db)
  const row = await db
    .prepare(
      `SELECT id, title, prompt, content, created_at, updated_at
       FROM canvas_projects WHERE id = ?`,
    )
    .bind(id)
    .first<CanvasProjectRow>()
  return row ? mapRow(row) : null
}

export async function createCanvasProject(
  db: AppDb,
  input: { title?: string; prompt?: string; content?: string } = {},
): Promise<CanvasProject> {
  await ensureCanvasProjectsTable(db)
  const now = new Date().toISOString()
  const item: CanvasProject = {
    id: crypto.randomUUID(),
    title: (input.title || '未命名短剧').trim() || '未命名短剧',
    prompt: input.prompt || '',
    content: input.content || '',
    createdAt: now,
    updatedAt: now,
  }
  await db
    .prepare(
      `INSERT INTO canvas_projects (id, title, prompt, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(item.id, item.title, item.prompt, item.content, item.createdAt, item.updatedAt)
    .run()
  return item
}

export async function updateCanvasProject(
  db: AppDb,
  id: string,
  input: { title?: string; prompt?: string; content?: string },
): Promise<CanvasProject | null> {
  await ensureCanvasProjectsTable(db)
  const existing = await findCanvasProjectById(db, id)
  if (!existing) return null

  const next: CanvasProject = {
    ...existing,
    title:
      input.title !== undefined
        ? input.title.trim() || existing.title
        : existing.title,
    prompt: input.prompt !== undefined ? input.prompt : existing.prompt,
    content: input.content !== undefined ? input.content : existing.content,
    updatedAt: new Date().toISOString(),
  }

  await db
    .prepare(
      `UPDATE canvas_projects
       SET title = ?, prompt = ?, content = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(next.title, next.prompt, next.content, next.updatedAt, id)
    .run()

  return next
}

export async function deleteCanvasProject(db: AppDb, id: string): Promise<boolean> {
  await ensureCanvasProjectsTable(db)
  const result = await db
    .prepare('DELETE FROM canvas_projects WHERE id = ?')
    .bind(id)
    .run()
  return result.meta.changes > 0
}
