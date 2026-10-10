/**
 * 最小 ELF64 aarch64 解析器 —— 只覆盖「装载共享库」需要的东西。
 *
 * 范围是刻意收窄的：程序头（PT_LOAD/PT_DYNAMIC/PT_TLS）、.dynamic、
 * .dynsym、.rela.*、.init_array。不做符号调试、不做 .debug_*、不处理静态链接。
 *
 * 实测口径（scripts/hongguo-trace/reloinfo.py 统计 hongguo-work 那批工件）：
 *   需要的重定位类型只有 4 种：RELATIVE / JUMP_SLOT / ABS64 / GLOB_DAT
 *   所有库都没有 DT_INIT，只有 DT_INIT_ARRAY
 *   所有库都是 2 个 PT_LOAD
 */

// ---------------------------------------------------------------- ELF 常量

export const PT = {
  LOAD: 1,
  DYNAMIC: 2,
  INTERP: 3,
  NOTE: 4,
  PHDR: 6,
  TLS: 7,
} as const

export const PF = { X: 1, W: 2, R: 4 } as const

export const SHT = { DYNSYM: 11, DYNAMIC: 6, STRTAB: 2 } as const

/** aarch64 重定位类型（elf.h 的 R_AARCH64_*） */
export const R_AARCH64 = {
  NONE: 0,
  ABS64: 257,
  ABS32: 258,
  COPY: 1024,
  GLOB_DAT: 1025,
  JUMP_SLOT: 1026,
  RELATIVE: 1027,
  TLS_DTPMOD64: 1028,
  TLS_DTPREL64: 1029,
  TLS_TPREL64: 1030,
  TLS_DESC: 1031,
  IRELATIVE: 1032,
} as const

export const R_AARCH64_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(R_AARCH64).map(([k, v]) => [v, k]),
)

export const DT = {
  NULL: 0,
  NEEDED: 1,
  PLTRELSZ: 2,
  PLTGOT: 3,
  HASH: 4,
  STRTAB: 5,
  SYMTAB: 6,
  RELA: 7,
  RELASZ: 8,
  RELAENT: 9,
  STRSZ: 10,
  INIT: 12,
  FINI: 13,
  SONAME: 14,
  RPATH: 15,
  SYMBOLIC: 16,
  REL: 17,
  RELSZ: 18,
  RELENT: 19,
  PLTREL: 20,
  DEBUG: 21,
  TEXTREL: 22,
  JMPREL: 23,
  BIND_NOW: 24,
  INIT_ARRAY: 25,
  FINI_ARRAY: 26,
  INIT_ARRAYSZ: 27,
  FINI_ARRAYSZ: 28,
  RUNPATH: 29,
  FLAGS: 30,
} as const

/** STB_* —— 弱符号缺失不算 unresolved */
export const STB = { LOCAL: 0, GLOBAL: 1, WEAK: 2, GNU_UNIQUE: 10 } as const
/** SHN_* */
export const SHN = { UNDEF: 0, ABS: 0xFFF1, COMMON: 0xFFF2 } as const

// ---------------------------------------------------------------- 类型

export type Segment = {
  type: number
  flags: number
  offset: number
  vaddr: number
  filesz: number
  memsz: number
  align: number
}

export type ElfSymbol = {
  name: string
  value: number
  size: number
  bind: number
  type: number
  shndx: number
}

export type Rela = {
  /** 写入目标的虚拟地址（未加 load base） */
  offset: number
  /** r_info >> 32 */
  sym: number
  /** r_info & 0xffffffff */
  type: number
  addend: bigint
}

export type ElfImage = {
  name: string
  machine: number
  segments: Segment[]
  needed: string[]
  soname: string | null
  /** .init_array 里的函数偏移数组（相对 load base） */
  initArray: number[]
  /** 导出符号：名字 → 符号 */
  symbols: Map<string, ElfSymbol>
  /** .dynsym 全表，索引对齐 r_info>>32 */
  dynsym: ElfSymbol[]
  relocations: Rela[]
  /** 镜像跨度 = max(vaddr+memsz) */
  span: number
  /** PT_LOAD 段需要的最低地址对齐 */
  loadVaddr: number
  hasTls: boolean
}

