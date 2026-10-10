/**
 * bionic syscall 层 —— 22 个 syscall，清单来自 scripts/hongguo-trace/run.sh 的实测 trace
 *（hongguo-work/trace/trace.log，141 次 SVC 事件）。
 *
 * 挂 UC_HOOK_INTR 拦 SVC（这条路已由 scripts/hongguo-svc-probe.mjs 验证：
 * hook 写 x0 后 Unicorn 会继续执行），所以：
 *   入参 x8=号、x0..x5
 *   返回值写 x0；失败写 **-errno**（不是正的 errno，这是 Linux syscall 惯例，
 *   弄反了 libc 会当成功处理，比报错更难查）
 *
 * 三个必须注意的地方：
 *  1. **futex 98 次**（占 43%）但全是 pthread 同步原语。WAIT 一律立刻返回 0、
 *     WAKE 返回 0，**不要真阻塞** —— 单线程模拟器里阻塞就是死锁。
 *  2. **mprotect 26 次**是自修改代码，必须真的调 uc_mem_protect，不能虚拟化。
 *  3. **不设 until 高水位**，靠 emu_start 的 count 上限兜底：真出现逻辑死循环时，
 *     没有上限整个进程会被挂死。
 */

import { randomFillSync } from 'node:crypto'

import { HOOK_TYPE, REG, type UnicornApi } from './unicorn.ts'
import type { Memory } from './memory.ts'

// ---------------------------------------------------------------- syscall 号

/** aarch64（asm-generic/unistd.h） */
export const NR = {
  fcntl: 25,
  faccessat: 48,
  openat: 56,
  close: 57,
  read: 63,
  write: 64,
  writev: 66,
  fstat: 80,
  futex: 98,
  clock_gettime: 113,
  prctl: 167,
  getcwd: 169,
  getpid: 172,
  getppid: 173,
  getuid: 174,
  getgid: 176,
  gettid: 178,
  socket: 198,
  connect: 203,
  brk: 214,
  munmap: 215,
  clone: 220,
  mmap: 222,
  mprotect: 226,
} as const

export const NR_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(NR).map(([k, v]) => [v, k.toUpperCase()]),
)

// ---------------------------------------------------------------- errno / 常量

/** errno 取值（asm-generic/errno.h），够 metasec 判分支即可 */
export const ERRNO = {
  EPERM: 1, ENOENT: 2, ESRCH: 3, EINTR: 4, EIO: 5, ENXIO: 6, E2BIG: 7,
  EBADF: 9, EAGAIN: 11, ENOMEM: 12, EACCES: 13, EFAULT: 14, EEXIST: 17,
  EINVAL: 22, ENFILE: 23, EMFILE: 24, ENOSPC: 28, ESPIPE: 29, EROFS: 30,
  EPIPE: 32, ENOSYS: 38, EAGAIN_AGAIN: 11, ENOTSUP: 95, ETIMEDOUT: 110,
  ECONNREFUSED: 111, ENETUNREACH: 101, EAFNOSUPPORT: 97,
} as const

const AT_FDCWD = -100
const AT_REMOVEDIR = 0x200

const PROT_R = 1, PROT_W = 2, PROT_X = 4
const MAP_SHARED = 0x01, MAP_PRIVATE = 0x02, MAP_FIXED = 0x10
const MAP_ANONYMOUS = 0x20, MAP_FIXED_NOREPLACE = 0x100000

const CLOCK_REALTIME = 0, CLOCK_MONOTONIC = 1, CLOCK_BOOTTIME = 7, CLOCK_PROCESS_CPUTIME_ID = 2

const FUTEX_WAIT = 0, FUTEX_WAKE = 1

const S_IFREG = 0o100000
const S_IFCHR = 0o020000
const S_IFDIR = 0o040000

const PAGE = 0x1000n

// ---------------------------------------------------------------- 虚拟文件

/**
 * `/proc/stat` 的固定内容。
 *
 * 长度必须**恰好 1871 字节** —— trace 里 `Read 1871 bytes from '/proc/stat'`
 * 是 unidbg 侧的真实读取长度，metasec 拿到的 CPU 核数等解析结果会进签名。
 * 这里用「真实 Linux 的字段结构 + 按需调整总长度」的方式构造，
 * 长度对齐是硬要求，字段内容只要自洽即可（签名里用的是解析出来的派生量）。
 */
