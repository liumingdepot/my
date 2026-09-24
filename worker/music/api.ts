import { fetchTextViaHomeProxy } from '../homeProxy.js'
import { cacheKey, withKvJsonCache } from '../kvCache.js'
import { encryptQuery, parseParamsToJson } from './kwDES.js'

type MusicEnv = { KV: KVNamespace }

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=30',
}

const noStoreHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

/** 列表类 TTL（秒）；play 不缓存 */
const TTL = {
  charts: 3600,
  tags: 3600,
  playlists: 1800,
  playlist: 1800,
  chart: 1800,
  artists: 1800,
  artist: 1800,
  'tag-playlists': 1800,
  search: 600,
  lyric: 86400,
} as const

const kuwoHeaders: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  referer: 'https://www.kuwo.cn/',
}

function json(data: unknown, status = 200, store = true) {
  return new Response(JSON.stringify(data), {
    status,
    headers: store ? jsonHeaders : noStoreHeaders,
  })
}

function bad(message: string, status = 400) {
  return json({ error: message }, status, false)
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: kuwoHeaders,
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`upstream ${res.status}`)
  return res.text()
}

async function fetchJson<T = unknown>(url: string): Promise<T> {
  const text = await fetchText(url)
  return JSON.parse(text) as T
}

function coverUrl(path?: string | null) {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `https://img2.kuwo.cn/star/albumcover/${path}`
}

type SearchItem = {
  DC_TARGETID?: string
  MUSICRID?: string
  SONGNAME?: string
  NAME?: string
  ARTIST?: string
  web_albumpic_short?: string
}

type PlaylistSong = {
  rid?: number | string
  id?: number | string
  musicrid?: string
  name?: string
  artist?: string
  album?: string
  img?: string
  pic?: string
  pic120?: string
  albumpic?: string
  duration?: number | string
  songTimeMinutes?: string
  song_duration?: string | number
  hasLossless?: boolean
  hasmv?: number | boolean
}

type BangSong = PlaylistSong

