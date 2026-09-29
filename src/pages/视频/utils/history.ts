import type { MergedEntry } from './types'

const WATCH_KEY = 'video-watch-history'
const SEARCH_KEY = 'video-search-history'
const WATCH_EVENT = 'video-watch-history'
const SEARCH_EVENT = 'video-search-history'
const MAX_WATCH = 40
const MAX_SEARCH = 20

export type WatchHistoryItem = {
  source: string
  vod_id: string
  vod_name: string
  vod_pic: string
  vod_remarks: string
  vod_year: string
  type_name: string
  episode?: string
  mirrors?: MergedEntry[]
  watchedAt: number
}

function watchKey(item: Pick<WatchHistoryItem, 'source' | 'vod_id'>) {
  return `${item.source}::${item.vod_id}`
}

function isWatchItem(value: unknown): value is WatchHistoryItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<WatchHistoryItem>
  return Boolean(item.source && item.vod_id != null && item.vod_name)
}

export function readWatchHistory(): WatchHistoryItem[] {
  try {
    const raw = localStorage.getItem(WATCH_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isWatchItem)
      .map((item) => ({
        ...item,
        vod_id: String(item.vod_id),
        vod_pic: item.vod_pic || '',
        vod_remarks: item.vod_remarks || '',
        vod_year: item.vod_year || '',
        type_name: item.type_name || '',
        watchedAt: typeof item.watchedAt === 'number' ? item.watchedAt : Date.now(),
      }))
  } catch {
    return []
  }
}

function writeWatchHistory(list: WatchHistoryItem[]) {
  localStorage.setItem(WATCH_KEY, JSON.stringify(list.slice(0, MAX_WATCH)))
  window.dispatchEvent(new Event(WATCH_EVENT))
}

export function saveWatchHistory(
  input: Omit<WatchHistoryItem, 'watchedAt'> & { watchedAt?: number },
): WatchHistoryItem[] {
  const payload: WatchHistoryItem = {
    ...input,
    vod_id: String(input.vod_id),
    watchedAt: input.watchedAt ?? Date.now(),
  }
  const key = watchKey(payload)
  const next = [payload, ...readWatchHistory().filter((item) => watchKey(item) !== key)]
  writeWatchHistory(next)
  return next
}

export function deleteWatchHistory(source: string, vodId: string | number): WatchHistoryItem[] {
  const key = `${source}::${vodId}`
  const next = readWatchHistory().filter((item) => watchKey(item) !== key)
  writeWatchHistory(next)
  return next
}

export function clearWatchHistory() {
  writeWatchHistory([])
}

export function subscribeWatchHistory(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(WATCH_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(WATCH_EVENT, onChange)
  }
}

export function readSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, MAX_SEARCH)
  } catch {
    return []
  }
}

function writeSearchHistory(list: string[]) {
  localStorage.setItem(SEARCH_KEY, JSON.stringify(list.slice(0, MAX_SEARCH)))
  window.dispatchEvent(new Event(SEARCH_EVENT))
}

export function saveSearchHistory(keyword: string): string[] {
  const q = keyword.trim()
  if (!q) return readSearchHistory()
  const next = [q, ...readSearchHistory().filter((item) => item !== q)]
  writeSearchHistory(next)
  return next
}

export function deleteSearchHistory(keyword: string): string[] {
  const next = readSearchHistory().filter((item) => item !== keyword)
  writeSearchHistory(next)
  return next
}

export function clearSearchHistory() {
  writeSearchHistory([])
}

export function subscribeSearchHistory(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(SEARCH_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(SEARCH_EVENT, onChange)
  }
}
