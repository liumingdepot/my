/**
 * emu 层的冒烟测试：验证 Node → koffi → 官方 Unicorn → ARM64 闭环。
 *
 * 同时是一个「写这层时的三个坑」的活文档：
 *   1. 寄存器号不是 0..31，X0=199、X8=207、PC=260
 *   2. MOVZ 的 imm16 在 bit20:5，编码是 0xd2800000 | (imm16<<5) | Rd
 *   3. koffi 必须先绑定 uc_version，否则后面调 uc_open 会 SIGUSR1
 *
 * 用法：node scripts/hongguo-emu-smoke.mjs
 */
import { loadUnicorn, REG, PROT, unicornInfo } from '../server/hongguo/emu/unicorn.ts'

/** MOVZ Xd, #imm → 0xd2800000 | (imm16 << 5) | Rd */
const movz = (imm, rd) => (0xd2800000 | ((imm & 0xffff) << 5) | rd) >>> 0
const insn = (...words) => {
  const b = Buffer.alloc(words.length * 4)
  words.forEach((w, i) => b.writeUInt32LE(w >>> 0, i * 4))
  return new Uint8Array(b)
}

const info = unicornInfo()
console.log(`libunicorn  ${info.lib}`)
console.log(`version     ${info.version}   platform ${info.platform}`)

const uc = loadUnicorn()
const h = uc.open(2 /* ARM64 */, 0)

const CODE = 0x1000n
const STACK = 0x200000n
const code = insn(movz(7, 0), movz(9, 1), movz(2, 0), 0xd65f03c0 /* ret */)

uc.memMap(h, CODE, 0x1000n, PROT.ALL)
uc.memWrite(h, CODE, code)
uc.regWrite(h, REG.SP, STACK)

const rc = uc.emuStart(h, CODE, CODE + 12n, 0n, 0n) // 停在 ret 之前
if (rc !== 0) throw new Error(`emu_start rc=${rc} ${uc.strerror(rc)}`)

const x0 = uc.regRead(h, REG.X0)
const x1 = uc.regRead(h, REG.X1)
const pc = uc.regRead(h, REG.PC)

console.log(`x0 = ${x0}   (末条 mov x0,#2 → 期望 2)`)
console.log(`x1 = ${x1}   (mov x1,#9 → 期望 9)`)
console.log(`pc = 0x${pc.toString(16)}   (期望 0x100c)`)

uc.memProtect(h, CODE, 0x1000n, PROT.READ | PROT.EXEC)
const back = uc.memRead(h, CODE, 16)
console.log(`mem_read  ${Buffer.from(back).toString('hex')}`)

uc.close(h)

const ok = x0 === 2n && x1 === 9n && pc === 0x100cn
console.log(ok ? '\n✅ emu 层可用' : '\n❌ emu 层有问题')
process.exit(ok ? 0 : 1)