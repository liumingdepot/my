/**
 * 去掉 CENC 信令，让解密后的片子能被浏览器直接播。
 *
 * 解密只改了样本字节（mdat），文件里还留着加密声明：stsd 里的 encv/enca 采样条目
 * 以及 sinf / senc / saiz / saio / tenc。浏览器见到就拒播。
 *
 * 这里重建 moov：自底向上丢掉信令盒、改采样条目四字符、逐级修正 size，
 * 再把新的 moov 拼回 ftyp + mdat。不依赖 ffmpeg —— 解密后的样本正是 hvcC/mp4a
 * 描述的 HEVC/AAC，配置原样保留即可。
 */

import { findBox, iterBoxes, type BoxRef } from './mp4.js'

/** 整块丢弃的信令盒 */
const DROP = new Set(['sinf', 'senc', 'saiz', 'saio', 'pssh', 'tenc', 'sgpd', 'sbgp'])

/** 需要能容纳子盒的容器 */
const CONTAINER = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'udta', 'mvex'])

/** 加密采样条目 → 明文条目（四字符等长，原地改） */
const ENTRY_FIX: Record<string, string> = {
  encv: 'hvc1',
  encs: 'hvc1',
  enca: 'mp4a',
  encm: 'mp4a',
}

/**
 * 在采样条目区间里找出 sinf。
 * 采样条目的子盒不在紧跟 8 字节头之后（VisualSampleEntry 前导 70 字节），
 * 所以按字节扫描并校验 size 是否落在条目范围内。
 */
function findSinfInEntry(buf: Buffer, start: number, end: number): { start: number; size: number } | null {
  for (let i = start; i + 8 <= end; i++) {
    if (buf.toString('latin1', i, i + 4) !== 'sinf') continue
    const size = buf.readUInt32BE(i - 4)
    if (size >= 12 && i - 4 + size <= end) return { start: i - 4, size }
  }
  return null
}

/** 处理 stsd 里的采样条目：改四字符 + 摘掉 sinf，返回新内容区 */
function rebuildStsd(buf: Buffer, box: BoxRef): Buffer {
  const contentStart = box.start + box.headerSize
  const count = buf.readUInt32BE(contentStart + 4)
  const parts: Buffer[] = [buf.subarray(contentStart, contentStart + 8)] // version/flags + entry_count

  for (let i = 0; i < count; i++) {
    const entryStart = contentStart + 8 + parts.slice(1).reduce((n, p) => n + p.length, 0)
    if (entryStart + 8 > box.end) break
    let size = buf.readUInt32BE(entryStart)
    let headerSize = 8
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(entryStart + 8))
      headerSize = 16
    }
    if (size < headerSize || entryStart + size > box.end) break

    const type = buf.toString('latin1', entryStart + 4, entryStart + 8)
    const plain = ENTRY_FIX[type]
    const sinf = plain ? findSinfInEntry(buf, entryStart + headerSize, entryStart + size) : null

    if (!plain) {
      parts.push(buf.subarray(entryStart, entryStart + size))
      continue
    }
    if (!sinf) {
      // 只需改名：复制一份，避免改到入参
      const entry = Buffer.from(buf.subarray(entryStart, entryStart + size))
      entry.write(plain, entryStart + 4 - entryStart, 4, 'latin1')
      parts.push(entry)
      continue
    }
    // 改名 + 摘掉 sinf：重建 size 并把后半段前移
    const newSize = size - sinf.size
    const entry = Buffer.alloc(newSize)
    entry.writeUInt32BE(newSize, 0)
    entry.write(plain, 4, 4, 'latin1')
    buf.copy(entry, 8, entryStart + 8, sinf.start)
    buf.copy(entry, 8 + (sinf.start - entryStart - 8), sinf.start + sinf.size, entryStart + size)
    parts.push(entry)
  }
  return Buffer.concat(parts)
}

