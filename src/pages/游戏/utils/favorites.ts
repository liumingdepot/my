import type { GameCategory, PublicGame } from './server'

/**
 * 收藏：纯本地数据，不经过服务端。
 *
 * 存的是游戏元信息快照（含分类），因此「收藏」列表可以直接从本地缓存渲染，
 * 无需再请求列表接口；同时也不会因上游列表翻页而漏掉已收藏的游戏。
 */

const KEY = 'game:favorites'

export type FavoriteGame = {
  id: string
  name: string
  imageUrl: string
  category: GameCategory
  genre: string
  savedAt: number
}

const listeners = new Set<() => void>()

/** 快照缓存：保证 getSnapshot 在数据未变时返回同一引用 */
let rawCache: string | null = null
let listCache: FavoriteGame[] = []

function hasStorage() {
  return typeof localStorage !== 'undefined'
}

function parse(raw: string): FavoriteGame[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is FavoriteGame =>
        !!item && typeof item === 'object' && typeof (item as FavoriteGame).id === 'string',
    )
  } catch {
    return []
  }
}

function readRaw() {
  if (!hasStorage()) return ''
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

function emit() {
  for (const fn of listeners) fn()
}

export function listFavorites(): FavoriteGame[] {
  const raw = readRaw()
  if (raw !== rawCache) {
    rawCache = raw
    listCache = parse(raw)
  }
  return listCache
}

export function isFavorite(id: string) {
  return listFavorites().some((item) => item.id === id)
}

function persist(list: FavoriteGame[]) {
  if (!hasStorage()) return
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* 隐私模式下写入失败可忽略 */
  }
  // 主动同步缓存，避免同一次事件里读到旧值
  rawCache = JSON.stringify(list)
  listCache = list
  emit()
}

/** 切换收藏状态，返回切换后的状态 */
export function toggleFavorite(game: PublicGame): boolean {
  const current = listFavorites()
  const exists = current.some((item) => item.id === game.id)

  if (exists) {
    persist(current.filter((item) => item.id !== game.id))
    return false
  }

  const next: FavoriteGame[] = [
    {
      id: game.id,
      name: game.name,
      imageUrl: game.imageUrl,
      category: game.category,
      genre: game.genre,
      savedAt: Date.now(),
    },
    // 最近收藏的排在前面
    ...current,
  ]
  persist(next)
  return true
}

export function subscribeFavorites(fn: () => void) {
  listeners.add(fn)
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === KEY) {
      rawCache = null
      emit()
    }
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}