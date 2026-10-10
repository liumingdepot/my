// syscall 层的成败关键：Unicorn 的 UC_HOOK_INTR 能不能接管 SVC 的返回值。
// 测试程序： svc #0 ; ret     （LR 指向 EXIT 的 ret）
// 若 hook 生效，最终 x0 应是 hook 里写的 x8*2；否则 SVC 抛 UC_ERR_EXCEPTION 当场返回。
import fs from 'node:fs'
import { loadUnicorn, REG, HOOK_TYPE, PROT } from '../server/hongguo/emu/unicorn.ts'
import { Memory } from '../server/hongguo/emu/memory.ts'

const say = (s) => fs.writeSync(1, String(s) + '\n')

say('P1 loadUnicorn')
const api = loadUnicorn()
say('P2 api ok')
const h = api.open(2, 0)
say('P3 engine ok')
const mem = new Memory(api, h)
say('P4 memory ok')

const CODE = 0x100000n
const EXIT = 0x101000n
const SVC_NR = 1234n

mem.map(CODE, 0x1000n, PROT.READ | PROT.WRITE | PROT.EXEC)
mem.map(EXIT, 0x1000n, PROT.READ | PROT.WRITE | PROT.EXEC)

// 关键：until 必须正好等于 LR。
// LR 指向的地址里放着 ret，而 until 若设在它之后，PC 停在那条 ret 之前不算停止，
// 于是 ret 跳回 LR 自己 —— 死循环，且 INTR hook 早已触发过，看着就像「卡住」。
const code = Buffer.alloc(8)
code.writeUInt32LE(0xd4000001, 0) // svc #0
// hook 不触发时 SVC 会直接抛 UC_ERR_EXCEPTION，emu_start 当场返回，
// 所以后面只能放 ret，不能再插一条会被跳过的算术指令（会把期望值算错）。
code.writeUInt32LE(0xd65f03c0, 4) // ret
mem.write(CODE, new Uint8Array(code))
mem.write(EXIT, Uint8Array.from(Buffer.from([0xc0, 0x03, 0x5f, 0xd6])))
say('P5 code written')

let fired = 0
const svcHook = (ucHandle, intno) => {
  fired++
  if (fired > 10) { fs.writeSync(2, 'hook 触发过多，疑似死循环\n'); process.exit(2) }
  const x8 = mem.x8
  say(`  INTR hook #${fired} intno=${intno} x8=${x8}`)
  mem.x0 = x8 * 2n
}

say('P6 before makeCallback')
const ptr = api.makeCallback('intr_fn', svcHook)
say('P7 after makeCallback')

const rc = api.hookAdd(h, ptr, HOOK_TYPE.INTR, 1n, 0n)
say(`P8 hookAdd rc=${rc} ${rc ? api.strerror(rc) : 'ok'}`)

mem.setReg(REG.SP, mem.stackTop - 0x100n)
mem.setReg(REG.LR, EXIT)
mem.setReg(REG.X8, SVC_NR)
mem.x0 = 0xdeadn
say('P9 regs set')

// svc → INTR hook 写 x0 → ret 跳到 EXIT → PC == until，停
const r = api.emuStart(h, CODE, EXIT, 0n, 0n)
say(`P10 emuStart rc=${r} ${r ? api.strerror(r) : 'ok'}`)
say(`INTR 触发 ${fired} 次，最终 x0=${mem.x0}（期望 ${SVC_NR * 2n}）`)

// 断言必须在 close 之前做完。uc_close 释放了引擎实例，
// 此后再 uc_reg_read 就是一个悬垂句柄上的读 —— 不报错，进程直接静默死掉，
// 表现就是「所有输出都打完了但拿不到退出码」。
const ok = fired === 1 && mem.x0 === SVC_NR * 2n

api.close(h)
say(ok ? '✅ SVC/INTR hook 可接管返回值 → syscall 层可行' : '❌ SVC 方案不通')
process.exit(ok ? 0 : 1)