function buildProcStat(): Buffer {
  const lines: string[] = [
    'cpu  1309213 22455 964199 32814762 40250 0 2641 0 0 0',
    'cpu0 436404 7481 321399 10938254 13416 0 880 0 0 0',
    'cpu1 436404 7481 321399 10938254 13416 0 880 0 0 0',
    'cpu2 436404 7482 321400 10938254 13416 0 880 0 0 0',
    'cpu3 436404 7491 321401 10938255 13417 0 881 0 0 0',
    'intr 80395493 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0',
    'ctxt 130186020',
    'btime 1754000000',
    'processes 3488291',
    'procs_running 3',
    'procs_blocked 0',
    'softirq 51348213 0 0 0 0 0 0 0 0 0 0',
  ]
  let out = lines.join('\n') + '\n'
  // 补齐到 trace 实测的 1871 字节
  const target = 1871
  if (out.length < target) {
    // 用合法的补充行把长度顶上去（device 行）
    let i = 0
    while (out.length < target) {
      const line = `device ${1000 + i} 0 0 0 0 0 0 0 0 0 0\n`
      if (out.length + line.length > target) {
        // 最后一行按需截断，保证总长精确
        out += line.slice(0, target - out.length)
        break
      }
      out += line
      i++
    }
  } else if (out.length > target) {
    out = out.slice(0, target)
  }
  return Buffer.from(out, 'utf8')
}

/**
 * `/dev/__properties__` —— android 属性表的伪文件。
 * metasec 只查 `__system_property_find` 是否成功；返回空表（查不到任何属性）
 * 就是「这台机器没有 android 属性」这一正确答案。
 * unidbg 侧这个文件被 open 过一次就 close，内容为空。
 */
function buildProperties(): Buffer {
  return Buffer.alloc(0)
}

export type VirtualFileSpec = {
  /** 返回内容；返回 null 表示读不到数据 */
  read?: (n: number) => Buffer
  size?: number
  mode?: number
}

export type OpenFile = {
  path: string
  pos: number
  data?: Buffer
  /** 无固定长度的一次性源（/dev/urandom） */
  fill?: (n: number) => Buffer
  mode: number
  /** 已读到 EOF */
  eof: boolean
}

export type SyscallTraceEntry = {
  nr: number
  name: string
  args: bigint[]
  ret: bigint
  pc: bigint
}

export type SyscallLayerOptions = {
  /** 进程名（影响 /proc 等） */
  processName?: string
  uid?: number
  gid?: number
  pid?: number
  /** mmap 的地址池 */
  mmapBase?: bigint
  mmapEnd?: bigint
  /** trace 回调 */
  onTrace?: (e: SyscallTraceEntry) => void
  /** 未实现的 syscall 号 */
  onUnknown?: (nr: number, args: bigint[]) => bigint
  /** 额外虚拟文件 */
  files?: Record<string, VirtualFileSpec | Buffer>
}

// ---------------------------------------------------------------- 层

export class SyscallLayer {
  private readonly api: UnicornApi
  private readonly handle: any
  private readonly mem: Memory
  private readonly opts: SyscallLayerOptions

  private readonly fds = new Map<number, OpenFile>()
  private nextFd = 3
  /** 自增 tid。gettid 26 次、clone 3 次，必须每次不同 */
  private tid = 4000
  private readonly tids = new Set<number>()

  private mmapBase: bigint
  private mmapEnd: bigint
  private mmapCur: bigint
  /** mmap 已分配区间，munmap 时判断该回收哪一段 */
  private readonly mmapAreas: { start: bigint; end: bigint }[] = []

  private callbackPtr: unknown = null
  /** 各 syscall 的调用计数，验收用 */
  readonly stats = new Map<string, number>()

  /** 单调时钟基准（纳秒） */
  private readonly bootNs = BigInt(Date.now()) * 1000000n