/** 装载结果：一个 so 的运行时状态 */
export type LoadedSo = {
  name: string
  /** 实际装载基址；so 内的 vaddr V 对应绝对地址 base + V */
  base: bigint
  span: number
  /** 桩库（libandroid.so 这类）为 null */
  elf: ElfImage | null
  /** 由 addStubLib 造的桩 */
  isStub: boolean
  path?: string
  relocStat?: RelocStat
}

/** 重定位落地统计 */
export type RelocStat = {
  relative: number
  jumpSlot: number
  globDat: number
  abs64: number
  /** 未处理的类型数（实测应为 0） */
  skipped: number
  /** 解析不到的符号名 */
  unresolved: string[]
}

// ---------------------------------------------------------------- 解析

function cstr(buf: Buffer, off: number): string {
  if (off < 0 || off >= buf.length) return ''
  const end = buf.indexOf(0, off)
  return buf.subarray(off, end < 0 ? buf.length : end).toString('utf8')
}

function alignUp(v: number, a: number): number {
  if (a <= 1) return v
  return Math.ceil(v / a) * a
}

export function parseElf(buf: Buffer, name = ''): ElfImage {
  if (buf.length < 64 || buf.readUInt32BE(0) !== 0x7f454c46) {
    throw new Error(`${name}: 不是 ELF`)
  }
  if (buf[4] !== 2) throw new Error(`${name}: 不是 ELF64`)
  if (buf[5] !== 1) throw new Error(`${name}: 不是小端`)
  const machine = buf.readUInt16LE(0x12)
  if (machine !== 0xb7) throw new Error(`${name}: machine=0x${machine.toString(16)}，期望 aarch64(0xb7)`)

  const phoff = Number(buf.readBigUInt64LE(0x20))
  const shoff = Number(buf.readBigUInt64LE(0x28))
  const phentsize = buf.readUInt16LE(0x36)
  const phnum = buf.readUInt16LE(0x38)
  const shentsize = buf.readUInt16LE(0x3a)
  const shnum = buf.readUInt16LE(0x3c)

  // ---- program headers
  const segments: Segment[] = []
  for (let i = 0; i < phnum; i++) {
    const o = phoff + i * phentsize
    if (o + 56 > buf.length) break
    segments.push({
      type: buf.readUInt32LE(o),
      flags: buf.readUInt32LE(o + 4),
      offset: Number(buf.readBigUInt64LE(o + 8)),
      vaddr: Number(buf.readBigUInt64LE(o + 16)),
      filesz: Number(buf.readBigUInt64LE(o + 32)),
      memsz: Number(buf.readBigUInt64LE(o + 40)),
      align: Number(buf.readBigUInt64LE(o + 48)),
    })
  }
  const loads = segments.filter((s) => s.type === PT.LOAD)
  const span = loads.reduce((m, s) => Math.max(m, s.vaddr + s.memsz), 0)
  const loadVaddr = loads.reduce((m, s) => Math.min(m, s.vaddr), 0)
  const hasTls = segments.some((s) => s.type === PT.TLS)

  // ---- section headers（用来按 vaddr 反查 .dynamic / .dynsym / .rela*）
  const sections: { type: number; flags: number; addr: number; offset: number; size: number; link: number; entsize: number }[] = []
  for (let i = 0; i < shnum; i++) {
    const o = shoff + i * shentsize
    if (o + 64 > buf.length) break
    sections.push({
      type: buf.readUInt32LE(o + 4),
      flags: Number(buf.readBigUInt64LE(o + 8)),
      addr: Number(buf.readBigUInt64LE(o + 16)),
      offset: Number(buf.readBigUInt64LE(o + 24)),
      size: Number(buf.readBigUInt64LE(o + 32)),
      link: buf.readUInt32LE(o + 40),
      entsize: Number(buf.readBigUInt64LE(o + 56)),
    })
  }

  // ---- .dynamic
  // ⚠️ 必须保留完整条目列表：DT_NEEDED 可以出现多次，用 Map<tag,val> 会互相覆盖，
  //    导致 NEEDED 只剩最后一个（踩过）。
  const dynSection = sections.find((s) => s.type === SHT.DYNAMIC)
  const dynEntries: [number, bigint][] = []
  if (dynSection) {
    for (let o = dynSection.offset; o + 16 <= dynSection.offset + dynSection.size; o += 16) {
      const tag = Number(buf.readBigInt64LE(o))
      const val = buf.readBigUInt64LE(o + 8)
      if (tag === DT.NULL) break
      dynEntries.push([tag, val])
    }
  }
  /** 单值 tag（STRTAB/SYMTAB/INIT_ARRAY…）用这个查；重复 tag 取最后一个 */
  const dt = new Map<number, number>()
  for (const [tag, val] of dynEntries) dt.set(tag, Number(val))

  /** 按虚拟地址找包含它的 section（.dynamic/.dynsym/.rela 的 addr 已知） */
  const byAddr = (addr: number) => sections.find((s) => s.addr === addr)

  // ---- 字符串表：DT_STRTAB 是虚拟地址，要换算成文件偏移
  const strtabAddr = Number(dt.get(DT.STRTAB) ?? 0)
  const strtabSec = byAddr(strtabAddr)
  const dynstr = strtabSec ? buf.subarray(strtabSec.offset, strtabSec.offset + strtabSec.size) : Buffer.alloc(0)

  const needed: string[] = []
  for (const [tag, val] of dynEntries) {
    if (tag === DT.NEEDED) needed.push(cstr(dynstr, Number(val)))
  }
  const sonameOff = dt.get(DT.SONAME)
  const soname = sonameOff != null ? cstr(dynstr, Number(sonameOff)) : null

  // ---- .dynsym
  const symtabAddr = Number(dt.get(DT.SYMTAB) ?? 0)
  const symtabSec = byAddr(symtabAddr)
  const dynsym: ElfSymbol[] = []
  const symbols = new Map<string, ElfSymbol>()
  if (symtabSec) {
    const strSec = sections[symtabSec.link]
    const symStr = strSec ? buf.subarray(strSec.offset, strSec.offset + strSec.size) : Buffer.alloc(0)
    const n = Math.floor(symtabSec.size / 24)
    for (let i = 0; i < n; i++) {
      const o = symtabSec.offset + i * 24
      const stName = buf.readUInt32LE(o)
      const stInfo = buf.readUInt8(o + 4)
      const stShndx = buf.readUInt16LE(o + 6)
      const stValue = Number(buf.readBigUInt64LE(o + 8))
      const stSize = Number(buf.readBigUInt64LE(o + 16))
      const sym: ElfSymbol = {
        name: cstr(symStr, stName),
        value: stValue,
        size: stSize,
        bind: stInfo >> 4,
        type: stInfo & 0xf,
        shndx: stShndx,
      }
      dynsym.push(sym)
      if (sym.shndx !== SHN.UNDEF && sym.name && stValue !== 0) {
        if (!symbols.has(sym.name)) symbols.set(sym.name, sym)
      }
    }
  }

  // ---- .rela.*（DT_RELA/DT_RELASZ 与 DT_JMPREL/DT_PLTRELSZ 两处都要收）
  const relocations: Rela[] = []
  const collectRela = (addr: number, size: number) => {
    const sec = byAddr(addr)
    if (!sec) return
    const entsz = sec.entsize || 24
    const n = Math.floor(Math.min(size || sec.size, sec.size) / entsz)
    for (let i = 0; i < n; i++) {
      const o = sec.offset + i * entsz
      const rOffset = Number(buf.readBigUInt64LE(o))
      const rInfo = buf.readBigUInt64LE(o + 8)
      relocations.push({
        offset: rOffset,
        sym: Number(rInfo >> 32n),
        type: Number(rInfo & 0xffffffffn),
        addend: buf.readBigInt64LE(o + 16),
      })
    }
  }
  collectRela(Number(dt.get(DT.RELA) ?? 0), Number(dt.get(DT.RELASZ) ?? 0))
  collectRela(Number(dt.get(DT.JMPREL) ?? 0), Number(dt.get(DT.PLTRELSZ) ?? 0))

  // ---- .init_array
  const initArray: number[] = []
  const initArrAddr = Number(dt.get(DT.INIT_ARRAY) ?? 0)
  const initArrSz = Number(dt.get(DT.INIT_ARRAYSZ) ?? 0)
  if (initArrAddr && initArrSz) {
    const sec = byAddr(initArrAddr)
    if (sec) {
      const n = Math.floor(Math.min(initArrSz, sec.size) / 8)
      for (let i = 0; i < n; i++) {
        initArray.push(Number(buf.readBigUInt64LE(sec.offset + i * 8)))
      }
    }
  }

  return {
    name,
    machine,
    segments,
    needed,
    soname,
    initArray,
    symbols,
    dynsym,
    relocations,
    span,
    loadVaddr,
    hasTls,
  }
}

export { cstr, alignUp }