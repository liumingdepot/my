/**
 * 最小 MP4 盒解析：只需拿到解密 CENC 视频必需的三样东西。
 *
 * 1. 每条 track 的样本表（stsz 大小 + stco/co64 + stsc 偏移）
 * 2. 加密轨的 base_iv（senc 盒里第一个样本 IV 的高 8 字节）
 * 3. trak 的 handler（vide / soun）
 *
 * 不解析 elst/stts 等用不上的表，够解密即可。
 */

export type BoxRef = {
  /** 盒类型（4 字符） */
  type: string
  /** 盒起始偏移 */
  start: number
  /** 盒头长度（8 / 16） */
  headerSize: number
  /** 盒总长度 */
  size: number
  /** 盒结束偏移 */
  end: number
}

/** 遍历 [start, end) 区间内的同级盒 */
export function* iterBoxes(buf: Buffer, start: number, end: number): Generator<BoxRef> {
  let o = start
  while (o + 8 <= end) {
    let size = buf.readUInt32BE(o)
    const type = buf.toString('latin1', o + 4, o + 8)
    let headerSize = 8
    if (size === 1) {
      // 64 位长度
      if (o + 16 > end) return
      const big = buf.readBigUInt64BE(o + 8)
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return
      size = Number(big)
      headerSize = 16
    } else if (size === 0) {
      size = end - o // 延伸到父级末尾
    }
    if (size < headerSize) return
    yield { type, start: o, headerSize, size, end: o + size }
    o += size
  }
}

function childBoxes(buf: Buffer, box: BoxRef): Generator<BoxRef> {
  return iterBoxes(buf, box.start + box.headerSize, box.end)
}

/** 按路径查找嵌套盒，如 findBox(buf, ['moov', 'trak']) 返回第一个匹配 */
export function findBox(
  buf: Buffer,
  path: string[],
  start = 0,
  end = buf.length,
): BoxRef | null {
  const [head, ...rest] = path
  if (!head) return null
  for (const box of iterBoxes(buf, start, end)) {
    if (box.type !== head) continue
    if (!rest.length) return box
    const inner = findBox(buf, rest, box.start + box.headerSize, box.end)
    if (inner) return inner
  }
  return null
}

export type Track = {
  handler: string
  /** 样本字节数 */
  sizes: number[]
  /** 每个样本在文件中的偏移 */
  offsets: number[]
}

function trackHandler(buf: Buffer, trak: BoxRef): string {
  const hdlr = findBox(buf, ['mdia', 'hdlr'], trak.start + trak.headerSize, trak.end)
  if (!hdlr) return ''
  // hdlr 是 full box：version/flags(4) + pre_defined(4) 之后才是 handler_type
  const at = hdlr.start + hdlr.headerSize + 8
  return buf.toString('latin1', at, at + 4)
}

/**
 * 解析指定 handler 轨（'vide' / 'soun'）的样本表。
 * stsz 给大小，stco|co64 给 chunk 偏移，stsc 给每个 chunk 装几个样本。
 */