  constructor(api: UnicornApi, handle: any, mem: Memory, opts: SyscallLayerOptions = {}) {
    this.api = api
    this.handle = handle
    this.mem = mem
    this.opts = opts
    this.mmapBase = opts.mmapBase ?? 0x4000000000n
    this.mmapEnd = opts.mmapEnd ?? 0x6000000000n
    this.mmapCur = this.mmapBase

    const pid = opts.pid ?? 4242
    this.tids.add(pid)
    this.tid = pid + 1

    // 0/1/2 = stdin/stdout/stderr，metasec 会写日志
    this.installStdio()

    for (const [path, spec] of Object.entries(opts.files ?? {})) {
      this.registerFile(path, spec instanceof Uint8Array ? { read: () => spec } : spec)
    }
  }

  private installStdio(): void {
    this.fds.set(0, { path: 'stdin', pos: 0, mode: S_IFCHR, eof: false })
    this.fds.set(1, { path: 'stdout', pos: 0, mode: S_IFCHR, eof: false })
    this.fds.set(2, { path: 'stderr', pos: 0, mode: S_IFCHR, eof: false })
    this.nextFd = 3
  }

  /** 注册一个虚拟文件 */
  registerFile(path: string, spec: VirtualFileSpec | Buffer): void {
    const s: VirtualFileSpec = spec instanceof Uint8Array ? { read: () => spec } : spec
    this.virtual.set(path, s)
  }

  private readonly virtual = new Map<string, VirtualFileSpec>()

  /** 内置虚拟文件（与 FqTrace 的 IOResolver 对齐） */
  private builtinFile(path: string): VirtualFileSpec | undefined {
    switch (path) {
      case '/dev/__properties__':
        return { read: () => buildProperties(), size: 0, mode: S_IFREG }
      case '/proc/stat':
        return { read: () => buildProcStat(), size: 1871, mode: S_IFREG }
      case '/dev/urandom':
        // 一次性熵源：每次读给不同的随机内容
        return { fill: (n) => this.entropy(n), size: 0, mode: S_IFCHR }
      default:
        return this.virtual.get(path)
    }
  }

  private entropy(n: number): Buffer {
    const b = Buffer.alloc(n)
    // crypto 填充。绝不能用固定种子 —— metasec 从 /dev/urandom 取 4096 字节
    // 参与签名派生，常数化会直接产出可被重放的签名。
    randomFillSync(b)
    return b
  }

  // ---- 安装 hook

  /**
   * 挂 UC_HOOK_INTR。**必须在 emu_start 之前调一次。**
   *
   * koffi 的 trampoline 只在 FFI 调用期间有效，而 Unicorn 是之后才回调，
   * 所以必须 makeCallback 造一个持久指针（见 unicorn.ts 的说明）。
   */
  install(): void {
    if (this.callbackPtr) return
    this.callbackPtr = this.api.makeCallback('intr_fn', () => this.onIntr())
    const rc = this.api.hookAdd(this.handle, this.callbackPtr, HOOK_TYPE.INTR, 1n, 0n)
    if (rc !== 0) {
      throw new Error(`挂 UC_HOOK_INTR 失败 rc=${rc} ${this.api.strerror(rc)}`)
    }
  }

  /** 卸载并释放回调。close 之前必须调，否则引擎里还挂着已失效的函数指针。 */
  uninstall(): void {
    if (!this.callbackPtr) return
    this.api.releaseCallback(this.callbackPtr)
    this.callbackPtr = null
  }

  /** SVC 到达时由 Unicorn 回调 */
  private onIntr(): void {
    const nr = Number(this.mem.x8)
    const args = this.mem.args()
    const pc = this.mem.pc
    const ret = this.dispatch(nr, args)
    this.mem.x0 = BigInt.asUintN(64, ret)
    const name = NR_NAME[nr] ?? `NR_${nr}`
    this.stats.set(name, (this.stats.get(name) ?? 0) + 1)
    this.opts.onTrace?.({ nr, name, args, ret, pc })
  }

  // ---- 分派

