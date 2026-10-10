/**
 * Unicorn Engine 的 koffi 绑定 —— 红果 metasec「去掉 JVM」方案的 CPU 模拟层。
 *
 * 只负责「跑 aarch64 指令」，不涉及 ELF 装载 / syscall / JNI，那三块在 elf.ts / syscall.ts / jni.ts。
 *
 * ## 为什么不用 unidbg-sign.jar 里自带的 unicorn
 *
 * jar 里有两份 unicorn，实测都**不能直接用**（别再在这上面浪费时间）：
 *
 * | 文件 | 实测结果 |
 * | --- | --- |
 * | `natives/<plat>/libunicorn.dylib` | C 和 Node 直接调都在 `uc_emu_start` 段错误 / SIGUSR1 |
 * | `natives/<plat>/libunicorn_java.dylib` | 不崩，但 `uc_reg_read` 对任何寄存器号都返回 0（等于残废） |
 *
 * 原因是 unidbg 的 `unicorn.Unicorn` 类**全部是 native 方法**，引擎只经
 * `Java_unicorn_Unicorn_*` 走 JNI 抵达；那两份 dylib 导出的 `uc_*` C 符号并不是
 * 可用的 C API。所以本项目改用**上游官方 Unicorn**（见 scripts/setup-hongguo-unicorn.sh）。
 *
 * 好消息：官方版的寄存器编号与 unidbg 的 `unicorn.Arm64Const` **完全一致**
 * （X0=199 … X8=207 … PC=260），所以 `scripts/hongguo-trace/` 抓出来的
 * syscall 清单可以直接当验收标准。
 */

import { createRequire } from 'node:module'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

// ---------------------------------------------------------------- 常量

/** aarch64 通用寄存器编号（unicorn/include/unicorn/arm64.h，与 unidbg Arm64Const 一致） */
export const REG = {
  X0: 199, X1: 200, X2: 201, X3: 202, X4: 203, X5: 204, X6: 205, X7: 206,
  X8: 207, X9: 208, X10: 209, X11: 210, X12: 211, X13: 212, X14: 213, X15: 214,
  X16: 215, X17: 216, X18: 217, X19: 218, X20: 219, X21: 220, X22: 221, X23: 222,
  X24: 223, X25: 224, X26: 225, X27: 226, X28: 227,
  X29: 1, X30: 2,
  LR: 2, /** = X30 */
  SP: 4, PC: 260, NZCV: 3,
} as const

/** 系统调用号寄存器（Linux aarch64 ABI 规定放在 x8） */
export const REG_SYSCALL_NR = REG.X8

export const UC_ARCH_ARM64 = 2
export const UC_MODE_ARM = 0

export const PROT = { NONE: 0, READ: 1, WRITE: 2, EXEC: 4, ALL: 7 } as const

export const HOOK_TYPE = {
  INTR: 1 << 0,
  INSN: 1 << 1,
  CODE: 1 << 2,
  BLOCK: 1 << 3,
  MEM_READ_UNMAPPED: 1 << 4,
  MEM_WRITE_UNMAPPED: 1 << 5,
  MEM_FETCH_UNMAPPED: 1 << 6,
  MEM_READ_PROT: 1 << 7,
  MEM_WRITE_PROT: 1 << 8,
  MEM_FETCH_PROT: 1 << 9,
  MEM_READ: 1 << 10,
  MEM_WRITE: 1 << 11,
  MEM_FETCH: 1 << 12,
} as const

export const ERR = {
  OK: 0, NOMEM: 1, ARCH: 2, HANDLE: 3, MODE: 4, VERSION: 5, READ_UNMAPPED: 6,
  WRITE_UNMAPPED: 7, FETCH_UNMAPPED: 8, HOOK: 9, INSN_INVALID: 10, MAP: 11,
  WRITE_PROT: 12, READ_PROT: 13, FETCH_PROT: 14, ARG: 15, READ_UNALIGNED: 16,
  WRITE_UNALIGNED: 17, FETCH_UNALIGNED: 18, HOOK_EXIST: 19, RESOURCE: 20,
  EXCEPTION: 21,
} as const

// ---------------------------------------------------------------- 动态库定位

/** 进程架构 → 官方 release 的平台/架构组合 */
function platformTag(): string {
  const p = process.platform
  const a = process.arch
  if (p === 'darwin') return a === 'arm64' ? 'macos-arm64' : 'macos-x64'
  if (p === 'win32') return 'windows-msvc64'
  if (p === 'linux') return a === 'arm64' ? 'ubuntu-aarch64' : 'ubuntu-x86_64'
  return `${p}-${a}`
}

const LIB_NAME: Record<string, string> = {
  darwin: 'libunicorn.dylib',
  win32: 'libunicorn.dll',
  linux: 'libunicorn.so',
}

