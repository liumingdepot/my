// 确认 Unicorn 2.1 的 hook 能否触发（修正 uc_hook_add 参数顺序后）
import { loadUnicorn, REG, HOOK_TYPE, PROT } from '../server/hongguo/emu/unicorn.ts'
import { Memory } from '../server/hongguo/emu/memory.ts'

const api = loadUnicorn()
const h = api.open(2, 0)
const mem = new Memory(api, h)

const CODE = 0x100000n
mem.map(CODE, 0x1000n, PROT.READ | PROT.WRITE | PROT.EXEC)

// mov x0,#7 ; mov x1,#9 ; mov x0,#2 ; ret
const movz = (i, rd) => (0xd2800000 | ((i & 0xffff) << 5) | rd) >>> 0
const code = Buffer.alloc(16)
code.writeUInt32LE(movz(7, 0), 0)
code.writeUInt32LE(movz(9, 1), 4)
code.writeUInt32LE(movz(2, 0), 8)
code.writeUInt32LE(0xd65f03c0, 12)
mem.write(CODE, new Uint8Array(code))

let fired = 0
const seen = []
const codeHook = (u, address, size) => {
  fired++
  if (seen.length < 8) {
    seen.push(`0x${BigInt(address).toString(16)}(+${BigInt(address)-CODE}) size=${size} bytes=${Buffer.from(mem.read(BigInt(address), 4)).toString("hex")}`)
  }
  if (fired > 50) { console.log('hook 触发过多，判定为死循环'); process.exit(2) }
}

const native = api.makeCallback('code_fn', codeHook)
const rc = api.hookAdd(h, native, HOOK_TYPE.CODE, CODE, CODE + 16n)
console.log('uc_hook_add rc =', rc, rc ? api.strerror(rc) : 'ok')

// PC 从 CODE 开始，跑到 ret 之后
mem.setReg(REG.SP, mem.stackTop - 0x100n)
mem.setReg(REG.LR, CODE + 0x100n)
const r = api.emuStart(h, CODE, CODE + 12n, 0n, 0n)

console.log('emu_start rc =', r, r ? api.strerror(r) : 'ok')
console.log(`code hook 触发 ${fired} 次`)
for (const s of seen) console.log('   ', s)
console.log('x0 =', mem.x0, '(期望 2)')
api.close(h)
console.log(fired > 0 ? '\n✅ CODE hook 正常触发' : '\n❌ hook 仍未触发')
process.exit(fired > 0 ? 0 : 1)