  private dispatch(nr: number, a: bigint[]): bigint {
    const n = (i: number) => Number(a[i] ?? 0n)
    const p = (i: number) => a[i] ?? 0n

    switch (nr) {
      // ---- 身份类：返回值必须稳定但 tid 要各不相同
      case NR.getpid:
        return BigInt(this.opts.pid ?? 4242)
      case NR.getppid:
        return 1n
      case NR.getuid:
        return BigInt(this.opts.uid ?? 10074)
      case NR.getgid:
        return BigInt(this.opts.gid ?? this.opts.uid ?? 10074)
      case NR.gettid:
        // 单线程模拟器：主线程 tid == pid
        return BigInt(this.opts.pid ?? 4242)

      case NR.clone:
        // pthread_create 走这里。返回 0 表示「子线程」，但我们不真的建线程 ——
        // metasec 只是用它拿一个不同的 tid 做后续同步。返回一个新的正数 tid。
        return BigInt(++this.tid)

      // ---- 时钟
      case NR.clock_gettime:
        return this.clockGettime(n(0), p(1))

      // ---- 内存
      case NR.brk:
        return this.brk(p(0))
      case NR.mmap:
        return this.mmap(p(0), p(1), n(2), n(3), n(4), p(5))
      case NR.munmap:
        return this.munmap(p(0), p(1))
      case NR.mprotect:
        return this.mprotect(p(0), p(1), n(2))

      // ---- 文件
      case NR.openat:
        return this.openat(n(0), p(1), n(2), n(3))
      case NR.close:
        return this.close(n(0))
      case NR.read:
        return this.read(n(0), p(1), p(2))
      case NR.write:
        return this.write(n(0), p(1), p(2))
      case NR.writev:
        return this.writev(n(0), p(1), n(2))
      case NR.fstat:
        return this.fstat(n(0), p(1))
      case NR.fcntl:
        return this.fcntl(n(0), n(1), p(2))
      case NR.faccessat:
        return this.faccessat(n(0), p(1), n(2))

      // ---- 同步
      case NR.futex:
        return this.futex(p(0), n(1), n(2), p(3), p(4), n(5))

      // ---- 杂项
      case NR.prctl:
        // metasec 用 prctl(PR_SET_DUMPABLE/PR_GET_NAME) 做反调试/进程名探测。
        // 全返回 0 = 「都成功且无 dumpable 限制」，与真实 app 一致。
        return 0n
      case NR.getcwd:
        return this.getcwd(p(0), p(1))

      case NR.socket:
        // 环境探测：真实设备上这一步应当失败（没有对应网络栈权限）
        return -BigInt(ERRNO.EAFNOSUPPORT)
      case NR.connect:
        return -BigInt(ERRNO.ENETUNREACH)

      default:
        return this.opts.onUnknown?.(nr, a) ?? -BigInt(ERRNO.ENOSYS)
    }
  }

  // ---- 各个 syscall

  private clockGettime(clockId: number, tp: bigint): bigint {
    if (!tp) return -BigInt(ERRNO.EFAULT)
    let ns: bigint
    switch (clockId) {
      case CLOCK_MONOTONIC:
      case CLOCK_BOOTTIME:
        // ⚠️ 必须单调递增且带真实间隔，不能返回常数 ——
        //    trace 里 clock_gettime 调了 13 次，时钟类防重放会直接看这个。
        ns = this.bootNs + BigInt(Number(process.hrtime.bigint() / 1000n))
        break
      case CLOCK_PROCESS_CPUTIME_ID:
      case 5 /* CLOCK_THREAD_CPUTIME_ID */:
        ns = BigInt(Math.round(process.cpuUsage().user * 1e6 + process.cpuUsage().system * 1e6)) * 1000n
        break
      case CLOCK_REALTIME:
      default:
        ns = BigInt(Date.now()) * 1000000n
        break
    }
    // struct timespec = { time_t tv_sec; long tv_nsec; }，64 位下 16 字节
    this.mem.writeU64(tp, ns / 1000000000n)
    this.mem.writeU64(tp + 8n, ns % 1000000000n)
    return 0n
  }

  private brk(addr: bigint): bigint {
    // brk(0) 是查询，brk(x) 是设置。glibc 的 malloc 靠这两个配合使用。
    if (addr === 0n || addr < this.mem.brkBase) return this.mem.brk
    const want = (addr + 0xffffn) & ~0xffffn // bionic 16 字节粒度对齐到页
    const end = want + 0x100000n
    if (!this.mem.isMapped(want) || !this.mem.isMapped(end)) {
      try {
        this.mem.map(this.mem.brkBase, end - this.mem.brkBase, PROT_R | PROT_W)
      } catch {
        return this.mem.brk
      }
    }
    this.mem.setBrk(want)
    return this.mem.brk
  }

