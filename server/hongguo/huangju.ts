/**
 * 剧果站源（参考 guoapp provider_huangju）
 * API: https://api.huangju.net
 */

const API_BASE = 'https://api.huangju.net'
const SITE = 'https://huangju.net'
const UA =
  'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36'

export type HuangjuDrama = {
  id: string
  playlet_id: string
  title: string
  image_link: string
  intro: string
  tags: string
  total_episode_num: string
  release_status?: string
  score?: string
}

export type HuangjuEpisode = {
  video_id: string
  sort: string
  title: string
  playable: boolean
  /** 占位，真实地址需调 /play */
  video_url: string
  duration: string
  first_img: string
}

export type HuangjuDetail = HuangjuDrama & {
  play_list: HuangjuEpisode[]
}

export type HuangjuPlayResult = {
  url: string
  cookie?: string
  referer: string
  expiresAt?: string
}

type GuestState = {
  deviceId: string
  token: string
}

let guest: GuestState | null = null
let guestPending: Promise<string> | null = null

function newDeviceId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function payload(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const row = value as Record<string, unknown>
    if (row.data != null && row.id == null && row.items == null && row.url == null) {
      return row.data
    }
  }
  return value
}

async function request(
  method: string,
  route: string,
  opts?: {
    query?: Record<string, string>
    body?: unknown
    token?: string
    limit?: number
  },
): Promise<{ value: unknown; headers: Headers }> {
  const url = new URL(API_BASE + route)
  if (opts?.query) {
    for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v)
  }

  const headers: Record<string, string> = {
    'User-Agent': UA,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    Referer: `${SITE}/`,
    Origin: SITE,
  }
  if (opts?.body != null) headers['Content-Type'] = 'application/json'
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: opts?.body != null ? JSON.stringify(opts.body) : undefined,
    redirect: 'follow',
  })

  const buf = await res.arrayBuffer()
  const limit = opts?.limit ?? 4 << 20
  if (buf.byteLength > limit) throw new Error('剧果返回数据过大')

  const text = new TextDecoder().decode(buf)
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      const err = new Error('剧果访客授权已失效')
      ;(err as Error & { code?: string }).code = 'GUEST_EXPIRED'
      throw err
    }
    throw new Error(`剧果接口 HTTP ${res.status}`)
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(text)
  } catch {
    throw new Error('剧果返回格式无效')
  }

  return { value: decoded, headers: res.headers }
}

async function guestToken(): Promise<string> {
  if (guest?.token) return guest.token
  if (guestPending) return guestPending

  guestPending = (async () => {
    const deviceId = guest?.deviceId || newDeviceId()
    const { value } = await request('POST', '/auth/guest', {
      body: { deviceId },
      limit: 64 << 10,
    })
    const row = (payload(value) || value) as Record<string, unknown>
    let token = typeof row.token === 'string' ? row.token : ''
    if (!token && row.data && typeof row.data === 'object') {
      token = String((row.data as Record<string, unknown>).token || '')
    }
    if (!token || token.length > 8192) throw new Error('剧果未返回有效访客授权')
    guest = { deviceId, token }
    return token
  })()

  try {
    return await guestPending
  } finally {
    guestPending = null
  }
}

async function authGet(route: string, query?: Record<string, string>, limit?: number) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await guestToken()
    try {
      return await request('GET', route, { query, token, limit })
    } catch (e) {
      const err = e as Error & { code?: string }
      if (attempt === 0 && err.code === 'GUEST_EXPIRED') {
        if (guest?.token === token) guest.token = ''
        continue
      }
      throw e
    }
  }
  throw new Error('剧果访客授权已失效，请重试')
}

function dramaFromRow(row: Record<string, unknown>): HuangjuDrama {
  const id = String(row.id || '')
  const slug = String(row.slug || '')
  const title = String(row.title || '').trim()
  if (!id || !title) throw new Error('剧果剧集信息不完整')

  const sourceId =
    slug && id ? `${slug}-${id}` : String(row.sourceId || row.source_id || `${slug}-${id}`)
  if (!sourceId.endsWith(`-${id}`)) throw new Error('剧果剧集地址无效')

  const cover = String(row.coverUrl || row.cover || '')
  const episodes = row.totalEpisodes != null ? String(row.totalEpisodes) : ''
  const cats: string[] = []
  if (row.category && typeof row.category === 'object') {
    const name = (row.category as Record<string, unknown>).name
    if (typeof name === 'string' && name) cats.push(name)
  }
  if (Array.isArray(row.categories)) {
    for (const c of row.categories) {
      if (typeof c === 'string') cats.push(c)
      else if (c && typeof c === 'object') {
        const name = (c as Record<string, unknown>).name
        if (typeof name === 'string' && name) cats.push(name)
      }
    }
  }
  const region = typeof row.region === 'string' ? row.region : ''
  const year = row.year != null ? `${row.year}年` : ''
  const tags = [...cats, region, year].filter(Boolean).join(' ')

  return {
    id: sourceId,
    playlet_id: sourceId,
    title,
    image_link: cover.startsWith('//') ? `https:${cover}` : cover,
    intro: String(row.description || ''),
    tags,
    total_episode_num: episodes,
    release_status: row.status === 'completed' || row.status === 'ongoing' ? String(row.status) : '',
    score: row.score != null ? String(row.score) : '',
  }
}