/**
 * 找 libunicorn。查找顺序：
 *   HG_UNICORN  → hongguo-work/emu/unicorn/lib/ → 模块邻近目录 → ~/hongguo-work/emu/unicorn/lib/
 * 都没找到就抛错，提示跑 scripts/setup-hongguo-unicorn.sh。
 */
export function resolveUnicornLib(): string {
  const name = LIB_NAME[process.platform]
  if (!name) throw new Error(`暂不支持的平台：${process.platform}`)

  const roots: string[] = []
  // HG_UNICORN 可以直接给到文件本身
  if (process.env.HG_UNICORN) {
    if (existsSync(process.env.HG_UNICORN) && !isDir(process.env.HG_UNICORN)) {
      return process.env.HG_UNICORN
    }
    roots.push(process.env.HG_UNICORN)
  }
  roots.push(join(process.cwd(), 'hongguo-work', 'emu', 'unicorn', 'lib'))
  try {
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 6; i++) {
      roots.push(join(dir, 'hongguo-work', 'emu', 'unicorn', 'lib'))
      dir = dirname(dir)
    }
  } catch {
    /* ignore */
  }
  roots.push(join(homedir(), 'hongguo-work', 'emu', 'unicorn', 'lib'))

  for (const dir of roots) {
    if (!isDir(dir)) continue
    const direct = join(dir, name)
    if (existsSync(direct)) return direct
    // 版本化的文件名 libunicorn.2.dylib 也认
    const ext = name.split('.').pop()!
    let hit: string | undefined
    try {
      hit = readdirSync(dir).find((f) => f.startsWith('libunicorn') && f.endsWith(`.${ext}`))
    } catch {
      /* ignore */
    }
    if (hit) return join(dir, hit)
  }
  throw new Error(
    `未找到 libunicorn（${platformTag()}）。跑 bash scripts/setup-hongguo-unicorn.sh 下载官方 Unicorn，或设 HG_UNICORN 指向 .so/.dylib`,
  )
}

// ---------------------------------------------------------------- 绑定

/** 已加载的原生函数表 */
export type UnicornApi = {
  readonly lib: string
  readonly version: number
  open(arch: number, mode: number): any
  close(uc: any): number
  memMap(uc: any, addr: bigint, size: bigint, perms: number): number
  memProtect(uc: any, addr: bigint, size: bigint, perms: number): number
  memUnmap(uc: any, addr: bigint, size: bigint): number
  memWrite(uc: any, addr: bigint, bytes: Uint8Array): number
  memRead(uc: any, addr: bigint, len: number): Uint8Array
  emuStart(uc: any, begin: bigint, until: bigint, timeout: bigint, count: bigint): number
  emuStop(uc: any): number
  regRead(uc: any, id: number): bigint
  regWrite(uc: any, id: number, value: bigint): number
  /**
   * 注册 hook 回调。
   *
   * ⚠️ 不能直接把 JS 函数传给 hookAdd：koffi 的 trampoline 只在 FFI 调用期间有效，
   *    而 Unicorn 是之后才回调它，会抛 "Cannot use non-registered callback beyond FFI call"。
   *    必须先用 makeCallback() 做 koffi.register()，再把返回的指针传进来。
   */
  hookAdd(uc: any, callback: any, type: number, begin?: bigint, end?: bigint): number
  /**
   * 造一个**持久**回调指针：`koffi.register(jsFn, '类型名 *')`。
   * 全局上限 8192 个，用完记得 releaseCallback。
   */
  makeCallback(typeName: string, fn: (...a: any[]) => void): unknown
  releaseCallback(handle: unknown): void
  hookDel(uc: any, hook: any): number
  errno(uc: any): number
  strerror(rc: number): string
}

let api: UnicornApi | null = null

/**
 * 加载并绑定 libunicorn。
 *
 * ⚠️ **绑定顺序有坑**：`uc_version` 必须在 `uc_open` 之前绑定并调用一次，
 * 否则整个 Node 进程会被 SIGUSR1 杀掉（koffi 的符号绑定顺序问题，与参数名无关）。
 * 这里先把 version 取出来再绑别的，就是为了避开它。
 */
