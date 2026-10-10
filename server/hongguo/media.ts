/**
 * 单集媒体处理：取流 → 下载 → 解密 → 去 CENC 信令 → 落盘缓存 →（可选）HLS 切片 → Range/分片串流。
 *
 * 浏览器不能播 CENC 密文，所以首播要先在服务端把整集处理完（红果一集 5~18MB，
 * 实测下载+解密约 1~3 秒）。有 ffmpeg 时再切成 ~3s fMP4 分片，穿透/高延迟更稳；
 * 没有则仍走 progressive mp4 + Range。
 */

import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'
import { getVideoTracks, pickPlayable, deviceInfo } from './fqapi.js'
import { spadeToKey } from './spade.js'
import { decryptAv } from './decrypt.js'
import { stripCenc } from './demux.js'
import {
  hlsReady,
  packHls,
  rewritePlaylist,
  resolveFfmpeg,
  safeSegName,
  segContentType,
} from './hls.js'

const CACHE_DIR = join(tmpdir(), 'hongguo-cache')
/** 同一集并发请求时复用同一个进行中的任务 */
const inflight = new Map<string, Promise<string>>()

export type PreparedMedia = {
  file: string
  size: number
  /** 是否本次刚处理完（用于给前端提示「正在准备」） */
  fresh: boolean
  /** 有 HLS 切片时给出目录；否则 undefined，走 mp4 Range */
  hlsDir?: string
  mediaType: 'mp4' | 'hls'
}

function cachePath(vid: string): string {
  return join(CACHE_DIR, `${vid}.mp4`)
}

function hlsDirOf(vid: string): string {
  return join(CACHE_DIR, `${vid}.hls`)
}

function trackFile(path: string): string {
  return `${path}.part`
}

/** 取单集的可播地址与密钥 */
export async function resolveEpisode(vid: string) {
  if (!/^\d{6,32}$/.test(vid)) throw new Error('vid 无效')
  const tracks = await getVideoTracks([vid])
  const track = pickPlayable(tracks[vid])
  if (!track) throw new Error('该集没有可用播放地址')
  const key = spadeToKey(track.spadeA)
  if (!key) throw new Error('该集密钥解析失败（spade 格式不支持）')
  return { track, key }
}

async function download(url: string, referer: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { 'user-agent': deviceInfo().userAgent, referer: referer || 'https://novel.snssdk.com/' },
    signal: AbortSignal.timeout(180_000),
  })
  if (!res.ok || !res.body) throw new Error(`下载媒体失败 HTTP ${res.status}`)
  const chunks: Buffer[] = []
  const reader = res.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(Buffer.from(value))
  }
  const buf = Buffer.concat(chunks)
  if (buf.length < 1024) throw new Error('媒体内容过短，可能已过期')
  return buf
}

async function ensureHls(vid: string, mp4Path: string): Promise<string | undefined> {
  const dir = hlsDirOf(vid)
  if (hlsReady(dir)) return dir
  if (!resolveFfmpeg()) return undefined
  try {
    await packHls(mp4Path, dir)
    return dir
  } catch {
    return undefined
  }
}

function toPrepared(vid: string, file: string, fresh: boolean): PreparedMedia {
  const dir = hlsDirOf(vid)
  const hasHls = hlsReady(dir)
  return {
    file,
    size: statSync(file).size,
    fresh,
    hlsDir: hasHls ? dir : undefined,
    mediaType: hasHls ? 'hls' : 'mp4',
  }
}

/** 下载 + 解密 + 去信令 + 可选 HLS；返回缓存信息 */
export async function prepareEpisode(vid: string): Promise<PreparedMedia> {
  const finalPath = cachePath(vid)
  if (existsSync(finalPath)) {
    await ensureHls(vid, finalPath)
    return toPrepared(vid, finalPath, false)
  }

  const running = inflight.get(vid)
  if (running) {
    const file = await running
    await ensureHls(vid, file)
    return toPrepared(vid, file, false)
  }

  const task = (async () => {
    mkdirSync(CACHE_DIR, { recursive: true })
    const { track, key } = await resolveEpisode(vid)

    const ct = await download(track.url, 'https://novel.snssdk.com/')
    if (ct.length < 1024 && track.backupUrls.length) {
      throw new Error('媒体下载失败')
    }

    decryptAv(ct, key)
    const plain = stripCenc(ct)

    const tmp = trackFile(finalPath)
    await writeFile(tmp, plain)
    renameSync(tmp, finalPath)
    await ensureHls(vid, finalPath)
    return finalPath
  })()

  inflight.set(vid, task)
  try {
    const file = await task
    return toPrepared(vid, file, true)
  } finally {
    inflight.delete(vid)
  }
}

