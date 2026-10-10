/**
 * 客体内存视图 —— 把 Unicorn 的裸 API 包成读写字节 / 整数 / C 字符串 / 内存分配。
 *
 * syscall 和 JNI 两层都要靠它跟客体互传数据，集中放在这里避免到处 uc_mem_read。
 */

import { PROT, REG, loadUnicorn } from './unicorn.ts'

const PAGE = 0x1000n

export class Memory {
  /** 已映射区间，分配时避开 */
  private regions: { start: bigint; end: bigint; perms: number }[] = []
  /** 预留给栈；heap 从另一个方向往上长 */
  readonly stackTop: bigint
  readonly brkBase: bigint
  private brkCur: bigint
  private readonly uc: any
  readonly handle: any

  constructor(uc: any, handle: any, opts: { stackBase?: bigint; stackSize?: bigint; heapBase?: bigint } = {}) {
    this.uc = uc
    this.handle = handle
    const stackBase = opts.stackBase ?? 0x2000000000n
    const stackSize = opts.stackSize ?? 0x100000n
    this.stackTop = stackBase + stackSize
    this.map(stackBase, stackSize, PROT.READ | PROT.WRITE)
    this.brkBase = opts.heapBase ?? 0x3000000000n
    this.brkCur = this.brkBase
  }

  /**
   * 映射一段内存并记入已分配表。
   *
   * 幂等：若请求区间已被覆盖且权限足够，直接返回。
   * （ELF 装载时相邻库的页边界常与调用方预映射的区间重叠，硬失败很常见）
   */
  map(addr: bigint, size: bigint, perms: number): bigint {
    const start = addr & ~(PAGE - 1n)
    const end = ((addr + size + PAGE - 1n) / PAGE) * PAGE
    const need = end - start
    const covered = this.regions
      .filter((r) => r.start <= start && r.end >= end)
      .reduce((a, b) => a | b, 0)
    if ((covered & perms) === perms) return start
    const rc = this.uc.memMap(this.handle, start, need, perms)
    if (rc !== 0) throw new Error(`mmap 0x${start.toString(16)}+0x${need.toString(16)} rc=${rc} ${this.uc.strerror(rc)}`)
    this.regions.push({ start, end, perms: covered | perms })
    return start
  }

  protected(addr: bigint, size: bigint, perms: number): number {
    const start = addr & ~(PAGE - 1n)
    const end = ((addr + size + PAGE - 1n) / PAGE) * PAGE
    return this.uc.memProtect(this.handle, start, end - start, perms)
  }

  unmap(addr: bigint, size: bigint): number {
    const start = addr & ~(PAGE - 1n)
    const end = ((addr + size + PAGE - 1n) / PAGE) * PAGE
    return this.uc.memUnmap(this.handle, start, end - start)
  }

  /** 是否落在任何已映射区间里（SVC 落在野地址时要靠它兜底） */
  isMapped(addr: bigint): boolean {
    return this.regions.some((r) => addr >= r.start && addr < r.end)
  }

  /** 在 [start, end) 里找一段空闲空间 */
  findFree(start: bigint, end: bigint, size: bigint): bigint {
    size = (size + PAGE - 1n) / PAGE * PAGE
    let cur = (start + PAGE - 1n) / PAGE * PAGE
    while (cur + size <= end) {
      const hit = this.regions.find((r) => cur < r.end && cur + size > r.start)
      if (!hit) return cur
      cur = hit.end
    }
    throw new Error(`内存耗尽：在 0x${start.toString(16)}..0x${end.toString(16)} 里找不到 ${size} 字节`)
  }

  // ---- 读写

  read(addr: bigint, len: number): Uint8Array {
    return this.uc.memRead(this.handle, addr, len)
  }

  write(addr: bigint, bytes: Uint8Array): void {
    this.uc.memWrite(this.handle, addr, bytes)
  }

  readU8(addr: bigint): number { return this.read(addr, 1)[0] }
  readU32(addr: bigint): number { return Buffer.from(this.read(addr, 4)).readUInt32LE(0) }
  readU64(addr: bigint): bigint { return Buffer.from(this.read(addr, 8)).readBigUInt64LE(0) }

  writeU8(addr: bigint, v: number): void { this.write(addr, Uint8Array.of(v & 0xff)) }
  writeU32(addr: bigint, v: number): void {
    const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0, 0); this.write(addr, new Uint8Array(b))
  }
  writeU64(addr: bigint, v: bigint): void {
    const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt.asUintN(64, v), 0); this.write(addr, new Uint8Array(b))
  }

  /** 读 C 字符串（遇 0 停），不抛异常，未映射时返回 '' */
  readCString(addr: bigint, max = 4096): string {
    if (!addr) return ''
    const out: number[] = []
    for (let i = 0; i < max; i++) {
      const p = addr + BigInt(i)
      if (!this.isMapped(p)) break
      const c = this.readU8(p)
      if (c === 0) break
      out.push(c)
    }
    return Buffer.from(out).toString('utf8')
  }

  /** 写 C 字符串（含结尾 0），返回写入长度（含 0） */
  writeCString(addr: bigint, s: string): number {
    const b = Buffer.from(s, 'utf8')
    const out = Buffer.alloc(b.length + 1)
    b.copy(out)
    this.write(addr, new Uint8Array(out))
    return out.length
  }

  // ---- 寄存器

  reg(id: number): bigint { return this.uc.regRead(this.handle, id) }
  setReg(id: number, v: bigint): void { this.uc.regWrite(this.handle, id, v) }
  get x0() { return this.reg(REG.X0) }
  set x0(v: bigint) { this.setReg(REG.X0, v) }
  get pc() { return this.reg(REG.PC) }
  get lr() { return this.reg(REG.LR) }
  get sp() { return this.reg(REG.SP) }
  get x8() { return this.reg(REG.X8) }

  /** 读 x0..x5 六个参数 */
  args(): bigint[] {
    return [REG.X0, REG.X1, REG.X2, REG.X3, REG.X4, REG.X5].map((r) => this.reg(r))
  }

  // ---- 堆 / 栈

  /** 简单 bump 分配：从 heapTop 往上给 */
  heapAlloc(size: bigint, align = 0x10n): bigint {
    this.brkCur = ((this.brkCur + align - 1n) / align) * align
    const p = this.brkCur
    this.brkCur += size
    if (!this.isMapped(p) || !this.isMapped(this.brkCur - 1n)) {
      this.map(p, ((this.brkCur - p) / PAGE + 1n) * PAGE, PROT.READ | PROT.WRITE)
    }
    return p
  }

  /** 当前 brk 水位 */
  get brk() { return this.brkCur }
  setBrk(v: bigint) { this.brkCur = v }

  /** 压栈一个 qword，返回新的 sp */
  push64(v: bigint): bigint {
    const sp = this.sp - 8n
    this.setReg(REG.SP, sp)
    this.writeU64(sp, v)
    return sp
  }
}

/** 开一个引擎 + 内存视图的便捷函数 */
export function openMachine(opts?: Parameters<typeof Memory.prototype.constructor>[2]) {
  const api = loadUnicorn()
  const h = api.open(2 /* ARM64 */, 0)
  const mem = new Memory(api, h, opts)
  return { api, handle: h, mem }
}

export { PAGE }