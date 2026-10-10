/**
 * bionic 风格的共享库装载器 —— 只做「映射 + 符号解析 + 重定位」，不执行任何代码。
 *
 * 验收标准（scripts/hongguo-elf-loader-check.mjs）：
 *   libmetasec_ml.so 的 226 个未定义符号全部解析成功，重定位全部落地。
 *
 * 与真实 bionic linker 的差异（都是有意的简化，记录在这里免得后来人踩）：
 *  - **全量绑定**，不做 lazy binding：JUMP_SLOT 直接写真实地址。
 *    aarch64 的 PLT stub 本身就是 `adrp/ldr/br` 走 GOT 的，
 *    把 GOT 槽写实等于提前完成绑定，语义等价但不需要 dl_runtime。
 *  - 不处理 COPY / IRELATIVE / TLS 重定位（这批工件里一个都没有，见 reloinfo.py）。
 *  - 符号可见性是扁平的全局表，先注册者胜出；不做 ELF symbol versioning。
 *  - 不跑 DT_INIT / DT_INIT_ARRAY —— 那属于「开始执行代码」阶段的事。
 */

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

import {
  PT,
  PF,
  R_AARCH64,
  parseElf,
  type ElfSymbol,
  type LoadedSo,
  type RelocStat,
} from './elf.ts'

export type UnicornLike = {
  memMap(h: any, addr: bigint, size: bigint, perms: number): number
  memWrite(h: any, addr: bigint, bytes: Uint8Array): number
  memRead(h: any, addr: bigint, len: number): Uint8Array
  memProtect(h: any, addr: bigint, size: bigint, perms: number): number
  regRead(h: any, id: number): bigint
  regWrite(h: any, id: number, v: bigint): number
  emuStart(h: any, begin: bigint, until: bigint, timeout: bigint, count: bigint): number
  strerror(rc: number): string
}

export type LoaderOptions = {
  /** 起始映射地址 */
  base?: bigint
  /** 每个库之间的间隔，给 linker 空间（bionic 也是这么留的） */
  stride?: bigint
  /** 页大小 */
  pageSize?: bigint
}

export type LoadReport = {
  loaded: LoadedSo[]
  unresolved: string[]
  relocs: RelocStat
}

type GlobalEntry = { so: string; sym: ElfSymbol; base: bigint }

const alignUp = (v: bigint, a: bigint) => ((v + a - 1n) / a) * a

export class ElfLoader {
  private readonly globals = new Map<string, GlobalEntry>()
  readonly loaded: LoadedSo[] = []
  private cursor: bigint
  private readonly stride: bigint
  private readonly pageSize: bigint
  private readonly uc: UnicornLike
  private readonly handle: any
  /** 桩函数（libandroid.so 之类）专用可执行页 */
  private stubPage: bigint | null = null

  constructor(uc: UnicornLike, handle: any, opts: LoaderOptions = {}) {
    this.uc = uc
    this.handle = handle
    // Android 64 位非 zygote 进程的库基址在 0x7xxxxxxxxx 量级，这里取个安全的低位起点，
    // 只要不与栈/heap 冲突即可（栈与 heap 由上层另行分配）
    this.cursor = opts.base ?? 0x10000000000n
    this.stride = opts.stride ?? 0x20000000n // 512MB 间隔，够 linker 空间
    this.pageSize = opts.pageSize ?? 0x1000n
  }

  /** 已注册的全局符号数量 */
  get symbolCount(): number {
    return this.globals.size
  }

  /** 查全局符号的真实地址 */
  lookup(name: string): bigint | null {
    const g = this.globals.get(name)
    return g ? g.base + BigInt(g.sym.value) : null
  }

