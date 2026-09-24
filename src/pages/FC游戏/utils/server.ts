export const GAME_CATEGORIES = ['FC', 'SFC', '街机'] as const
export type GameCategory = (typeof GAME_CATEGORIES)[number]

/** 顶部类型筛选（与 yikm tag 对齐） */
export const GAME_GENRES = [
  '动作冒险',
  '飞行射击',
  '格斗',
  '棋牌',
  '射击',
  '运动比赛',
  '小游戏',
  '角色扮演',
] as const
export type GameGenre = (typeof GAME_GENRES)[number]

export type PublicGame = {
  id: string
  name: string
  downloadUrl: string
  imageUrl: string
  category: GameCategory
  genre: string
  sortOrder?: number
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
  genre?: string
  recommended?: boolean
  signal?: AbortSignal
}): Promise<GameListResult> {
  const params = new URLSearchParams()
  params.set('page', String(options.page ?? 1))
  params.set('pageSize', String(options.pageSize ?? 24))
  if (options.q?.trim()) params.set('q', options.q.trim())
  if (options.category?.trim()) params.set('category', options.category.trim())
  if (options.genre?.trim()) params.set('genre', options.genre.trim())
  if (options.recommended === true) params.set('recommended', '1')
  if (options.recommended === false) params.set('recommended', '0')

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
