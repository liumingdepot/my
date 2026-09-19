import { encryptQuery, parseParamsToJson } from './kwDES.js'

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders })
}

function bad(message: string, status = 400) {
  return json({ error: message }, status)
}

async function fetchText(url: string) {
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      referer: 'https://www.kuwo.cn/',
    },
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
  name?: string
  artist?: string
  img?: string
  pic?: string
}

function normalizeSearch(list: SearchItem[]) {
  return list.map((e) => ({
    id: String(e.DC_TARGETID || e.MUSICRID?.replace('MUSIC_', '') || ''),
    title: e.SONGNAME || e.NAME || '未知歌曲',
    artist: e.ARTIST || '未知艺人',
    cover: coverUrl(e.web_albumpic_short),
  }))
}

function normalizePlaylistSongs(list: PlaylistSong[]) {
  return list.map((e) => ({
    id: String(e.rid ?? e.id ?? ''),
    title: e.name || '未知歌曲',
    artist: e.artist || '未知艺人',
    cover: e.img || e.pic || '',
  }))
}

export async function handleMusicApi(request: Request, url: URL): Promise<Response> {
  if (request.method !== 'GET') {
    return bad('请使用 GET', 405)
  }

  const path = url.pathname.replace(/^\/api\/music\/?/, '')

  try {
    switch (path) {
      case 'search': {
        const key = url.searchParams.get('key')?.trim() || '周杰伦'
        const pn = Number(url.searchParams.get('pn') || '0') || 0
        const data = await fetchJson<{ abslist?: SearchItem[] }>(
          `https://www.kuwo.cn/search/searchMusicBykeyWord?vipver=1&client=kt&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&mobi=1&issubtitle=1&show_copyright_off=1&pn=${pn}&rn=20&all=${encodeURIComponent(key)}`,
        )
        return json({ list: normalizeSearch(data.abslist || []) })
      }

      case 'charts': {
        const data = await fetchJson<{ child?: unknown[] }>('https://wapi.kuwo.cn/api/pc/bang/list')
        return json({ list: data.child || [] })
      }

      case 'chart': {
        const id = url.searchParams.get('id')
        if (!id) return bad('缺少 id')
        const data = await fetchJson<{ musiclist?: PlaylistSong[] }>(
          `https://kbangserver.kuwo.cn/ksong.s?from=pc&type=bang&id=${encodeURIComponent(id)}&pn=0&rn=30`,
        )
        return json({
          list: (data.musiclist || []).map((e) => ({
            id: String(e.id ?? e.rid ?? ''),
            title: e.name || '未知歌曲',
            artist: e.artist || '未知艺人',
            cover: '',
          })),
        })
      }

      case 'playlists': {
        const data = await fetchJson<{ data?: { data?: unknown[] } }>(
          'https://wapi.kuwo.cn/api/pc/classify/playlist/getRcmPlayList?pn=1&rn=99&order=hot',
        )
        return json({ list: data.data?.data || [] })
      }

      case 'playlist': {
        const id = url.searchParams.get('id')
        if (!id) return bad('缺少 id')
        const data = await fetchJson<{ data?: { musiclist?: PlaylistSong[] } }>(
          `https://mobilist.kuwo.cn/list.s?type=songlist&id=${encodeURIComponent(id)}&pn=0&rn=100`,
        )
        return json({ list: normalizePlaylistSongs(data.data?.musiclist || []) })
      }

      case 'tags': {
        const data = await fetchJson<{ data?: Array<{ name?: string; data?: unknown[] }> }>(
          'https://wapi.kuwo.cn/api/pc/classify/playlist/getTagList',
        )
        const allow = new Set(['主题', '心情', '场景', '年代'])
        const list = (data.data || []).filter((g) => g.name && allow.has(g.name))
        return json({ list })
      }

      case 'tag-playlists': {
        const id = url.searchParams.get('id')
        if (!id) return bad('缺少 id')
        const data = await fetchJson<{ data?: { data?: unknown[] } }>(
          `https://wapi.kuwo.cn/api/pc/classify/playlist/getTagPlayList?pn=1&rn=30&id=${encodeURIComponent(id)}`,
        )
        return json({ list: data.data?.data || [] })
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
        const text = await fetchText(`https://nmobi.kuwo.cn/mobi.s?f=kuwo&q=${encodeURIComponent(q)}`)
        const parsed = parseParamsToJson(text)
        if (!parsed.url || typeof parsed.url !== 'string') return bad('未获取到播放地址', 502)
        // Prefer https for browser mixed-content safety
        const playUrl = parsed.url.replace(/^http:\/\//i, 'https://')
        return json({ ...parsed, url: playUrl })
      }

      case 'lyric': {
        const rid = url.searchParams.get('rid')
        if (!rid) return bad('缺少 rid')
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
        return json({ lines })
      }

      default:
        return bad('未知接口', 404)
    }
  } catch (err) {
    console.error('[music api]', path, err)
    return bad('音乐服务暂时不可用', 502)
  }
}