  private mmap(addr: bigint, length: bigint, prot: number, flags: number, fd: number, offset: bigint): bigint {
    const len = (length + PAGE - 1n) & ~(PAGE - 1n)
    if (len === 0n) return -BigInt(ERRNO.EINVAL)
    if (len > 0x10000000n) return -BigInt(ERRNO.ENOMEM) // 单次上限 256MB
    if ((flags & MAP_ANONYMOUS) === 0 && fd < 0) return -BigInt(ERRNO.EBADF)

    const perms = (prot & PROT_R ? PROT_R : 0) | (prot & PROT_W ? PROT_W : 0) | (prot & PROT_X ? PROT_X : 0)

    let target: bigint
    const fixed = (flags & MAP_FIXED) !== 0 || (flags & MAP_FIXED_NOREPLACE) !== 0
    if (addr !== 0n && fixed) {
      target = addr & ~(PAGE - 1n)
    } else if (addr !== 0n && (flags & MAP_FIXED_NOREPLACE) === 0 && !this.mem.isMapped(addr)) {
      // 非 FIXED 但调用方给了 hint，且该地址空闲
      target = addr & ~(PAGE - 1n)
    } else {
      target = this.findMmapSlot(len)
    }

    try {
      this.mem.map(target, len, perms || PROT_R)
    } catch {
      return -BigInt(ERRNO.ENOMEM)
    }
    this.mmapAreas.push({ start: target, end: target + len })

    // MAP_FIXED 要求整段替换；匿名映射新区域天然为 0，不必清。
    // 文件映射这里不实现 —— trace 里没有对 fd 的 mmap（都走 openat+read）。
    return target
  }

  /** 在 mmap 池里找一段空闲地址 */
  private findMmapSlot(len: bigint): bigint {
    let cur = this.mmapCur
    for (let guard = 0; guard < 4096; guard++) {
      const hit = this.mmapAreas.find((a) => cur < a.end && cur + len > a.start)
      if (!hit && cur + len <= this.mmapEnd && !this.mem.isMapped(cur)) {
        this.mmapCur = cur + len
        return cur
      }
      cur = (hit ? hit.end : cur + len + PAGE) & ~(PAGE - 1n)
    }
    throw new Error('mmap 地址池耗尽')
  }

  private munmap(addr: bigint, length: bigint): bigint {
    const len = (length + PAGE - 1n) & ~(PAGE - 1n)
    // 释放 Unicorn 映射。注意 mem.unmap 走的是裸 uc_mem_unmap，
    // 区间若与栈/heap 相交会失败 —— 那种情况忽略即可（glibc 会自己重试）。
    try {
      this.mem.unmap(addr, len)
    } catch {
      /* 部分重叠失败可忽略 */
    }
    const i = this.mmapAreas.findIndex((a) => a.start < addr + len && a.end > addr)
    if (i >= 0) this.mmapAreas.splice(i, 1)
    return 0n
  }

  private mprotect(addr: bigint, length: bigint, prot: number): bigint {
    if (length === 0n) return 0n
    const len = (length + PAGE - 1n) & ~(PAGE - 1n)
    const perms = (prot & PROT_R ? PROT_R : 0) | (prot & PROT_W ? PROT_W : 0) | (prot & PROT_X ? PROT_X : 0)
    // ⚠️ trace 里 mprotect 26 次，是自修改代码。必须真的生效，
    //    虚拟化会让「先 mprotect 加写权限再改 .text」的路径崩在这里。
    const rc = this.protectMem(addr, len, perms || PROT_R)
    return rc === 0 ? 0n : -BigInt(ERRNO.ENOMEM)
  }

  /** Memory.protected 是 protected 的，这里包一层 */
  private protectMem(addr: bigint, len: bigint, perms: number): number {
    const start = addr & ~(PAGE - 1n)
    return this.api.memProtect(this.handle, start, len, perms)
  }