export async function huangjuCategories() {
  const { value } = await authGet('/categories', undefined, 256 << 10)
  const rows = payload(value)
  if (!Array.isArray(rows)) throw new Error('剧果分类格式无效')
  const list = [{ id: '@new', name: '最新' }]
  for (const entry of rows) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const id = String(row.slug || '')
    const name = String(row.name || '')
    if (!id || id === 'hot' || !name) continue
    list.push({ id, name })
  }
  return list
}

export async function huangjuCatalog(opts: {
  page?: number
  category?: string
  query?: string
}) {
  const page = Math.max(1, Math.floor(opts.page || 1))
  const query: Record<string, string> = { page: String(page) }
  if (opts.query) query.q = opts.query
  else if (opts.category === '@new') query.sort = 'new'
  else if (opts.category) query.category = opts.category
  else query.sort = 'hot'

  const { value } = await authGet('/dramas', query, 4 << 20)
  const row = (payload(value) || {}) as Record<string, unknown>
  const items = Array.isArray(row.items) ? row.items : []
  const pageSize = Number(row.pageSize) || 20
  const total = row.total != null ? Number(row.total) : items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const list = items.map((item) => {
    const drama = dramaFromRow(item as Record<string, unknown>)
    return {
      id: drama.playlet_id,
      image_link: drama.image_link,
      title: drama.title,
      sub_title: drama.tags || drama.intro.slice(0, 40),
      total_num: drama.total_episode_num,
      hot_value: drama.score,
    }
  })

  return {
    list,
    total,
    page,
    total_pages: totalPages,
    next_page: page < totalPages ? page + 1 : null,
  }
}

export async function huangjuDetail(sourceId: string): Promise<HuangjuDetail> {
  const id = sourceId.trim()
  if (!id) throw new Error('剧果剧集地址无效')

  const { value } = await authGet(`/dramas/${encodeURIComponent(id)}`, undefined, 8 << 20)
  const row = (payload(value) || {}) as Record<string, unknown>
  const drama = dramaFromRow({ ...row, slug: String(row.slug || id.split('-').slice(0, -1).join('-')) })

  const episodes = Array.isArray(row.episodes) ? row.episodes : []
  const play_list: HuangjuEpisode[] = []
  episodes.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return
    const ep = entry as Record<string, unknown>
    if (ep.playable === false) return
    const epId = String(ep.id || '')
    if (!epId) return
    const number = ep.epNo != null ? Number(ep.epNo) || index + 1 : index + 1
    play_list.push({
      video_id: epId,
      sort: String(number),
      title: `第 ${number} 集`,
      playable: true,
      video_url: '',
      duration: '',
      first_img: drama.image_link,
    })
  })

  play_list.sort((a, b) => Number(a.sort) - Number(b.sort))

  return {
    ...drama,
    playlet_id: id,
    id,
    total_episode_num: drama.total_episode_num || String(play_list.length),
    play_list,
  }
}

function parseCloudFrontCookies(headers: Headers): string | undefined {
  const cookies: Record<string, string> = {}
  const raw = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : []
  const lines = raw.length ? raw : [headers.get('set-cookie') || ''].filter(Boolean)

  for (const line of lines) {
    for (const name of ['CloudFront-Policy', 'CloudFront-Signature', 'CloudFront-Key-Pair-Id'] as const) {
      const m = line.match(new RegExp(`(?:^|[,;\\s])${name}\\s*=\\s*([^;,\\s"']+)`))
      if (m?.[1]) cookies[name] = m[1]
    }
  }

  const values = ['CloudFront-Policy', 'CloudFront-Signature', 'CloudFront-Key-Pair-Id'].map(
    (name) => cookies[name],
  )
  if (values.some((v) => !v)) return undefined
  return values.map((v, i) => `${['CloudFront-Policy', 'CloudFront-Signature', 'CloudFront-Key-Pair-Id'][i]}=${v}`).join('; ')
}

export async function huangjuPlay(episodeId: string): Promise<HuangjuPlayResult> {
  const id = episodeId.trim()
  if (!id) throw new Error('剧果分集地址无效')

  const { value, headers } = await authGet(`/play/${encodeURIComponent(id)}`, undefined, 64 << 10)
  const row = (payload(value) || {}) as Record<string, unknown>
  const address = typeof row.url === 'string' ? row.url.trim() : ''
  if (!address || !/^https?:\/\//i.test(address)) throw new Error('剧果未返回有效播放地址')

  const cookie = parseCloudFrontCookies(headers)
  if (!cookie) throw new Error('剧果未返回完整媒体凭证，请重试')

  return {
    url: address,
    cookie,
    referer: `${SITE}/`,
    expiresAt: row.expiresAt != null ? String(row.expiresAt) : undefined,
  }
}
