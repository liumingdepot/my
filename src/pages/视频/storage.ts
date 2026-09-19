import type { ProgressKey, VodItem } from './types'

const FAV_KEY = 'video-fav'
const HISTORY_KEY = 'video-search-history'
const PROGRESS_KEY = 'video-progress'
const SOURCES_KEY = 'video-active-sources'
const DEFAULT_FLAG = 'video-default-sources'
const DEFAULT_SOURCES = ['量子', '红牛']
const WELFARE_KEY = 'video-welfare-ok'
const WELFARE_PASSWORD = '123'
const WELFARE_SOURCES = new Set(['福利1', '福利2'])
const DROPPED_SOURCES = new Set(['卧龙', 'U酷', '闪电', '推荐4', '推荐5'])

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function getFavorites(): VodItem[] {
  return readJson(FAV_KEY, [])
}

export function isFavorite(item: VodItem) {
  return getFavorites().some((e) => e.vod_id === item.vod_id && e.source === item.source)
}

export function toggleFavorite(item: VodItem) {
  const list = getFavorites()
  const idx = list.findIndex((e) => e.vod_id === item.vod_id && e.source === item.source)
  if (idx >= 0) {
    list.splice(idx, 1)
  } else {
    list.unshift(item)
  }
  localStorage.setItem(FAV_KEY, JSON.stringify(list.slice(0, 200)))
  return idx < 0
}

export function getSearchHistory(): string[] {
  return readJson(HISTORY_KEY, [])
}

export function pushSearchHistory(q: string) {
  const next = [q, ...getSearchHistory().filter((e) => e !== q)].slice(0, 20)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  return next
}

export function removeSearchHistory(q: string) {
  const next = getSearchHistory().filter((e) => e !== q)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  return next
}

export function clearSearchHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([]))
}

export function getActiveSources(): string[] {
  if (localStorage.getItem(DEFAULT_FLAG) !== '量子,红牛') {
    localStorage.setItem(DEFAULT_FLAG, '量子,红牛')
    localStorage.setItem(SOURCES_KEY, JSON.stringify(DEFAULT_SOURCES))
    return DEFAULT_SOURCES
  }
  const saved = readJson<string[]>(SOURCES_KEY, []).filter((name) => !DROPPED_SOURCES.has(name))
  return saved.length ? saved : DEFAULT_SOURCES
}

export function setActiveSources(names: string[]) {
  localStorage.setItem(SOURCES_KEY, JSON.stringify(names))
}

export function isWelfareSource(name: string) {
  return WELFARE_SOURCES.has(name)
}

export function isWelfareUnlocked() {
  return sessionStorage.getItem(WELFARE_KEY) === '1'
}

export function unlockWelfare(password: string) {
  if (password !== WELFARE_PASSWORD) return false
  sessionStorage.setItem(WELFARE_KEY, '1')
  return true
}

export function getProgress(vodId: string | number, source: string): ProgressKey | null {
  const map = readJson<Record<string, ProgressKey>>(PROGRESS_KEY, {})
  return map[`${source}:${vodId}`] || null
}

export function setProgress(p: ProgressKey) {
  const map = readJson<Record<string, ProgressKey>>(PROGRESS_KEY, {})
  map[`${p.source}:${p.vod_id}`] = p
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(map))
}