  private openat(dirfd: number, pathname: bigint, flags: number, mode: number): bigint {
    const path = this.mem.readCString(pathname)
    const spec = this.builtinFile(path)
    if (!spec) {
      // 未注册的路径一律 ENOENT。注意：`.msdata` 的路径字符串被取了、也 hash 了，
      // 但文件**从未被打开** —— 所以这里不注册它是对的（见 README-node-porting.md 第 3 节）。
      return -BigInt(ERRNO.ENOENT)
    }
    const fd = this.nextFd++
    const entry: OpenFile = {
      path,
      pos: 0,
      mode: spec.mode ?? S_IFREG,
      eof: false,
      data: spec.read && spec.size !== 0 ? spec.read(spec.size) : undefined,
      fill: spec.fill,
    }
    this.fds.set(fd, entry)
    return BigInt(fd)
  }

  private close(fd: number): bigint {
    if (!this.fds.has(fd)) return -BigInt(ERRNO.EBADF)
    this.fds.delete(fd)
    return 0n
  }

  private read(fd: number, buf: bigint, count: bigint): bigint {
    const f = this.fds.get(fd)
    if (!f) return -BigInt(ERRNO.EBADF)
    const n = Number(count)
    if (n <= 0) return 0n

    let chunk: Buffer
    if (f.fill) {
      chunk = f.fill(n)
    } else if (f.data) {
      chunk = f.data.subarray(f.pos, f.pos + n)
    } else {
      // stdio / 无内容文件：读 0 字节（EOF）
      f.eof = true
      return 0n
    }
    if (chunk.length === 0) {
      f.eof = true
      return 0n
    }
    this.mem.write(buf, new Uint8Array(chunk))
    f.pos += chunk.length
    return BigInt(chunk.length)
  }

  private write(fd: number, buf: bigint, count: bigint): bigint {
    if (!this.fds.has(fd)) return -BigInt(ERRNO.EBADF)
    const n = Number(count)
    if (n <= 0) return 0n
    const bytes = this.mem.read(buf, n)
    const s = Buffer.from(bytes).toString('utf8')
    // metasec 输出的日志行（"[main]E/METASEC: Fatal: SDK not init"）从这里出去
    if (fd === 1 || fd === 2) {
      for (const line of s.split('\n')) {
        if (line.trim()) process.stderr.write(`  [so ${fd}] ${line}\n`)
      }
    }
    return BigInt(n)
  }

  /** writev：iovec 数组 {void* base; size_t len} */
  private writev(fd: number, iov: bigint, iovcnt: number): bigint {
    if (!this.fds.has(fd)) return -BigInt(ERRNO.EBADF)
    let total = 0
    for (let i = 0; i < iovcnt; i++) {
      const base = this.mem.readU64(iov + BigInt(i) * 16n)
      const len = Number(this.mem.readU64(iov + BigInt(i) * 16n + 8n))
      if (len === 0) continue
      const bytes = this.mem.read(base, len)
      if (fd === 1 || fd === 2) {
        const s = Buffer.from(bytes).toString('utf8')
        for (const line of s.split('\n')) {
          if (line.trim()) process.stderr.write(`  [so ${fd}] ${line}\n`)
        }
      }
      total += len
    }
    return BigInt(total)
  }

  /**
   * fstat —— 写 aarch64 的 `struct stat`（128 字节）。
   *
   * 布局取 aarch64 的 glibc/bionic 口径（与 x86-64 不同，别照抄 32 位那套）：
   *   0 st_dev   8 st_ino   16 st_mode  20 st_nlink
   *  24 st_uid   28 st_gid   32 st_rdev  40 st_size
   *  48 st_blksize 56 st_blocks
   */
  private fstat(fd: number, statBuf: bigint): bigint {
    const f = this.fds.get(fd)
    if (!f) return -BigInt(ERRNO.EBADF)
    const inode = this.inodeOf(f.path)
    const size = f.data ? BigInt(f.data.length) : (f.fill ? 0n : 0n)

    this.mem.writeU64(statBuf, inode.dev)
    this.mem.writeU64(statBuf + 8n, BigInt(inode.ino))
    this.mem.writeU32(statBuf + 16n, f.mode | 0o644)
    this.mem.writeU32(statBuf + 20n, 1) // st_nlink
    this.mem.writeU32(statBuf + 24n, this.opts.uid ?? 10074)
    this.mem.writeU32(statBuf + 28n, this.opts.gid ?? this.opts.uid ?? 10074)
    this.mem.writeU64(statBuf + 32n, 0n) // st_rdev
    this.mem.writeU64(statBuf + 40n, size) // st_size
    this.mem.writeU64(statBuf + 48n, 4096n) // st_blksize
    this.mem.writeU64(statBuf + 56n, (size + 4095n) / 4096n) // st_blocks
    return 0n
  }

