/**
 * 历史项目：纯前端本地存储（localStorage）。
 *
 * 数据只存在当前浏览器里，不写入服务器数据库，
 * 换电脑 / 换浏览器 / 清理浏览器数据都会丢失，也无法跨设备同步。
 */

export type CanvasProject = {
  id: string
  title: string
  prompt: string
  content: string
  createdAt: string
  updatedAt: string
}

export const PROJECT_STORAGE_KEY = 'mingai:canvas:projects:v1'

type Listener = () => void

const listeners = new Set<Listener>()

function notify() {
  for (const listener of listeners) listener()
}

function normalizeId(value: unknown): string {
  if (typeof value !== 'string') return ''
  const id = value.trim()
  if (id) return id
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeItem(value: unknown): CanvasProject | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<CanvasProject>
  const id = normalizeId(raw.id)
  if (!id) return null
  const now = new Date().toISOString()
  return {
    id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '未命名短剧',
    prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
  }
}

function readAll(): CanvasProject[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const list: CanvasProject[] = []
    for (const entry of parsed) {
      const item = normalizeItem(entry)
      if (!item || seen.has(item.id)) continue
      seen.add(item.id)
      list.push(item)
    }
    return list
  } catch {
    return []
  }
}

function writeAll(list: CanvasProject[]) {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持本地存储')
  }
  try {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(list))
  } catch {
    throw new Error('本地存储空间不足，项目未能保存')
  }
  notify()
}

function byUpdatedDesc(a: CanvasProject, b: CanvasProject) {
  return (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
}

function mutate(
  id: string,
  updater: (item: CanvasProject) => CanvasProject,
): CanvasProject {
  const list = readAll()
  const index = list.findIndex((item) => item.id === id)
  if (index < 0) throw new Error('项目不存在或已删除')
  const next = updater(list[index]!)
  const merged = list.slice()
  merged[index] = next
  writeAll(merged)
  return next
}

/** 跨标签页同步：别的标签页改了本地存储时通知当前页 */
export function subscribeProjects(listener: Listener): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === PROJECT_STORAGE_KEY || event.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export async function listProjects() {
  return { items: readAll().sort(byUpdatedDesc) }
}

export async function getProject(id: string) {
  const found = readAll().find((item) => item.id === id)
  if (!found) throw new Error('项目不存在或已删除')
  return { item: found }
}

export async function createProject(input?: {
  title?: string
  prompt?: string
  content?: string
}) {
  const now = new Date().toISOString()
  const item: CanvasProject = {
    id: normalizeId(''),
    title: input?.title?.trim() || '未命名短剧',
    prompt: input?.prompt || '',
    content: input?.content || '',
    createdAt: now,
    updatedAt: now,
  }
  writeAll([item, ...readAll()])
  return { item }
}

export async function updateProject(
  id: string,
  input: { title?: string; prompt?: string; content?: string },
) {
  const item = mutate(id, (prev) => ({
    ...prev,
    title: input.title !== undefined ? input.title.trim() || prev.title : prev.title,
    prompt: input.prompt !== undefined ? input.prompt : prev.prompt,
    content: input.content !== undefined ? input.content : prev.content,
    updatedAt: new Date().toISOString(),
  }))
  return { item }
}

export async function deleteProject(id: string) {
  const list = readAll()
  const next = list.filter((item) => item.id !== id)
  if (next.length === list.length) throw new Error('项目不存在或已删除')
  writeAll(next)
  return { ok: true }
}

export function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return ''
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return new Date(ts).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}