function parseTrackSamples(buf: Buffer, handler: string): Track | null {
  const moov = findBox(buf, ['moov'])
  if (!moov) return null

  for (const trak of childBoxes(buf, moov)) {
    if (trak.type !== 'trak') continue
    if (trackHandler(buf, trak) !== handler) continue

    const s = trak.start + trak.headerSize
    const e = trak.end
    const stbl = findBox(buf, ['mdia', 'minf', 'stbl'], s, e)
    if (!stbl) continue
    const bs = stbl.start + stbl.headerSize
    const be = stbl.end

    const stsz = findBox(buf, ['stsz'], bs, be)
    if (!stsz) continue

    // 以下都是 full box：内容区开头 4 字节是 version/flags，字段从 +4 起
    const uniformSize = buf.readUInt32BE(stsz.start + stsz.headerSize + 4)
    const count = buf.readUInt32BE(stsz.start + stsz.headerSize + 8)
    const sizes: number[] = []
    if (uniformSize) {
      for (let i = 0; i < count; i++) sizes.push(uniformSize)
    } else {
      const table = stsz.start + stsz.headerSize + 12
      for (let i = 0; i < count; i++) sizes.push(buf.readUInt32BE(table + 4 * i))
    }
    if (!count) continue

    // chunk 偏移表
    const chunkOffsets: number[] = []
    const stco = findBox(buf, ['stco'], bs, be)
    const co64 = findBox(buf, ['co64'], bs, be)
    if (stco) {
      const n = buf.readUInt32BE(stco.start + stco.headerSize + 4)
      const table = stco.start + stco.headerSize + 8
      for (let i = 0; i < n; i++) chunkOffsets.push(buf.readUInt32BE(table + 4 * i))
    } else if (co64) {
      const n = buf.readUInt32BE(co64.start + co64.headerSize + 4)
      const table = co64.start + co64.headerSize + 8
      for (let i = 0; i < n; i++) chunkOffsets.push(Number(buf.readBigUInt64BE(table + 8 * i)))
    } else {
      continue
    }
    if (!chunkOffsets.length) continue

    // stsc：first_chunk / samples_per_chunk / desc_index
    const stsc = findBox(buf, ['stsc'], bs, be)
    if (!stsc) continue
    const runCount = buf.readUInt32BE(stsc.start + stsc.headerSize + 4)
    const table = stsc.start + stsc.headerSize + 8
    const runs: Array<{ first: number; perChunk: number }> = []
    for (let i = 0; i < runCount; i++) {
      runs.push({
        first: buf.readUInt32BE(table + 12 * i),
        perChunk: buf.readUInt32BE(table + 12 * i + 4),
      })
    }
    const perChunk = new Array<number>(chunkOffsets.length).fill(0)
    for (let i = 0; i < runs.length; i++) {
      const last = i + 1 < runs.length ? runs[i + 1]!.first - 1 : chunkOffsets.length
      for (let c = runs[i]!.first; c <= last; c++) {
        if (c >= 1 && c <= chunkOffsets.length) perChunk[c - 1] = runs[i]!.perChunk
      }
    }

    const offsets: number[] = []
    let sample = 0
    for (let c = 0; c < chunkOffsets.length && sample < count; c++) {
      let off = chunkOffsets[c]!
      for (let n = 0; n < perChunk[c]! && sample < count; n++) {
        offsets.push(off)
        off += sizes[sample]!
        sample++
      }
    }
    if (offsets.length !== count) return null
    return { handler, sizes, offsets }
  }
  return null
}

/**
 * 在 trak 字节范围内找 senc 盒，取首个样本 IV 的高 8 字节作为 base_iv。
 * 每样本 IV = ((base_iv + 样本序号) << 64)。
 */
export function trackSencBaseIv(buf: Buffer, trakStart: number, trakEnd: number): string | null {
  for (let i = trakStart; i + 12 < trakEnd; i++) {
    if (buf.toString('latin1', i, i + 4) !== 'senc') continue
    // 'senc' + version/flags(4) + sample_count(4) + 首个 IV(16)
    const o = i + 8 + 4
    if (o + 8 > buf.length) continue
    return buf.toString('hex', o, o + 8)
  }
  return null
}

export type EncryptedTrack = {
  handler: string
  track: Track
  baseIv: string
}

/** 找出所有带 senc 的加密轨（视频 + 音频） */
export function findEncryptedTracks(buf: Buffer): EncryptedTrack[] {
  const moov = findBox(buf, ['moov'])
  if (!moov) return []
  const out: EncryptedTrack[] = []
  for (const trak of childBoxes(buf, moov)) {
    if (trak.type !== 'trak') continue
    const handler = trackHandler(buf, trak)
    if (handler !== 'vide' && handler !== 'soun') continue
    const baseIv = trackSencBaseIv(buf, trak.start, trak.end)
    if (!baseIv) continue // 该轨未加密
    const track = parseTrackSamples(buf, handler)
    if (!track || !track.offsets.length) continue
    out.push({ handler, track, baseIv })
  }
  return out
}