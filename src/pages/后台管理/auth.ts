export type UserRole = 'admin' | 'editor' | 'viewer'
export type UserStatus = 'active' | 'disabled'

export type AdminUser = {
  id: string
  username: string
  displayName: string
  role: UserRole
  status: UserStatus
  email: string
  createdAt: string
}

export type AdminSession = {
  username: string
  displayName: string
  role: UserRole
  userId: string
}

type ApiErrorBody = { error?: string }
type MeResponse = { user: AdminUser }
type LoginResponse = { user: AdminUser; loggedInAt: string }
type UsersResponse = { users: AdminUser[] }
type UserResponse = { user: AdminUser }

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  let data: unknown = null
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof (data as ApiErrorBody).error === 'string'
        ? (data as ApiErrorBody).error!
        : `请求失败 (${response.status})`
    throw new ApiError(message, response.status)
  }

  return data as T
}

export async function fetchMe(): Promise<AdminSession | null> {
  try {
    const data = await request<MeResponse>('/api/admin/me')
    return {
      userId: data.user.id,
      username: data.user.username,
      displayName: data.user.displayName,
      role: data.user.role,
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export async function login(username: string, password: string): Promise<AdminSession> {
  const data = await request<LoginResponse>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  return {
    userId: data.user.id,
    username: data.user.username,
    displayName: data.user.displayName,
    role: data.user.role,
  }
}

export async function logout() {
  await request<{ ok: boolean }>('/api/admin/logout', { method: 'POST' })
}

export async function listUsers() {
  const data = await request<UsersResponse>('/api/admin/users')
  return data.users
}

export type UserInput = {
  username: string
  displayName: string
  email: string
  role: UserRole
  status: UserStatus
  password?: string
}

export async function createUser(input: UserInput) {
  const data = await request<UserResponse>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.user
}

export async function updateUser(id: string, input: UserInput) {
  const data = await request<UserResponse>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return data.user
}

export async function patchUserStatus(id: string, status: UserStatus) {
  const data = await request<UserResponse>(`/api/admin/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return data.user
}

export async function deleteUser(id: string) {
  await request<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export type VideoSource = {
  id: string
  name: string
  url: string
  enabled: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type VideoSourceInput = {
  name: string
  url: string
  enabled: boolean
  sortOrder: number
}

type SourcesResponse = { sources: VideoSource[] }
type SourceResponse = { source: VideoSource }

export async function listVideoSources() {
  const data = await request<SourcesResponse>('/api/admin/video-sources')
  return data.sources
}

export async function createVideoSource(input: VideoSourceInput) {
  const data = await request<SourceResponse>('/api/admin/video-sources', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.source
}

export async function updateVideoSource(id: string, input: VideoSourceInput) {
  const data = await request<SourceResponse>(`/api/admin/video-sources/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return data.source
}

export async function patchVideoSourceEnabled(id: string, enabled: boolean) {
  const data = await request<SourceResponse>(
    `/api/admin/video-sources/${encodeURIComponent(id)}/enabled`,
    {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    },
  )
  return data.source
}

export async function deleteVideoSource(id: string) {
  await request<{ ok: boolean }>(`/api/admin/video-sources/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export const GAME_CATEGORIES = ['FC', 'SFC', '街机'] as const
export type GameCategory = (typeof GAME_CATEGORIES)[number]

export type Game = {
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

export type GameInput = {
  name: string
  downloadUrl: string
  imageUrl: string
  category: GameCategory
  genre: string
  recommended: boolean
}

type GamesResponse = { games: Game[] }
type GameResponse = { game: Game }

export async function listGames() {
  const data = await request<GamesResponse>('/api/admin/games')
  return data.games
}

export async function createGame(input: GameInput) {
  const data = await request<GameResponse>('/api/admin/games', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.game
}

export async function updateGame(id: string, input: GameInput) {
  const data = await request<GameResponse>(`/api/admin/games/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return data.game
}

export async function patchGameRecommended(id: string, recommended: boolean) {
  const data = await request<GameResponse>(
    `/api/admin/games/${encodeURIComponent(id)}/recommended`,
    {
      method: 'PATCH',
      body: JSON.stringify({ recommended }),
    },
  )
  return data.game
}

export async function deleteGame(id: string) {
  await request<{ ok: boolean }>(`/api/admin/games/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export type ImportYikmResult = {
  ok: boolean
  scraped: number
  created: number
  updated: number
  fromPage: number
  toPage: number
  games: Game[]
}

/** 从 yikm.net FC 列表采集（默认第 1–10 页） */
export async function importGamesFromYikm(fromPage = 1, toPage = 10) {
  return request<ImportYikmResult>('/api/admin/games/import-yikm', {
    method: 'POST',
    body: JSON.stringify({ fromPage, toPage }),
  })
}

export type EducationSource = {
  id: string
  name: string
  ext: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type EducationSourceInput = {
  name: string
  ext: string
  sortOrder: number
}

type EducationSourcesResponse = { sources: EducationSource[] }
type EducationSourceResponse = { source: EducationSource }

export async function listEducationSources() {
  const data = await request<EducationSourcesResponse>('/api/admin/education-sources')
  return data.sources
}

export async function createEducationSource(input: EducationSourceInput) {
  const data = await request<EducationSourceResponse>('/api/admin/education-sources', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.source
}

export async function updateEducationSource(id: string, input: EducationSourceInput) {
  const data = await request<EducationSourceResponse>(
    `/api/admin/education-sources/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  )
  return data.source
}

export async function deleteEducationSource(id: string) {
  await request<{ ok: boolean }>(`/api/admin/education-sources/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export type EducationImportResult = {
  created: number
  updated: number
  failed: Array<{ label: string; reason: string }>
  sources: EducationSource[]
}

/** 粘贴 TVBox csp_Bili 站点数组 / 单条 / ext URL，批量导入 */
export async function importEducationSources(raw: string) {
  return request<EducationImportResult>('/api/admin/education-sources/import', {
    method: 'POST',
    body: JSON.stringify({ raw }),
  })
}

export type EducationCookieConfig = {
  cookie: string
  updatedAt: string
}

export async function getEducationCookie() {
  return request<EducationCookieConfig>('/api/admin/education-cookie')
}

export async function updateEducationCookie(cookie: string) {
  return request<EducationCookieConfig>('/api/admin/education-cookie', {
    method: 'PUT',
    body: JSON.stringify({ cookie }),
  })
}