  /**
   * 注册一组桩函数（jar 里没有的库，如 libandroid.so）。
   * 所有桩共用一个 `ret`，返回 0 —— 对 ALooper_ / ASensor 这类探测型 API 正是期望行为。
   */
  addStubLib(soName: string, symbols: string[]): LoadedSo {
    if (!this.stubPage) {
      this.stubPage = this.cursor
      this.uc.memMap(this.handle, this.stubPage, this.pageSize, PF.R | PF.X)
      this.cursor += this.pageSize + this.stride // 别和后面的库撞地址
    }
    const so: LoadedSo = {
      name: soName,
      base: this.stubPage,
      span: this.pageSize,
      elf: null,
      isStub: true,
    }
    for (const s of symbols) {
      if (!this.globals.has(s)) {
        this.globals.set(s, { so: soName, sym: { name: s, value: 0, size: 0, bind: 1, type: 2, shndx: 1 }, base: this.stubPage })
      }
    }
    this.loaded.push(so)
    return so
  }

  /**
   * 装载一个 .so：映射 PT_LOAD 段 → 登记导出符号。
   *
   * **不做重定位**，重定位统一交给 relocateAll()。
   * 因为这批 so 存在环状依赖：libdl.so 标称无 NEEDED，但它 undefined 的
   * `__cxa_finalize` / `__register_atfork` / `__cxa_atexit` 实际住在 libc.so 里，
   * 而 libc.so 又 NEEDED libdl.so。单遍「装载即重定位」必然有一边找不到符号。
   * 真实 linker 同样是先建全量符号表再逐个重定位。
   */
  load(path: string, opts?: { base?: bigint; name?: string }): LoadedSo {
    const name = opts?.name ?? basename(path)
    const elf = parseElf(readFileSync(path), name)

    // 映射地址：让 ELF 里的低 vaddr 落在 page-aligned 的基址上
    const mapBase = opts?.base ?? alignUp(this.cursor, this.pageSize)
    const loadBase = mapBase - BigInt(elf.loadVaddr)

    for (const seg of elf.segments) {
      if (seg.type !== PT.LOAD || seg.memsz === 0) continue
      const addr = loadBase + BigInt(seg.vaddr)
      const perms = (seg.flags & PF.R ? PF.R : 0) | (seg.flags & PF.W ? PF.W : 0) | (seg.flags & PF.X ? PF.X : 0)
      // 整段按页取整映射，再只写 filesz，剩余部分是 .bss（天然为 0）
      const mapStart = addr & ~(this.pageSize - 1n)
      const mapEnd = alignUp(addr + BigInt(seg.memsz), this.pageSize)
      const mapSize = mapEnd - mapStart
      if (mapSize > 0n) {
        const rc = this.uc.memMap(this.handle, mapStart, mapSize, perms || PF.R)
        if (rc !== 0) throw new Error(`${name}: 映射 PT_LOAD @0x${mapStart.toString(16)} 失败 rc=${rc} ${this.uc.strerror(rc)}`)
      }
      if (seg.filesz > 0) {
        const bytes = readFileSync(path).subarray(seg.offset, seg.offset + seg.filesz)
        this.uc.memWrite(this.handle, addr, new Uint8Array(bytes))
      }
    }

    const so: LoadedSo = {
      name,
      base: loadBase,
      span: elf.span,
      elf,
      isStub: false,
      path,
    }
    this.loaded.push(so)
    this.cursor = mapBase + BigInt(elf.span) + this.stride

    // 先登记自己的导出符号（bionic 里本库符号优先级最高）
    for (const [symName, sym] of elf.symbols) {
      if (!this.globals.has(symName)) {
        this.globals.set(symName, { so: name, sym, base: loadBase })
      }
    }

    return so
  }

  /**
   * 所有库都装完后统一应用重定位。
   * 顺序无关紧要 —— 符号表此时已完整。
   */
  relocateAll(): void {
    for (const so of this.loaded) {
      if (!so.elf) continue
      so.relocStat = this.relocate(so)
    }
  }

