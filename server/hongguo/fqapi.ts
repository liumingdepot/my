/**
 * 红果/番茄内容接口（fqnovel 后端）+ unidbg 签名。
 *
 * 与 hongguoduanju.com 网页源的关系：
 *   网页源负责「目录 + 集数 vid 列表」（它拿得到全集 vid，只是第 4 集起不给播放地址）
 *   这里负责「全集播放地址」——App 接口不校验登录态，但每个请求都要 metasec 签名。
 * 两者用同一套 vid，所以可以拼起来：网页列目录，这里取流。
 *
 * 设备身份：必须与 unidbg 里模拟的那个 app 一致（见 signService）。
 * 换成随机 device_id 会被网关静默拦掉（HTTP 200 + 空 body）。
 */

import { createHash } from 'node:crypto'
import { sign } from './signService.js'

const HOST = 'api5-normal-sinfonlineb.fqnovel.com'

/**
 * 已注册设备（来源：fqnovel-unidbg 的 results/individual 配置）。
 * aid=1967 对应 com.dragon.read.oversea.gp，也正是 unidbg-sign.jar 里 FqTrace 模拟的包。
 * 换任何字段（机型/系统/分辨率/UA）都要整套同步改，否则网关返回空 body。
 */
const DEVICE = {
  aid: '1967',
  deviceId: '2886693885903290',
  iid: '2886693885907386',
  cdid: 'ed3dec89-d0bc-4f32-ae66-5f7eb5a57e55',
  versionCode: '68132',
  versionName: '6.8.1.32',
  brand: 'OnePlus',
  model: 'OnePlus10',
  resolution: '1600*900',
  dpi: '320',
  romVersion: 'V451IR+release-keys',
  osVersion: '14',
  osApi: '34',
  cookie: 'store-region=cn-zj; store-region-src=did; install_id=2886693885907386;',
  userAgent:
    'com.dragon.read.oversea.gp/68132 (Linux; U; Android 14; zh_CN; OnePlus10; Build/V451IR;tt-ok/3.12.13.4-tiktok)',
}

export function deviceInfo() {
  return { ...DEVICE }
}

export function isValidId(id: string): boolean {
  return /^\d{6,32}$/.test(String(id || '').trim())
}

function buildUrl(path: string, extra?: Record<string, string>): string {
  const q: Record<string, string> = {
    aid: DEVICE.aid,
    device_id: DEVICE.deviceId,
    iid: DEVICE.iid,
    cdid: DEVICE.cdid,
    version_code: DEVICE.versionCode,
    version_name: DEVICE.versionName,
    update_version_code: DEVICE.versionCode,
    device_platform: 'android',
    device_brand: DEVICE.brand,
    device_type: DEVICE.model,
    resolution: DEVICE.resolution,
    dpi: DEVICE.dpi,
    rom_version: DEVICE.romVersion,
    os_version: DEVICE.osVersion,
    os_api: DEVICE.osApi,
    host_abi: 'arm64-v8a',
    app_name: 'novelread',
    channel: 'official',
    ...(extra || {}),
    _rticket: String(Date.now()),
  }
  const qs = Object.entries(q)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return `https://${HOST}${path}?${qs}`
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const url = buildUrl(path)
  const headers: Record<string, string> = {
    'user-agent': DEVICE.userAgent,
    cookie: DEVICE.cookie,
    'content-type': 'application/json; charset=utf-8',
  }
  let payload: string | undefined
  if (body !== undefined) {
    payload = JSON.stringify(body)
    headers['x-ss-stub'] = createHash('md5').update(payload).digest('hex').toUpperCase()
  }

  Object.assign(headers, await sign(url, headers))

  const res = await fetch(url, {
    method,
    headers,
    body: payload,
    signal: AbortSignal.timeout(30_000),
  })
  const text = await res.text()
  if (!text.trim()) {
    throw new Error('番茄接口返回空响应（签名或设备身份被拒）')
  }
  let json: { code: number; message?: string; data?: T }
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`番茄接口返回非 JSON（HTTP ${res.status}）`)
  }
  if (json.code !== 0) {
    throw new Error(`番茄接口错误 code=${json.code} ${json.message || ''}`.trim())
  }
  return json.data as T
}

/**
 * 免签请求：分类浏览/筛选（landpage）实测不校验 X-Argus。
 * 走这条路的接口完全不经过 unidbg，浏览筛选因此不受单模拟器串行的限制。
 */
