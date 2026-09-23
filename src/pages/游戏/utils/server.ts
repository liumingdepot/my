export const GAME_CATEGORIES = ['FC', 'SFC', '街机'] as const
export type GameCategory = (typeof GAME_CATEGORIES)[number]

export type PublicGame = {
  id: string
  name: string
  downloadUrl: string
  imageUrl: string
  category: GameCategory
  genre: string
  recommended: boolean
  createdAt: string
  updatedAt: string
}

export type GameListResult = {
  items: PublicGame[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type FeaturedResult = {
  games: PublicGame[]
}

export type GameDetailResult = {
  game: PublicGame
}

export async function fetchFeaturedGames(limit = 12, signal?: AbortSignal): Promise<PublicGame[]> {
  const res = await fetch(`/api/game/featured?limit=${limit}`, signal ? { signal } : undefined)
  const data = (await res.json()) as FeaturedResult & { error?: string }
  if (!res.ok) throw new Error(data.error || '热门游戏加载失败')
  return data.games
}

export async function fetchGameList(options: {
  page?: number
  pageSize?: number
  q?: string
  category?: string
  signal?: AbortSignal
}): Promise<GameListResult> {
  const params = new URLSearchParams()
  params.set('page', String(options.page ?? 1))
  params.set('pageSize', String(options.pageSize ?? 24))
  if (options.q?.trim()) params.set('q', options.q.trim())
  if (options.category?.trim()) params.set('category', options.category.trim())

  const res = await fetch(`/api/game/list?${params}`, options.signal ? { signal: options.signal } : undefined)
  const data = (await res.json()) as GameListResult & { error?: string }
  if (!res.ok) throw new Error(data.error || '游戏列表加载失败')
  return data
}

export async function fetchGameDetail(id: string, signal?: AbortSignal): Promise<PublicGame> {
  const res = await fetch(
    `/api/game/detail?id=${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  )
  const data = (await res.json()) as GameDetailResult & { error?: string }
  if (!res.ok) throw new Error(data.error || '游戏详情加载失败')
  return data.game
}

export function gameRomUrl(id: string) {
  return `/api/game/rom?id=${encodeURIComponent(id)}`
}