  /** 应用重定位。只处理实测出现的 4 种类型。 */
  private relocate(so: LoadedSo): RelocStat {
    const elf = so.elf!
    const base = so.base
    const stat: RelocStat = { relative: 0, jumpSlot: 0, globDat: 0, abs64: 0, skipped: 0, unresolved: [] }

    const writeU64 = (addr: bigint, value: bigint) => {
      const b = Buffer.alloc(8)
      b.writeBigUInt64LE(value)
      this.uc.memWrite(this.handle, addr, new Uint8Array(b))
    }

    for (const r of elf.relocations) {
      const where = base + BigInt(r.offset)
      switch (r.type) {
        case R_AARCH64.RELATIVE:
          // RELA 语义：*loc = B + A
          writeU64(where, base + r.addend)
          stat.relative++
          break

        case R_AARCH64.JUMP_SLOT:
        case R_AARCH64.GLOB_DAT: {
          const sym = elf.dynsym[r.sym]
          const target = sym ? this.lookup(sym.name) : null
          if (target == null) {
            if (sym && !this.globals.has(sym.name)) stat.unresolved.push(sym.name)
            stat.skipped++
            break
          }
          writeU64(where, target)
          if (r.type === R_AARCH64.JUMP_SLOT) stat.jumpSlot++
          else stat.globDat++
          break
        }

        case R_AARCH64.ABS64: {
          const sym = elf.dynsym[r.sym]
          const target = sym ? this.lookup(sym.name) : null
          if (target == null) {
            if (sym && !this.globals.has(sym.name)) stat.unresolved.push(sym.name)
            stat.skipped++
            break
          }
          writeU64(where, target + r.addend)
          stat.abs64++
          break
        }

        default:
          stat.skipped++
          break
      }
    }
    return stat
  }

  /** 汇总：所有库加载完后，哪些 GLOBAL 未定义符号还没着落 */
  unresolvedAll(): string[] {
    const missing = new Set<string>()
    for (const so of this.loaded) {
      if (!so.elf) continue
      for (const s of so.elf.dynsym) {
        if (s.shndx !== 0 || !s.name) continue
        if (s.bind === 2 /* WEAK */ || s.bind === 10 /* GNU_UNIQUE */) continue
        if (!this.globals.has(s.name)) missing.add(s.name)
      }
    }
    return [...missing].sort()
  }

  /** 汇总所有库的重定位统计 */
  relocSummary(): RelocStat {
    const total: RelocStat = { relative: 0, jumpSlot: 0, globDat: 0, abs64: 0, skipped: 0, unresolved: [] }
    for (const so of this.loaded) {
      const st = so.relocStat
      if (!st) continue
      total.relative += st.relative
      total.jumpSlot += st.jumpSlot
      total.globDat += st.globDat
      total.abs64 += st.abs64
      total.skipped += st.skipped
    }
    return total
  }

  /** 库之间的依赖拓扑排序（依赖在前）。缺失的依赖用 onMissing 回调兜底。 */
  static topoSort(
    entries: { name: string; path: string }[],
    depsOf: (name: string) => string[],
    onMissing?: (dep: string, by: string) => void,
  ): { name: string; path: string }[] {
    const byName = new Map(entries.map((e) => [e.name, e]))
    const out: typeof entries = []
    const state = new Map<string, number>() // 0=未访问 1=访问中 2=完成

    const visit = (name: string, chain: string[]) => {
      const st = state.get(name) ?? 0
      if (st === 2) return
      if (st === 1) {
        console.warn(`  ⚠️ 依赖成环：${[...chain, name].join(' → ')}`)
        return
      }
      state.set(name, 1)
      const e = byName.get(name)
      if (e) {
        for (const dep of depsOf(name)) {
          if (byName.has(dep)) visit(dep, [...chain, name])
          else onMissing?.(dep, name)
        }
      }
      state.set(name, 2)
      if (e) out.push(e)
    }
    for (const e of entries) visit(e.name, [])
    return out
  }
}