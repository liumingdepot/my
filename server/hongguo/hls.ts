/**
 * 明文 mp4 → HLS（fMP4 分片），方便 Cloudflare Tunnel 等高延迟链路分段拉取。
 * 依赖本机 ffmpeg（HG_FFMPEG / hongguo-work/bin/ffmpeg / PATH）；
 * 没有则返回 null，调用方回退 progressive mp4。
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function nearbyFfmpegBins(): string[] {
  const out: string[] = []
  const push = (root: string) => {
    out.push(join(root, 'bin', 'ffmpeg'))
    out.push(join(root, 'ffmpeg'))
  }
  if (process.env.HG_WORK) push(process.env.HG_WORK)
  push(join(process.cwd(), 'hongguo-work'))
  push(join(process.cwd(), '.output', 'hongguo-work'))
  try {
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 6; i++) {
      push(join(dir, 'hongguo-work'))
      push(join(dir, '.output', 'hongguo-work'))
      dir = dirname(dir)
    }
  } catch {
    /* ignore */
  }
  return out
}

let cachedBin: string | null | undefined

/**
 * PATH 名的候选必须真的能跑起来才算数。
 * 之前这里对 `ffmpeg` 之类的裸名直接乐观返回，导致没装 ffmpeg 的机器
 * 让 ensureHls 以为 HLS 可用 → packHls 建目录后 spawn 失败 → 缓存里留空目录。
 */
function probe(bin: string): boolean {
  try {
    const r = spawnSync(bin, ['-version'], { stdio: 'ignore', timeout: 10_000 })
    return r.status === 0
  } catch {
    return false
  }
}

/** 解析可用的 ffmpeg 路径；找不到返回 null */
export function resolveFfmpeg(): string | null {
  if (cachedBin !== undefined) return cachedBin
  const candidates = [
    process.env.HG_FFMPEG || '',
    ...nearbyFfmpegBins(),
    'ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
  ]
  for (const raw of candidates) {
    const bin = raw.trim()
    if (!bin) continue
    if (bin.includes('/') || bin.startsWith('.')) {
      if (existsSync(bin) && probe(bin)) {
        cachedBin = bin
        return bin
      }
      continue
    }
    // PATH 名：交给 spawn 解析，但要先确认真的存在
    if (probe(bin)) {
      cachedBin = bin
      return bin
    }
  }
  cachedBin = null
  return null
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    const chunks: Buffer[] = []
    child.stderr.on('data', (d: Buffer) => chunks.push(d))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else {
        const err = Buffer.concat(chunks).toString('utf8').slice(-800)
        reject(new Error(err || `ffmpeg exit ${code}`))
      }
    })
  })
}

/**
 * 把已解密的 progressive mp4 切成 VOD HLS（fMP4，约 3s/片）。
 * 成功返回 playlist 绝对路径；失败抛错并清掉半成品目录（调用方应 catch 后回退 mp4）。
 */
export async function packHls(mp4Path: string, outDir: string): Promise<string> {
  const bin = resolveFfmpeg()
  if (!bin) throw new Error('未找到 ffmpeg（可 brew install ffmpeg，或设 HG_FFMPEG）')

  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true })
  }
  mkdirSync(outDir, { recursive: true })

  const playlist = join(outDir, 'index.m3u8')
  try {
    await run(bin, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      mp4Path,
      '-c',
      'copy',
      '-f',
      'hls',
      '-hls_time',
      '3',
      '-hls_playlist_type',
      'vod',
      '-hls_flags',
      'independent_segments',
      '-hls_segment_type',
      'fmp4',
      '-hls_fmp4_init_filename',
      'init.mp4',
      '-hls_segment_filename',
      join(outDir, 'seg%03d.m4s'),
      playlist,
    ])

    if (!existsSync(playlist)) throw new Error('HLS 切片未生成 playlist')
  } catch (e) {
    // 半成品目录会让缓存里堆垃圾，下次还会被 hlsReady 判为未就绪而反复重试
    rmSync(outDir, { recursive: true, force: true })
    throw e
  }

  writeFileSync(join(outDir, '.ok'), '1')
  return playlist
}

export function hlsReady(outDir: string): boolean {
  return existsSync(join(outDir, 'index.m3u8')) && existsSync(join(outDir, '.ok'))
}

/** 仅允许目录内的简单文件名，防路径穿越 */
export function safeSegName(name: string): string | null {
  const n = name.trim()
  if (!n || n.length > 80) return null
  if (n.includes('/') || n.includes('\\') || n.includes('..')) return null
  if (!/^[A-Za-z0-9._-]+$/.test(n)) return null
  return n
}

export function listHlsFiles(outDir: string): string[] {
  if (!existsSync(outDir)) return []
  return readdirSync(outDir).filter((n) => n !== '.ok')
}

/** 把 playlist 里的相对分片改成走本站 /stream?seg= */
export function rewritePlaylist(text: string, episodeId: string): string {
  const prefix = `/api/hongguo/stream?source=hongguo&episode_id=${encodeURIComponent(episodeId)}&seg=`
  return text
    .split('\n')
    .map((line) => {
      const mapHit = line.match(/^(#EXT-X-MAP:.*URI=")([^"]+)(".*)$/)
      if (mapHit) {
        const uri = mapHit[2]
        if (uri.includes('://') || uri.startsWith('/')) return line
        return `${mapHit[1]}${prefix}${encodeURIComponent(uri)}${mapHit[3]}`
      }
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return line
      if (trimmed.includes('://') || trimmed.startsWith('/')) return line
      return `${prefix}${encodeURIComponent(trimmed)}`
    })
    .join('\n')
}

export function segContentType(name: string): string {
  if (name.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl; charset=utf-8'
  if (name.endsWith('.m4s')) return 'video/iso.segment'
  if (name.endsWith('.mp4')) return 'video/mp4'
  if (name.endsWith('.ts')) return 'video/mp2t'
  return 'application/octet-stream'
}
