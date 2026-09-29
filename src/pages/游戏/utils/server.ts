export const GAME_PLATFORMS = ['FC', '街机'] as const
export type GamePlatform = (typeof GAME_PLATFORMS)[number]

export const GAME_CATEGORIES = ['FC', 'SFC', '街机'] as const
export type GameCategory = (typeof GAME_CATEGORIES)[number]

/** FC 二级类型（与 yikm `/nes?tag=&e=0` 对齐；全部对应 tag=0） */
export const FC_GENRES = [
  '动作冒险',
  '飞行射击',
  '格斗',
  '棋牌',
  '射击',
  '运动比赛',
  '小游戏',
  '角色扮演',
] as const
export type FcGenre = (typeof FC_GENRES)[number]

/** 街机二级类型（与 yikm `/nes?tag=&e=1` 对齐；全部对应 tag=9） */
export const ARCADE_GENRES = [
  '动作',
  '格斗',
  '射击',
  '赛车',
  '体育',
  '益智',
  '游戏',
  '其他',
] as const
export type ArcadeGenre = (typeof ARCADE_GENRES)[number]

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

export type GameDetailResult = {
  game: PublicGame
}

export function genresForPlatform(platform: GamePlatform) {
  return platform === '街机' ? ARCADE_GENRES : FC_GENRES
}

export async function fetchGameList(options: {
  page?: number
  pageSize?: number
  q?: string
  /** 列表：FC / 街机；搜索合并：all 或不传 */
  category?: GamePlatform | 'all'
  genre?: string
  signal?: AbortSignal
}): Promise<GameListResult> {
  const params = new URLSearchParams()
  params.set('page', String(options.page ?? 1))
  params.set('pageSize', String(options.pageSize ?? 20))
  if (options.category && options.category !== 'all') {
    params.set('category', options.category)
  } else if (options.q?.trim()) {
    params.set('category', 'all')
  } else {
    params.set('category', 'FC')
  }
  if (options.q?.trim()) params.set('q', options.q.trim())
  if (options.genre?.trim()) params.set('genre', options.genre.trim())

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

/** FBNeo 用 zip 文件名识别 romset，必须与 CDN 上一致 */
export function arcadeRomsetFile(downloadUrl: string) {
  try {
    const name = decodeURIComponent(new URL(downloadUrl).pathname.split('/').pop() || '')
    if (/\.zip$/i.test(name)) return name
  } catch {
    /* ignore */
  }
  return 'rom.zip'
}

export function arcadeBiosFile(downloadUrl: string) {
  if (/\/snk-neo-geo\//i.test(downloadUrl)) return 'neogeo.zip'
  if (/\/pgm\//i.test(downloadUrl)) return 'pgm.zip'
  return null
}

export function arcadeNeedsBios(downloadUrl: string) {
  return arcadeBiosFile(downloadUrl) !== null
}

export function gameRomUrl(id: string, downloadUrl?: string) {
  if (downloadUrl) {
    const file = arcadeRomsetFile(downloadUrl)
    return `/api/game/rom/${encodeURIComponent(file)}?id=${encodeURIComponent(id)}`
  }
  return `/api/game/rom?id=${encodeURIComponent(id)}`
}

export function gameBiosUrl(id: string, downloadUrl: string) {
  const file = arcadeBiosFile(downloadUrl) || 'bios.zip'
  return `/api/game/bios/${encodeURIComponent(file)}?id=${encodeURIComponent(id)}`
}