/**
 * 后台预热：只排队解密+切片，不阻塞调用方。
 * 已在处理或已缓存时直接返回。
 */
export function prefetchEpisode(vid: string): { queued: boolean; reason?: string } {
  if (!/^\d{6,32}$/.test(vid)) return { queued: false, reason: 'vid 无效' }
  if (existsSync(cachePath(vid)) && (!resolveFfmpeg() || hlsReady(hlsDirOf(vid)))) {
    return { queued: false, reason: 'cached' }
  }
  if (inflight.has(vid)) return { queued: false, reason: 'running' }
  void prepareEpisode(vid).catch(() => {})
  return { queued: true }
}

function writeFile(path: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(path)
    stream.on('error', reject)
    stream.on('finish', () => resolve())
    stream.end(data)
  })
}

/** 处理进度查询：给前端轮询用 */
export function isPreparing(vid: string): boolean {
  return inflight.has(vid)
}

/**
 * 以 HTTP Range 语义返回可播文件。
 * 支持 bytes=a-b / bytes=a- / bytes=-n，未给 Range 时返回 200 整体。
 */
export function streamFile(file: string, rangeHeader: string | null): Response {
  const size = statSync(file).size
  const type = 'video/mp4'

  if (!rangeHeader) {
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      status: 200,
      headers: {
        'content-type': type,
        'content-length': String(size),
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=3600',
      },
    })
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!match) {
    return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
  }
  const [, startRaw, endRaw] = match
  let start: number
  let end: number
  if (startRaw === '') {
    const suffix = Number(endRaw || 0)
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(startRaw)
    end = endRaw === '' ? size - 1 : Math.min(Number(endRaw), size - 1)
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
  }

  const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream
  return new Response(stream, {
    status: 206,
    headers: {
      'content-type': type,
      'content-length': String(end - start + 1),
      'content-range': `bytes ${start}-${end}/${size}`,
      'accept-ranges': 'bytes',
      'cache-control': 'public, max-age=3600',
    },
  })
}

/** 返回 HLS playlist（已改写 seg URL）或单个分片文件 */
export function streamHlsSeg(
  vid: string,
  seg: string,
  rangeHeader: string | null,
): Response | null {
  const name = safeSegName(seg)
  if (!name) return null
  const dir = hlsDirOf(vid)
  if (!hlsReady(dir)) return null
  const file = join(dir, name)
  if (!existsSync(file)) return null

  if (name.endsWith('.m3u8')) {
    const body = rewritePlaylist(readFileSync(file, 'utf8'), vid)
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': segContentType(name),
        'cache-control': 'public, max-age=60',
        'access-control-allow-origin': '*',
      },
    })
  }

  const size = statSync(file).size
  const type = segContentType(name)
  if (!rangeHeader) {
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      status: 200,
      headers: {
        'content-type': type,
        'content-length': String(size),
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=3600',
        'access-control-allow-origin': '*',
      },
    })
  }
  return streamFileWithType(file, size, type, rangeHeader)
}

function streamFileWithType(
  file: string,
  size: number,
  type: string,
  rangeHeader: string,
): Response {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!match) {
    return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
  }
  const [, startRaw, endRaw] = match
  let start: number
  let end: number
  if (startRaw === '') {
    const suffix = Number(endRaw || 0)
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(startRaw)
    end = endRaw === '' ? size - 1 : Math.min(Number(endRaw), size - 1)
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
  }
  const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream
  return new Response(stream, {
    status: 206,
    headers: {
      'content-type': type,
      'content-length': String(end - start + 1),
      'content-range': `bytes ${start}-${end}/${size}`,
      'accept-ranges': 'bytes',
      'cache-control': 'public, max-age=3600',
      'access-control-allow-origin': '*',
    },
  })
}
