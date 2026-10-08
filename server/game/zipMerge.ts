/**
 * Minimal ZIP merge (copy compressed entries as-is).
 * Used to embed arcade BIOS (pgm.zip / neogeo.zip) into the game romset so
 * EmulatorJS stable does not extract BIOS into loose files that FBNeo ignores.
 */

type ZipEntry = {
  name: string
  localHeader: Uint8Array
  data: Uint8Array
  centralHeader: Uint8Array
}

function u16(view: DataView, offset: number) {
  return view.getUint16(offset, true)
}

function u32(view: DataView, offset: number) {
  return view.getUint32(offset, true)
}

function writeU16(buf: Uint8Array, offset: number, value: number) {
  buf[offset] = value & 0xff
  buf[offset + 1] = (value >>> 8) & 0xff
}

function writeU32(buf: Uint8Array, offset: number, value: number) {
  buf[offset] = value & 0xff
  buf[offset + 1] = (value >>> 8) & 0xff
  buf[offset + 2] = (value >>> 16) & 0xff
  buf[offset + 3] = (value >>> 24) & 0xff
}

function decodeName(bytes: Uint8Array) {
  try {
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  }
}

/** Find EOCD; return offset or -1 */
function findEocd(buf: Uint8Array) {
  // EOCD is at least 22 bytes; comment max 65535
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const min = Math.max(0, buf.byteLength - 22 - 65535)
  for (let i = buf.byteLength - 22; i >= min; i--) {
    if (u32(view, i) === 0x06054b50) return i
  }
  return -1
}

function parseZipEntries(buf: Uint8Array): ZipEntry[] {
  const eocd = findEocd(buf)
  if (eocd < 0) throw new Error('invalid zip: EOCD not found')

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const cdOffset = u32(view, eocd + 16)
  const cdEntries = u16(view, eocd + 10)
  const entries: ZipEntry[] = []

  let offset = cdOffset
  for (let i = 0; i < cdEntries; i++) {
    if (u32(view, offset) !== 0x02014b50) throw new Error('invalid zip: bad central header')
    const flags = u16(view, offset + 8)
    const method = u16(view, offset + 10)
    const compSize = u32(view, offset + 20)
    const nameLen = u16(view, offset + 28)
    const extraLen = u16(view, offset + 30)
    const commentLen = u16(view, offset + 32)
    const localOffset = u32(view, offset + 42)
    const nameBytes = buf.subarray(offset + 46, offset + 46 + nameLen)
    const name = decodeName(nameBytes)

    const centralHeader = buf.subarray(offset, offset + 46 + nameLen + extraLen + commentLen)

    if (u32(view, localOffset) !== 0x04034b50) throw new Error(`invalid zip: bad local header (${name})`)
    const localNameLen = u16(view, localOffset + 26)
    const localExtraLen = u16(view, localOffset + 28)
    const localHeaderSize = 30 + localNameLen + localExtraLen
    // Data descriptor (bit 3) may append 12/16 bytes after data; use central sizes
    const dataStart = localOffset + localHeaderSize
    const dataEnd = dataStart + compSize
    const localHeader = buf.subarray(localOffset, dataStart)
    const data = buf.subarray(dataStart, dataEnd)

    // Skip directory markers
    if (!name.endsWith('/')) {
      entries.push({
        name,
        localHeader: new Uint8Array(localHeader),
        data: new Uint8Array(data),
        centralHeader: new Uint8Array(centralHeader),
      })
    }

    // Keep method/flags for sanity (unused beyond copy)
    void flags
    void method

    offset += 46 + nameLen + extraLen + commentLen
  }

  return entries
}

function rebuildZip(entries: ZipEntry[]) {
  let localSize = 0
  for (const e of entries) localSize += e.localHeader.byteLength + e.data.byteLength

  let cdSize = 0
  for (const e of entries) cdSize += e.centralHeader.byteLength

  const out = new Uint8Array(localSize + cdSize + 22)
  let cursor = 0
  const offsets: number[] = []

  for (const e of entries) {
    offsets.push(cursor)
    out.set(e.localHeader, cursor)
    cursor += e.localHeader.byteLength
    out.set(e.data, cursor)
    cursor += e.data.byteLength
  }

  const cdStart = cursor
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!
    const header = new Uint8Array(e.centralHeader)
    writeU32(header, 42, offsets[i]!)
    out.set(header, cursor)
    cursor += header.byteLength
  }

  // EOCD
  writeU32(out, cursor, 0x06054b50)
  writeU16(out, cursor + 4, 0)
  writeU16(out, cursor + 6, 0)
  writeU16(out, cursor + 8, entries.length)
  writeU16(out, cursor + 10, entries.length)
  writeU32(out, cursor + 12, cursor - cdStart)
  writeU32(out, cursor + 16, cdStart)
  writeU16(out, cursor + 20, 0)

  return out
}

/**
 * Merge `biosZip` entries into `romZip`. Same-name entries from `romZip` win.
 */
export function mergeZipBuffers(romZip: Uint8Array, biosZip: Uint8Array): Uint8Array {
  const biosEntries = parseZipEntries(biosZip)
  const romEntries = parseZipEntries(romZip)
  const map = new Map<string, ZipEntry>()
  for (const e of biosEntries) map.set(e.name, e)
  for (const e of romEntries) map.set(e.name, e)
  return rebuildZip([...map.values()])
}