  /** 与 FqTrace 里那张 inode 表对齐 */
  private inodeOf(path: string): { dev: bigint; ino: number } {
    const appDir = '/data/user/0/com.dragon.read.oversea.gp'
    if (path === appDir) return { dev: 0x8801n, ino: 655781 }
    if (path.startsWith(`${appDir}/`)) return { dev: 0x8801n, ino: 655864 }
    if (path.startsWith('/proc')) return { dev: 0x8801n, ino: 655800 }
    if (path.startsWith('/dev')) return { dev: 0x8801n, ino: 655700 }
    return { dev: 0x8801n, ino: 655000 }
  }

  /** fcntl：只应答 unidbg 会遇到的那几个 cmd */
  private fcntl(fd: number, cmd: number, arg: bigint): bigint {
    if (!this.fds.has(fd)) return -BigInt(ERRNO.EBADF)
    switch (cmd) {
      case 0 /* F_DUPFD */:
        return BigInt(this.nextFd++)
      case 1 /* F_GETFD */:
        return 0n
      case 2 /* F_SETFD */:
        return 0n
      case 3 /* F_GETFL */:
        return BigInt(O_ACCMODE)
      case 4 /* F_SETFL */:
        return 0n
      case 1030 /* F_GET_OWNER_EX */:
      case 1034 /* F_SETLEASE */:
        return -BigInt(ERRNO.EINVAL)
      default:
        return 0n
    }
  }

  private faccessat(dirfd: number, pathname: bigint, mode: number): bigint {
    const path = this.mem.readCString(pathname)
    if (!path) return -BigInt(ERRNO.ENOENT)
    const spec = this.builtinFile(path)
    if (spec) return 0n
    // 应用私有目录存在（FqTrace 注册了 inode），里面的文件不存在
    if (path.startsWith('/data/user/0/com.dragon.read.oversea.gp')) return 0n
    return -BigInt(ERRNO.ENOENT)
  }

  /**
   * futex —— trace 里 98 次，占 43%，但全是 pthread 同步原语。
   *
   * **不做真实阻塞**：单线程模拟器里 FUTEX_WAIT 阻塞就是死锁。
   * 语义上等价于「锁立刻可用」：WAIT 返回 0，WAKE 返回 0。
   * 真实 pthread 交错在单线程下不可观测，这个近似对签名结果没有影响
   * （解锁顺序不进入签名输入）。
   */
  private futex(uaddr: bigint, op: number, val: number, timeout: bigint, uaddr2: bigint, val3: number): bigint {
    const cmd = op & 0x7f
    switch (cmd) {
      case FUTEX_WAIT:
      case 9 /* FUTEX_WAIT_BITSET | PRIVATE(128) 已由 &0x7f 去掉 */:
        // 立刻「成功」，避免死锁
        return 0n
      case FUTEX_WAKE:
        // 没有别的线程，醒来 0 个
        return 0n
      default:
        return -BigInt(ERRNO.ENOSYS)
    }
  }

  private getcwd(buf: bigint, size: bigint): bigint {
    const cwd = '/'
    if (!buf || size < BigInt(cwd.length + 1)) return -BigInt(ERRNO.EINVAL)
    this.mem.writeCString(buf, cwd)
    return BigInt(cwd.length + 1)
  }

  // ---- 调试

  /** 当前打开的文件表 */
  openFiles(): { fd: number; path: string; pos: number }[] {
    return [...this.fds.entries()]
      .map(([fd, f]) => ({ fd, path: f.path, pos: f.pos }))
      .sort((a, b) => a.fd - b.fd)
  }

  statsReport(): Record<string, number> {
    return Object.fromEntries([...this.stats.entries()].sort((a, b) => b[1] - a[1]))
  }
}

const O_ACCMODE = 0o3