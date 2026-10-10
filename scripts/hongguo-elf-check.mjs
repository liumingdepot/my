/**
 * ELF 解析器的自检：拿 hongguo-work 里的真实工件跑一遍，
 * 输出要和 scripts/hongguo-trace/reloinfo.py 的统计对得上。
 *
 * 用法：node --experimental-strip-types scripts/hongguo-elf-check.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseElf, PT, R_AARCH64_NAME, STB, SHN, PF } from '../server/hongguo/emu/elf.ts'

function workRoot() {
  const cands = [
    process.env.HG_WORK,
    join(process.cwd(), 'hongguo-work'),
    join(process.cwd(), '..', 'hongguo-work'),
  ].filter(Boolean)
  return cands.find((d) => existsSync(join(d, 'capture', 'fq_oversea', 'libmetasec_ml.so'))) ?? cands[1]
}

const WORK = workRoot()
const SYSROOT = join(WORK, 'emu', 'sysroot')
const files = [
  join(WORK, 'capture', 'fq_oversea', 'libmetasec_ml.so'),
  ...(existsSync(SYSROOT)
    ? readdirSync(SYSROOT)
        .filter((f) => /\.(so|dylib)$/.test(f))
        .sort()
        .map((f) => join(SYSROOT, f))
    : []),
]

if (!files.length) {
  console.error(`✗ 找不到工件。先跑：bash scripts/setup-hongguo-sign.sh`)
  process.exit(1)
}

const relocTotals = new Map()
let bad = 0

for (const path of files) {
  const name = path.split('/').pop()
  const elf = parseElf(readFileSync(path), name)
  const loads = elf.segments.filter((s) => s.type === PT.LOAD)
  const perm = (n, bit) => (loads.some((s) => s.flags & bit) ? n : '')

  const counts = new Map()
  for (const r of elf.relocations) {
    const k = R_AARCH64_NAME[r.type] ?? `?${r.type}`
    counts.set(k, (counts.get(k) ?? 0) + 1)
    relocTotals.set(k, (relocTotals.get(k) ?? 0) + 1)
  }

  const undef = [...new Set(
    elf.dynsym
      .filter((s) => s.shndx === SHN.UNDEF && s.name && s.bind === STB.GLOBAL)
      .map((s) => s.name),
  )]

  console.log(`\n### ${name}  (${(readFileSync(path).length / 1024).toFixed(0)}KB, 跨度 0x${elf.span.toString(16)})`)
  console.log(`  PT_LOAD x${loads.length}  [${perm('R', PF.R)}${perm('W', PF.W)}${perm('X', PF.X)}]  ` +
    `init_array=${elf.initArray.length}  TLS=${elf.hasTls ? '有' : '无'}`)
  console.log(`  NEEDED: ${elf.needed.join(' ') || '（无）'}`)
  console.log(`  导出符号 ${elf.symbols.size}   未定义(仅 GLOBAL) ${undef.length}`)
  console.log(`  重定位 ${JSON.stringify(Object.fromEntries(counts))}`)

  // 基本自洽性检查
  const problems = []
  if (!loads.length) problems.push('没有 PT_LOAD')
  for (const s of elf.relocations) {
    if (!(s.type in R_AARCH64_NAME)) problems.push(`未知重定位类型 ${s.type}`)
    if (s.sym > 0 && s.sym >= elf.dynsym.length) problems.push(`重定位符号索引越界 ${s.sym}`)
  }
  if (elf.initArray.length && elf.segments.every((s) => s.type !== PT.TLS) === false && elf.hasTls === false) {
    problems.push('有 TLS 段但 hasTls=false')
  }
  if (problems.length) {
    bad++
    console.log(`  ⚠️ ${problems.slice(0, 5).join(' / ')}`)
  }
}

console.log('\n=== 重定位类型汇总 ===')
for (const [k, v] of [...relocTotals].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(12)} ${v}`)
console.log(bad ? `\n❌ ${bad} 个文件有问题` : '\n✅ 全部解析通过')
process.exit(bad ? 1 : 0)