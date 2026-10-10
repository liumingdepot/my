/**
 * ELF 装载器的自检 —— 验收标准是「只装载不执行」：
 *   libmetasec_ml.so 的 226 个未定义符号全部解析成功，重定位全部落地（skipped=0）。
 *
 * 这一步不需要 syscall / JNI，纯装载，所以可以独立验收。
 * 用法：node --experimental-strip-types scripts/hongguo-elf-loader-check.mjs
 */
import { readFileSync, existsSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { ElfLoader } from '../server/hongguo/emu/loader.ts'
import { parseElf } from '../server/hongguo/emu/elf.ts'
import { loadUnicorn } from '../server/hongguo/emu/unicorn.ts'

function workRoot() {
  const cands = [process.env.HG_WORK, join(process.cwd(), 'hongguo-work'), join(process.cwd(), '..', 'hongguo-work')].filter(Boolean)
  return cands.find((d) => existsSync(join(d, 'capture', 'fq_oversea', 'libmetasec_ml.so'))) ?? cands[1]
}
const WORK = workRoot()
const SYSROOT = join(WORK, 'emu', 'sysroot')

// 从 jar 里抽出 android/sdk23/lib64 的 sysroot（unidbg 就是用它当 bionic 根）
if (!existsSync(SYSROOT) || readdirSync(SYSROOT).length === 0) {
  mkdirSync(SYSROOT, { recursive: true })
  const { execFileSync } = await import('node:child_process')
  const jar = join(WORK, 'sign', 'unidbg-sign.jar')
  execFileSync('unzip', ['-o', '-q', '-j', jar, 'android/sdk23/lib64/*.so', '-d', SYSROOT], { stdio: 'inherit' })
  const meta = join(WORK, 'capture', 'fq_oversea', 'libmetasec_ml.so')
  if (!existsSync(join(SYSROOT, 'libmetasec_ml.so'))) copyFileSync(meta, join(SYSROOT, 'libmetasec_ml.so'))
}

const MAIN = 'libmetasec_ml.so'
const mainElf = parseElf(readFileSync(join(SYSROOT, MAIN)), MAIN)

/** 依赖闭包：只带 NEEDED 能满足的，避免把 libssl/libcrypto 这些无关的也拖进来 */
const entries = readdirSync(SYSROOT)
  .filter((f) => /\.so$/.test(f))
  .map((f) => {
    const p = join(SYSROOT, f)
    return { name: f, path: p, needed: parseElf(readFileSync(p), f).needed }
  })
  .filter((e) => e.name === MAIN || e.name === 'libc.so' || e.name === 'libm.so' ||
                  e.name === 'libdl.so' || e.name === 'liblog.so')

console.log(`装载集合: ${entries.map((e) => e.name).join(' ')}`)
console.log(`${MAIN} NEEDED: ${mainElf.needed.join(' ')}\n`)

const depsOf = (name) => entries.find((e) => e.name === name)?.needed ?? []
const missingDeps = new Set()
const order = ElfLoader.topoSort(
  entries.map(({ name, path }) => ({ name, path })),
  depsOf,
  (dep, by) => missingDeps.add(`${dep} (${by} 需要)`),
)

console.log('依赖排序（依赖在前）:')
for (const e of order) console.log(`  ${e.name}`)
if (missingDeps.size) {
  console.log(`\n⚠️ 缺失依赖，需要造桩:`)
  for (const m of missingDeps) console.log(`    ${m}`)
}

// ---- 真正装载
const uc = loadUnicorn()
const h = uc.open(2, 0)
const loader = new ElfLoader(uc, h)

// jar 里根本没有 libandroid.so，unidbg 靠 AndroidModule 提供桩；这里同样造桩
const ANDROID_STUBS = [
  'ALooper_forThread', 'ALooper_pollOnce', 'ALooper_prepare',
  'ASensorEventQueue_disableSensor', 'ASensorEventQueue_enableSensor', 'ASensorEventQueue_getEvents',
  'ASensorManager_createEventQueue', 'ASensorManager_destroyEventQueue',
  'ASensorManager_getDefaultSensor', 'ASensorManager_getInstance',
]
loader.addStubLib('libandroid.so', ANDROID_STUBS)

const t0 = Date.now()
for (const e of order) loader.load(e.path)
// 符号表建全之后再统一重定位（这批 so 有环状依赖，见 loader.ts 的说明）
loader.relocateAll()
for (const so of loader.loaded) {
  if (so.isStub) {
    console.log(`\n${so.name.padEnd(20)} 桩库 base=0x${so.base.toString(16)}`)
    continue
  }
  const st = so.relocStat
  console.log(
    `\n${so.name.padEnd(20)} base=0x${so.base.toString(16)}  跨度=0x${so.span.toString(16)}`,
    `\n  重定位 RELATIVE=${st.relative} JUMP_SLOT=${st.jumpSlot} GLOB_DAT=${st.globDat} ABS64=${st.abs64} 跳过=${st.skipped}`,
  )
  if (st.unresolved.length) console.log(`  未解析: ${st.unresolved.slice(0, 8).join(' ')}`)
}
console.log(`\n装载耗时 ${Date.now() - t0}ms`)

// ---- 验收
const unresolved = loader.unresolvedAll()
const total = loader.relocSummary()
console.log('\n=== 汇总 ===')
console.log(`  全局符号 ${loader.symbolCount} 个`)
console.log(`  重定位合计 RELATIVE=${total.relative} JUMP_SLOT=${total.jumpSlot} GLOB_DAT=${total.globDat} ABS64=${total.abs64} 跳过=${total.skipped}`)
console.log(`  未解析符号 ${unresolved.length} 个`)
for (const u of unresolved) console.log(`    ❌ ${u}`)

// 抽查几个关键符号的地址是否合理（落在某个已装载库的镜像范围内）
const probe = ['malloc', 'memcpy', '__android_log_print', 'JNI_OnLoad', 'printf', '__system_property_read']
console.log('\n=== 符号抽查 ===')
for (const s of probe) {
  const a = loader.lookup(s)
  if (a == null) { console.log(`  ${s.padEnd(24)} ❌ 未解析`); continue }
  const owner = loader.loaded.find((so) => a >= so.base && a < so.base + BigInt(so.span))
  console.log(`  ${s.padEnd(24)} 0x${a.toString(16).padStart(12)}  ← ${owner?.name ?? '??'}`)
}

// 回读校验：随机抽若干条重定位，确认目标地址里的值确实是算出来的那个
// （只看计数会漏掉「写了但没写进去」这种静默失败）
console.log('\n=== 回读校验（抽样 200 条重定位）===')
{
  const main = loader.loaded.find((s) => s.name === 'libmetasec_ml.so')
  const relocs = main.elf.relocations
  let checked = 0, bad = 0
  const readU64 = (addr) => Buffer.from(uc.memRead(h, addr, 8)).readBigUInt64LE()

  for (let i = 0; i < relocs.length && checked < 200; i++) {
    const r = relocs[i]
    const where = main.base + BigInt(r.offset)
    const got = readU64(where)
    if (r.type === 1027 /* RELATIVE */) {
      const want = main.base + r.addend
      if (got !== want) { if (bad++ < 3) console.log(`  ❌ RELATIVE @0x${where.toString(16)} 期望 0x${want.toString(16)} 实得 0x${got.toString(16)}`) }
      checked++
    } else if (r.type === 1025 || r.type === 1026 /* GLOB_DAT / JUMP_SLOT */) {
      const want = loader.lookup(main.elf.dynsym[r.sym]?.name)
      if (want != null && got !== want) { if (bad++ < 3) console.log(`  ❌ GOT @0x${where.toString(16)} 期望 0x${want.toString(16)} 实得 0x${got.toString(16)}`) }
      checked++
    }
  }
  const badTail = bad > 3 ? `（还有 ${bad - 3} 条）` : ''
  console.log(`  抽查 ${checked} 条，不符 ${bad} 条 ${badTail}`)
  if (bad === 0 && checked > 0) console.log('  ✅ 回读一致')
}

uc.close(h)

const ok = unresolved.length === 0 && total.skipped === 0
console.log(ok ? '\n✅ 只装载不执行：全部符号解析成功、重定位全部落地' : '\n❌ 有未完成项')
process.exit(ok ? 0 : 1)