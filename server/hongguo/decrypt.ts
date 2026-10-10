/**
 * CENC 解密：标准 AES-128-CTR，逐样本独立计数器。
 *
 * 与 libttmplayer / ExoPlayer 一致：
 *   base_iv = senc 盒首个样本 IV 的高 8 字节
 *   样本 n 的计数器 = ((base_iv + n) << 64)，即 16 字节全宽计数器
 *
 * 就地解密 buf，返回 {handler: [合法样本数, 总样本数]}（视频按 NAL 自证）。
 */

import { createDecipheriv } from 'node:crypto'
import { findEncryptedTracks } from './mp4.js'

const BLOCK = 16

function ivBuffer(baseIvHex: string, index: number): Buffer {
  // 16 字节计数器：高 8 字节 = base_iv + 样本序号，低 8 字节恒为 0
  const counter = BigInt(`0x${baseIvHex}`) + BigInt(index)
  const iv = Buffer.alloc(BLOCK)
  iv.writeBigUInt64BE(counter, 0)
  return iv
}

/** 解密单条轨，返回可被 NAL 自证为合法的样本数 */
function decryptTrack(
  buf: Buffer,
  sizes: number[],
  offsets: number[],
  key: Buffer,
  baseIvHex: string,
): number {
  let ok = 0
  for (let i = 0; i < sizes.length; i++) {
    const off = offsets[i]!
    const size = sizes[i]!
    if (off + size > buf.length) continue
    const decipher = createDecipheriv('aes-128-ctr', key, ivBuffer(baseIvHex, i))
    const plain = Buffer.concat([decipher.update(buf.subarray(off, off + size)), decipher.final()])
    plain.copy(buf, off)
    if (nalOk(plain, size)) ok++
  }
  return ok
}

/** 长度前缀 NAL 链自证：4 字节长度 + 载荷，恰好铺满样本 */
function nalOk(pt: Buffer, size: number): boolean {
  let p = 0
  while (p + 4 <= size) {
    const len = pt.readUInt32BE(p)
    if (len === 0 || p + 4 + len > size) return false
    p += 4 + len
  }
  return p === size
}

export type DecryptStats = Record<string, { ok: number | null; total: number }>

/** 就地解密整片的所有加密轨（视频 + 音频），共用同一 content key */
export function decryptAv(buf: Buffer, keyHex: string): DecryptStats {
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== BLOCK) throw new Error('content key 长度异常')

  const tracks = findEncryptedTracks(buf)
  if (!tracks.length) throw new Error('未找到 senc 加密轨，可能不是 CENC 密文')

  const stats: DecryptStats = {}
  for (const { handler, track, baseIv } of tracks) {
    const ok = decryptTrack(buf, track.sizes, track.offsets, key, baseIv)
    stats[handler] = { ok: handler === 'vide' ? ok : null, total: track.sizes.length }
  }
  return stats
}