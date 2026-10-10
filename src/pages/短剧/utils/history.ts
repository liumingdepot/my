const WATCH_KEY = 'short-watch-history'
const SEARCH_KEY = 'short-search-history'
const WATCH_EVENT = 'short-watch-history'
const SEARCH_EVENT = 'short-search-history'
const MAX_WATCH = 40
const MAX_SEARCH = 20

export type WatchHistoryItem = {
  id: string
  title: string
  pic: string
  sub: string
  episode?: string
  watchedAt: number
}

function isWatchItem(value: unknown): value is WatchHistoryItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<WatchHistoryItem>
  return Boolean(item.id != null && item.title)
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
        id: String(item.id),
        pic: item.pic || '',
        sub: item.sub || '',
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
    id: String(input.id),
    watchedAt: input.watchedAt ?? Date.now(),
  }
  const next = [payload, ...readWatchHistory().filter((item) => item.id !== payload.id)]
  writeWatchHistory(next)
  return next
}

export function deleteWatchHistory(id: string | number): WatchHistoryItem[] {
  const key = String(id)
  const next = readWatchHistory().filter((item) => item.id !== key)
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