/** 递归重建一个盒；返回 null 表示该盒被丢弃 */
function rebuild(buf: Buffer, box: BoxRef): Buffer | null {
  if (DROP.has(box.type)) return null

  const bodyStart = box.start + box.headerSize
  let body: Buffer

  if (box.type === 'stsd') {
    body = rebuildStsd(buf, box)
  } else if (CONTAINER.has(box.type)) {
    const parts: Buffer[] = []
    for (const child of iterBoxes(buf, bodyStart, box.end)) {
      const rebuilt = rebuild(buf, child)
      if (rebuilt) parts.push(rebuilt)
    }
    body = Buffer.concat(parts)
  } else {
    body = buf.subarray(bodyStart, box.end)
  }

  const size = box.headerSize + body.length
  const header = Buffer.alloc(box.headerSize)
  header.write(box.type, 4, 4, 'latin1')
  if (box.headerSize === 16) header.writeBigUInt64BE(BigInt(size), 8)
  else header.writeUInt32BE(size, 0)
  return Buffer.concat([header, body])
}

/**
 * 修正 chunk 偏移：stco/co64 里是绝对偏移，moov 变短后 mdat 前移，必须同步减去差值。
 * 只动落在原 moov 之后的偏移（媒体数据都在 mdat）。
 */
function shiftChunkOffsets(moovBuf: Buffer, delta: number, afterOffset: number): void {
  if (!delta) return
  const walk = (start: number, end: number): void => {
    for (const box of iterBoxes(moovBuf, start, end)) {
      const content = box.start + box.headerSize
      if (box.type === 'stco') {
        const n = moovBuf.readUInt32BE(content + 4)
        const table = content + 8
        for (let i = 0; i < n; i++) {
          const at = table + 4 * i
          const value = moovBuf.readUInt32BE(at)
          if (value > afterOffset) moovBuf.writeUInt32BE((value + delta) >>> 0, at)
        }
        continue
      }
      if (box.type === 'co64') {
        const n = moovBuf.readUInt32BE(content + 4)
        const table = content + 8
        for (let i = 0; i < n; i++) {
          const at = table + 8 * i
          const value = Number(moovBuf.readBigUInt64BE(at))
          if (value > afterOffset) moovBuf.writeBigUInt64BE(BigInt(value + delta), at)
        }
        continue
      }
      if (CONTAINER.has(box.type) || box.type === 'stbl') walk(content, box.end)
    }
  }
  walk(0, moovBuf.length)
}

/** 造一个 free 填充盒，把 moov 补回原长度，保证 mdat 不位移 */
function padTo(buf: Buffer, targetSize: number): Buffer | null {
  const missing = targetSize - buf.length
  if (missing === 0) return buf
  if (missing < 8) return null // 补不出合法 free 盒
  const free = Buffer.alloc(missing)
  free.writeUInt32BE(missing, 0)
  free.write('free', 4, 4, 'latin1')
  return Buffer.concat([buf, free])
}

/**
 * 返回去掉 CENC 信令后的完整 mp4。
 *
 * 优先用 free 盒把 moov 补回原长度（这样 stco 偏移天然仍然正确）；
 * 补不齐时退化为整体平移 chunk 偏移。
 * 非加密文件原样返回。
 */
export function stripCenc(buf: Buffer): Buffer {
  const moov = findBox(buf, ['moov'])
  if (!moov) return buf

  let newMoov: Buffer | null = null
  const parts: Buffer[] = []
  for (const box of iterBoxes(buf, 0, buf.length)) {
    if (box.type === 'moov') {
      newMoov = rebuild(buf, box)
    } else {
      // 顶层 free/skip 必须原样保留：删掉会让 mdat 位移，而 stco 里是绝对偏移
      parts.push(buf.subarray(box.start, box.end))
    }
  }
  if (!newMoov) return buf

  const padded = padTo(newMoov, moov.size)
  if (padded) {
    newMoov = padded
  } else {
    shiftChunkOffsets(newMoov, newMoov.length - moov.size, moov.end)
  }
  // 按原顺序拼回：moov 原地替换，ftyp 必须仍在最前面
  const out: Buffer[] = []
  for (const box of iterBoxes(buf, 0, buf.length)) {
    out.push(box.type === 'moov' ? newMoov : buf.subarray(box.start, box.end))
  }
  return Buffer.concat(out)
}