export function loadUnicorn(): UnicornApi {
  if (api) return api
  const koffi: any = require('koffi')
  const lib = resolveUnicornLib()
  const U = koffi.load(lib)

  // 必须第一个绑定
  const version = U.func('uint32_t uc_version()')()

  const uc_p = koffi.pointer('void')
  const slot = Buffer.alloc(8)

  const fOpen = U.func('int uc_open(int arch, int mode, void **result)')
  const fClose = U.func('int uc_close(void *uc)')
  const fMap = U.func('int uc_mem_map(void *uc, uint64_t address, size_t size, uint32_t perms)')
  const fProtect = U.func('int uc_mem_protect(void *uc, uint64_t address, size_t size, uint32_t perms)')
  const fUnmap = U.func('int uc_mem_unmap(void *uc, uint64_t address, size_t size)')
  const fWrite = U.func('int uc_mem_write(void *uc, uint64_t address, const void *bytes, size_t len)')
  const fRead = U.func('int uc_mem_read(void *uc, uint64_t address, void *bytes, size_t len)')
  const fStart = U.func('int uc_emu_start(void *uc, uint64_t begin, uint64_t until, uint64_t timeout, size_t count)')
  const fStop = U.func('int uc_emu_stop(void *uc)')
  const fRegRead = U.func('int uc_reg_read(void *uc, int regid, void *value)')
  const fRegWrite = U.func('int uc_reg_write(void *uc, int regid, const void *value)')
  const fErrno = U.func('int uc_errno(void *uc)')
  const fStrerror = U.func('const char *uc_strerror(int)')
  // ⚠️⚠️ Unicorn **2.1 改了 uc_hook_add 的参数顺序**：type 是第 3 个参数，
// 而且结尾是可变参数。1.x 的 `(uc, hh, callback, user_data, begin, end, type)`
// 会「注册成功但永不触发」—— 极难查，因为返回值一直是 UC_ERR_OK。
// 正确签名见 unicorn.h:1088。改动前务必对着目标版本的 unicorn.h 核一遍。
koffi.proto('void intr_fn(void *uc, uint32_t intno, void *user)')
koffi.proto('void code_fn(void *uc, uint64_t address, uint32_t size, void *user)')
const fHookAddIntr = U.func(
    'int uc_hook_add(void *uc, void *hh, int type, intr_fn *cb, void *ud, uint64_t begin, uint64_t end, ...)',
  )
const fHookAddCode = U.func(
    'int uc_hook_add(void *uc, void *hh, int type, code_fn *cb, void *ud, uint64_t begin, uint64_t end, ...)',
  )
  const fHookDel = U.func('int uc_hook_del(void *uc, void *hh)')

  const buf8 = () => Buffer.alloc(8)

  api = {
    lib,
    version,
    open(arch, mode) {
      slot.fill(0)
      const rc = fOpen(arch, mode, slot)
      if (rc !== ERR.OK) throw new Error(`uc_open: rc=${rc} ${fStrerror(rc)}`)
      return koffi.decode(slot, uc_p)
    },
    close: (uc) => fClose(uc),
    memMap: (uc, addr, size, perms) => fMap(uc, addr, size, perms),
    memProtect: (uc, addr, size, perms) => fProtect(uc, addr, size, perms),
    memUnmap: (uc, addr, size) => fUnmap(uc, addr, size),
    memWrite(uc, addr, bytes) {
      return fWrite(uc, addr, bytes, bytes.length)
    },
    memRead(uc, addr, len) {
      const b = Buffer.alloc(len)
      const rc = fRead(uc, addr, b, len)
      if (rc !== ERR.OK) throw new Error(`uc_mem_read @0x${addr.toString(16)}: rc=${rc} ${fStrerror(rc)}`)
      return new Uint8Array(b)
    },
    emuStart: (uc, begin, until, timeout, count) =>
      fStart(uc, begin, until, timeout, count),
    emuStop: (uc) => fStop(uc),
    regRead(uc, id) {
      const b = buf8()
      const rc = fRegRead(uc, id, b)
      if (rc !== ERR.OK) throw new Error(`uc_reg_read(${id}): rc=${rc} ${fStrerror(rc)}`)
      return b.readBigUInt64LE()
    },
    regWrite(uc, id, value) {
      const b = buf8()
      b.writeBigUInt64LE(value)
      return fRegWrite(uc, id, b)
    },
        hookAdd(uc, cb, type, begin = 0n, end = 0n) {
      const slot = Buffer.alloc(8)
      // Unicorn 2.1：type 是第 3 个参数
      return type === HOOK_TYPE.CODE || type === HOOK_TYPE.BLOCK
        ? fHookAddCode(uc, slot, type, cb, 0n, begin, end)
        : fHookAddIntr(uc, slot, type, cb, 0n, begin, end)
    },
    makeCallback: (typeName, fn) => koffi.register(fn, `${typeName} *`),
    releaseCallback: (handle) => koffi.unregister(handle),
    hookDel: (uc, hook) => fHookDel(uc, hook),
    errno: (uc) => fErrno(uc),
    strerror: (rc) => fStrerror(rc) ?? `rc=${rc}`,
  }
  return api
}

export function unicornInfo(): { lib: string; version: number; platform: string } {
  const a = loadUnicorn()
  return { lib: a.lib, version: a.version, platform: platformTag() }
}

export { platformTag, delimiter }