function formatDuration(sec: number) {
  if (!Number.isFinite(sec) || sec <= 0) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function normalizeSong(e: PlaylistSong | BangSong) {
  const id = String(
    e.rid ?? e.id ?? (typeof e.musicrid === 'string' ? e.musicrid.replace(/^MUSIC_/, '') : '') ?? '',
  )
  const durationSec = Number(e.song_duration ?? e.duration) || 0
  return {
    id,
    title: e.name || '未知歌曲',
    artist: e.artist || '未知艺人',
    album: e.album || '',
    cover: e.pic120 || e.albumpic || e.pic || e.img || '',
    duration: e.songTimeMinutes || formatDuration(durationSec),
    durationSec,
    lossless: Boolean(e.hasLossless),
    hasMv: Boolean(e.hasmv),
  }
}

function normalizeSearch(list: SearchItem[]) {
  return list.map((e) => ({
    id: String(e.DC_TARGETID || e.MUSICRID?.replace('MUSIC_', '') || ''),
    title: e.SONGNAME || e.NAME || '未知歌曲',
    artist: e.ARTIST || '未知艺人',
    album: '',
    cover: coverUrl(e.web_albumpic_short),
    duration: '',
    durationSec: 0,
    lossless: false,
    hasMv: false,
  }))
}

export async function handleMusicApi(
  request: Request,
  url: URL,
  env: MusicEnv,
): Promise<Response> {
  if (request.method !== 'GET') {
    return bad('请使用 GET', 405)
  }

  const path = url.pathname.replace(/^\/api\/music\/?/, '')

  try {
    switch (path) {
      case 'search': {
        const key = url.searchParams.get('key')?.trim() || '周杰伦'
        const pn = Number(url.searchParams.get('pn') || '0') || 0
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('music:search', { key, pn }),
          TTL.search,
          async () => {
            const data = await fetchJson<{ abslist?: SearchItem[] }>(
              `https://www.kuwo.cn/search/searchMusicBykeyWord?vipver=1&client=kt&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&mobi=1&issubtitle=1&show_copyright_off=1&pn=${pn}&rn=20&all=${encodeURIComponent(key)}`,
            )
            return { list: normalizeSearch(data.abslist || []) }
          },
        )
        return json(payload)
      }

      case 'charts': {
        const payload = await withKvJsonCache(env.KV, 'music:charts', TTL.charts, async () => {
          const data = await fetchJson<{ child?: unknown[] }>('https://wapi.kuwo.cn/api/pc/bang/list')
          return { list: data.child || [] }
        })
        return json(payload)
      }

      case 'chart': {
        const id = url.searchParams.get('id')
        if (!id) return bad('缺少 id')
        // 酷我 bang/musicList：rn>30 直接 code=-1 空列表；需分页拉取
        const want = Math.min(Math.max(Number(url.searchParams.get('rn') || '30') || 30, 1), 200)
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('music:chart', { id, want }),
          TTL.chart,
          async () => {
            const pageSize = 30
            const pages = Math.ceil(want / pageSize)
            let pub = ''
            let cover = ''
            let total = 0
            const list: BangSong[] = []
            for (let pn = 1; pn <= pages; pn++) {
              const rn = Math.min(pageSize, want - list.length)
              const data = await fetchJson<{
                code?: number
                data?: { musicList?: BangSong[]; pub?: string; img?: string; num?: string }
              }>(
                `https://wapi.kuwo.cn/api/www/bang/bang/musicList?bangId=${encodeURIComponent(id)}&pn=${pn}&rn=${rn}&httpsStatus=1`,
              )
              if (pn === 1) {
                pub = data.data?.pub || ''
                cover = data.data?.img || ''
                total = Number(data.data?.num) || 0
              }
              const batch = data.data?.musicList || []
              if (!batch.length) break
              list.push(...batch)
              if (list.length >= want) break
            }
            return {
              list: list.slice(0, want).map(normalizeSong),
              pub,
              cover,
              total: total || list.length,
            }
          },
        )
        return json(payload)
      }

      case 'playlists': {
        const order = url.searchParams.get('order') === 'new' ? 'new' : 'hot'
        const pn = Number(url.searchParams.get('pn') || '1') || 1
        const rn = Number(url.searchParams.get('rn') || '30') || 30
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('music:playlists', { order, pn, rn }),
          TTL.playlists,
          async () => {
            const data = await fetchJson<{ data?: { data?: unknown[] } }>(
              `https://wapi.kuwo.cn/api/pc/classify/playlist/getRcmPlayList?pn=${pn}&rn=${rn}&order=${order}`,
            )
            return { list: data.data?.data || [] }
          },
        )
        return json(payload)
      }

      case 'playlist': {
        const id = url.searchParams.get('id')
        if (!id) return bad('缺少 id')
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('music:playlist', { id }),
          TTL.playlist,
          async () => {
            const data = await fetchJson<{
              data?: { musicList?: BangSong[]; total?: number }
            }>(
              `https://wapi.kuwo.cn/api/www/playlist/playListInfo?pid=${encodeURIComponent(id)}&pn=1&rn=100&httpsStatus=1`,
            )
            return {
              list: (data.data?.musicList || []).map(normalizeSong),
              total: Number(data.data?.total) || 0,
            }
          },
        )
        return json(payload)
      }

      case 'artists': {
        const category = Number(url.searchParams.get('category') || '0') || 0
        const pn = Number(url.searchParams.get('pn') || '1') || 1
        const rn = Number(url.searchParams.get('rn') || '60') || 60
        const prefix = url.searchParams.get('prefix')?.trim() || ''
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('music:artists', { category, pn, rn, prefix }),
          TTL.artists,
          async () => {
            const qs = new URLSearchParams({
              category: String(category),
              pn: String(pn),
              rn: String(rn),
              httpsStatus: '1',
            })
            if (prefix && prefix !== '热门') qs.set('prefix', prefix)
            const data = await fetchJson<{
              data?: {
                total?: string | number
                artistList?: Array<{
                  id?: number | string
                  name?: string
                  pic?: string
                  pic120?: string
                  musicNum?: number
                }>
              }
            }>(`https://wapi.kuwo.cn/api/www/artist/artistInfo?${qs.toString()}`)
            const list = (data.data?.artistList || []).map((a) => ({
              id: String(a.id ?? ''),
              name: a.name || '未知歌手',
              cover: a.pic || a.pic120 || '',
              musicNum: Number(a.musicNum) || 0,
            }))
            return { list, total: Number(data.data?.total) || list.length }
          },
        )
        return json(payload)
      }

      case 'artist': {
        const id = url.searchParams.get('id')
        if (!id) return bad('缺少 id')
        const pn = Number(url.searchParams.get('pn') || '1') || 1
        const rn = Number(url.searchParams.get('rn') || '50') || 50
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('music:artist', { id, pn, rn }),
          TTL.artist,
          async () => {
            const data = await fetchJson<{ data?: { list?: BangSong[]; total?: number } }>(
              `https://wapi.kuwo.cn/api/www/artist/artistMusic?artistid=${encodeURIComponent(id)}&pn=${pn}&rn=${rn}&httpsStatus=1`,
            )
            return {
              list: (data.data?.list || []).map(normalizeSong),
              total: Number(data.data?.total) || 0,
            }
          },
        )
        return json(payload)
      }

      case 'tags': {
        const payload = await withKvJsonCache(env.KV, 'music:tags', TTL.tags, async () => {
          const data = await fetchJson<{ data?: Array<{ name?: string; data?: unknown[] }> }>(
            'https://wapi.kuwo.cn/api/pc/classify/playlist/getTagList',
          )
          const allow = new Set(['主题', '心情', '场景', '年代'])
          const list = (data.data || []).filter((g) => g.name && allow.has(g.name))
          return { list }
        })
        return json(payload)
      }

      case 'tag-playlists': {
        const id = url.searchParams.get('id')
        if (!id) return bad('缺少 id')
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('music:tag-playlists', { id }),
          TTL['tag-playlists'],
          async () => {
            const data = await fetchJson<{ data?: { data?: unknown[] } }>(
              `https://wapi.kuwo.cn/api/pc/classify/playlist/getTagPlayList?pn=1&rn=30&id=${encodeURIComponent(id)}`,
            )
            return { list: data.data?.data || [] }
          },
        )
        return json(payload)
      }

      case 'play': {
        const rid = url.searchParams.get('rid')
        if (!rid) return bad('缺少 rid')
        const query =
          `user=0&android_id=0&prod=kwplayerhd_ar_4.3.0.8&corp=kuwo&vipver=4.3.0.8` +
          `&source=kwplayerhd_ar_4.3.0.8_tianbao_T1A_qirui.apk&notrace=0` +
          `&type=convert_url2&br=320&format=mp3&sig=0&rid=${rid}` +
          `&priority=bitrate&loginUid=0&network=WIFI&loginSid=0&mode=down`
        const q = encryptQuery(query)
        const upstream = `https://nmobi.kuwo.cn/mobi.s?f=kuwo&q=${encodeURIComponent(q)}`
        const text = await fetchTextViaHomeProxy(upstream, {
          headers: kuwoHeaders,
        })
        const parsed = parseParamsToJson(text)
        if (!parsed.url || typeof parsed.url !== 'string') return bad('未获取到播放地址', 502)
        // Prefer https for browser mixed-content safety
        const playUrl = parsed.url.replace(/^http:\/\//i, 'https://')
        return json({ ...parsed, url: playUrl }, 200, false)
      }

      case 'lyric': {
        const rid = url.searchParams.get('rid')
        if (!rid) return bad('缺少 rid')
        const payload = await withKvJsonCache(
          env.KV,
          cacheKey('music:lyric', { rid }),
          TTL.lyric,
          async () => {
            const data = await fetchJson<{
              data?: { lrclist?: Array<{ lineLyric?: string; time?: string | number }> }
            }>(
              `https://www.kuwo.cn/openapi/v1/www/lyric/getlyric?musicId=${encodeURIComponent(rid)}&httpsStatus=1&plat=web_www&from=`,
            )
            const lines = (data.data?.lrclist || [])
              .map((item) => ({
                text: item.lineLyric || '',
                time: Number(item.time) || 0,
              }))
              .filter((l) => l.text)
            return { lines }
          },
        )
        return json(payload)
      }

      default:
        return bad('未知接口', 404)
    }
  } catch (err) {
    console.error('[music api]', path, err)
    return bad('音乐服务暂时不可用', 502)
  }
}
