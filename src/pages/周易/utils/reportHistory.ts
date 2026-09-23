export type ReportKind = 'lots' | 'casual' | 'bazi' | 'hehun' | 'liunian'

export type ReportPayload = {
  id: string
  createdAt: number
  kind: ReportKind
  title: string
  name: string
  gender?: string
  bazi?: string
  question?: string
  meta?: string[]
  report: string
}

const HISTORY_KEY = 'zhouyi-report-history'
const CURRENT_KEY = 'zhouyi-report'
const MAX_HISTORY = 40

const KIND_LABEL: Record<ReportKind, string> = {
  lots: '在线抽签',
  casual: '算一卦',
  bazi: '八字精批',
  hehun: '合婚配对',
  liunian: '流年运势',
}

export function kindLabel(kind: ReportKind) {
  return KIND_LABEL[kind]
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function isReport(value: unknown): value is ReportPayload {
  if (!value || typeof value !== 'object') return false
  const report = value as Partial<ReportPayload>
  return Boolean(report.id && report.kind && report.title && report.report)
}

function migrateLegacy(value: unknown): ReportPayload | null {
  if (!value || typeof value !== 'object') return null
  const legacy = value as Partial<ReportPayload> & {
    name?: string
    gender?: string
    bazi?: string
    question?: string
    report?: string
  }
  if (!legacy.name || !legacy.report) return null
  if (isReport(legacy)) return legacy
  return {
    id: createId(),
    createdAt: Date.now(),
    kind: 'casual',
    title: `${legacy.name}的报告`,
    name: legacy.name,
    gender: legacy.gender,
    bazi: legacy.bazi,
    question: legacy.question,
    report: legacy.report,
  }
}

export function readHistory(): ReportPayload[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(migrateLegacy).filter((item): item is ReportPayload => Boolean(item))
  } catch {
    return []
  }
}

function writeHistory(list: ReportPayload[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)))
}

export function getReport(id: string): ReportPayload | null {
  return readHistory().find((item) => item.id === id) ?? null
}

export function saveReport(
  input: Omit<ReportPayload, 'id' | 'createdAt'> & { id?: string; createdAt?: number },
): ReportPayload {
  const payload: ReportPayload = {
    ...input,
    id: input.id ?? createId(),
    createdAt: input.createdAt ?? Date.now(),
  }
  const next = [payload, ...readHistory().filter((item) => item.id !== payload.id)]
  writeHistory(next)
  sessionStorage.setItem(CURRENT_KEY, JSON.stringify(payload))
  window.dispatchEvent(new Event('zhouyi-history'))
  return payload
}

export function deleteReport(id: string): ReportPayload[] {
  const next = readHistory().filter((item) => item.id !== id)
  writeHistory(next)
  try {
    const current = sessionStorage.getItem(CURRENT_KEY)
    if (current) {
      const parsed: unknown = JSON.parse(current)
      if (isReport(parsed) && parsed.id === id) {
        sessionStorage.removeItem(CURRENT_KEY)
      }
    }
  } catch {
    sessionStorage.removeItem(CURRENT_KEY)
  }
  window.dispatchEvent(new Event('zhouyi-history'))
  return next
}

export function clearHistory() {
  writeHistory([])
  sessionStorage.removeItem(CURRENT_KEY)
  window.dispatchEvent(new Event('zhouyi-history'))
}

export function readCurrentReport(state: unknown): ReportPayload | null {
  if (isReport(state)) return state
  const migrated = migrateLegacy(state)
  if (migrated) return migrated
  try {
    const saved = sessionStorage.getItem(CURRENT_KEY)
    if (!saved) return null
    return migrateLegacy(JSON.parse(saved))
  } catch {
    return null
  }
}

export function formatHistoryTime(createdAt: number) {
  const date = new Date(createdAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