export async function requestNoSign<T>(path: string, body?: unknown): Promise<T> {
  const url = buildUrl(path)
  const headers: Record<string, string> = {
    'user-agent': DEVICE.userAgent,
    cookie: DEVICE.cookie,
    'content-type': 'application/json; charset=utf-8',
  }
  const payload = body === undefined ? undefined : JSON.stringify(body)
  if (payload !== undefined) {
    headers['x-ss-stub'] = createHash('md5').update(payload).digest('hex').toUpperCase()
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: payload,
    signal: AbortSignal.timeout(20_000),
  })
  const text = await res.text()
  if (!text.trim()) throw new Error('分类接口返回空响应（设备身份被拒）')
  let json: { code: number; message?: string; data?: T }
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('分类接口返回非 JSON')
  }
  if (json.code !== 0) {
    throw new Error(`分类接口错误 code=${json.code} ${json.message || ''}`.trim())
  }
  return json.data as T
}

export type VideoTrack = {
  url: string
  backupUrls: string[]
  definition: string
  size: number
  /** spade_a：内容密钥的包装，离线可解 */
  spadeA: string
  /** bytevc1 = HEVC（通用可播）；bytevc2 需要字节自研解码器 */
  codec: string
  width: number
  height: number
}

const VIDEO_BODY = {
  biz_param: {
    detail_page_version: 0,
    device_level: 3,
    disable_digg_stat: false,
    disable_video_relate_book: false,
    need_all_video_definition: true,
    need_mp4_align: false,
    use_os_player: false,
    use_server_dns: false,
    video_platform: 1024,
  },
}

/**
 * 取一批 vid 的播放轨道。网页源给的 vid 可以直接用。
 * 返回 { vid: VideoTrack[] }，按清晰度从低到高。
 */
export async function getVideoTracks(
  vids: string[],
): Promise<Record<string, VideoTrack[]>> {
  const out: Record<string, VideoTrack[]> = {}
  const list = vids.map(String).filter(isValidId)
  for (let i = 0; i < list.length; i += 5) {
    const batch = list.slice(i, i + 5)
    const data = await request<Record<string, { video_model?: string }>>(
      'POST',
      '/novel/player/multi_video_model/v1/',
      { ...VIDEO_BODY, mixed_video_id_map: { '1': batch } },
    )
    for (const [vid, value] of Object.entries(data || {})) {
      const raw = value?.video_model
      if (typeof raw !== 'string' || !raw) continue
      try {
        const model = JSON.parse(raw) as {
          video_list?: Array<{
            main_url?: string
            backup_url?: string[]
            video_meta?: Record<string, unknown>
            encrypt_info?: Record<string, unknown>
          }>
        }
        const tracks: VideoTrack[] = (model.video_list || [])
          .map((v) => {
            const meta = (v.video_meta || {}) as Record<string, unknown>
            const enc = (v.encrypt_info || {}) as Record<string, unknown>
            return {
              url: String(v.main_url || ''),
              backupUrls: Array.isArray(v.backup_url) ? v.backup_url.map(String) : [],
              definition: String(meta.definition ?? ''),
              size: Number(meta.size || 0),
              spadeA: String(enc.spade_a ?? ''),
              codec: String(meta.codec_type || meta.video_codec || ''),
              width: Number(meta.width || 0),
              height: Number(meta.height || 0),
            }
          })
          .filter((t) => t.url)
        if (tracks.length) out[vid] = tracks
      } catch {
        // 单条解析失败不影响其它 vid
      }
    }
  }
  return out
}

/**
 * 挑一条适合浏览器直放的轨道。
 * 只认 bytevc1(HEVC)：bytevc2 是字节自研编码，浏览器解不了。
 */
export function pickPlayable(tracks: VideoTrack[] | undefined): VideoTrack | null {
  if (!tracks?.length) return null
  const playable = tracks.filter((t) => t.codec !== 'bytevc2' && t.url)
  const pool = playable.length ? playable : tracks
  return (
    pool.slice().sort((a, b) => {
      const pa = Number(a.definition) || 0
      const pb = Number(b.definition) || 0
      if (pb !== pa) return pb - pa // 清晰度高的优先
      return b.size - a.size
    })[0] || null
  )
}