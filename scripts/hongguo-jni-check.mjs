/**
 * JNI 层自检 —— 两件事：
 *   1. **槽位对表**：把 jni.ts 的 SLOT 常量与 scripts/hongguo-trace/jnilayout.py
 *      从 jni.h 抽出的权威布局逐条比对。JNI 全靠函数表下标间接调用，
 *      下标错一位是**静默失败**（不报错，只是行为诡异），所以必须机检。
 *   2. **14 个函数跑通**：造一段假的 metasec 调用序列，验证返回值正确。
 *
 * 用法：node --experimental-strip-types scripts/hongguo-jni-check.mjs
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { join } from 'node:path'

import { SLOT, JniEnv, makeFqHandler, MS_OP } from '../server/hongguo/emu/jni.ts'
import { loadUnicorn, PROT } from '../server/hongguo/emu/unicorn.ts'
import { Memory } from '../server/hongguo/emu/memory.ts'

const ROOT = process.cwd()
const say = (s) => fs.writeSync(1, String(s) + '\n')
let failed = 0

// ================================================================ 1. 槽位对表

say('=== 1. JNIEnv 槽位对表（权威口径：jni.h 的 C 布局）===')
const JNI_H =
  process.env.JNI_H ??
  join(ROOT, 'hongguo-work', 'jdk17', 'Contents', 'Home', 'include', 'jni.h')

if (!fs.existsSync(JNI_H)) {
  say(`  ⚠️ 找不到 ${JNI_H}，跳过槽位对表`)
} else {
  const out = execFileSync(
    'python3',
    [join(ROOT, 'scripts', 'hongguo-trace', 'jnilayout.py'), JNI_H],
    { encoding: 'utf8' },
  )
  const truth = new Map()
  for (const line of out.split('\n')) {
    const m = line.match(/^(\d+)\t(\w+)$/)
    if (m) truth.set(m[2], Number(m[1]))
  }

  // 反向也要查：SLOT 里不能有不存在的名字
  const names = Object.keys(SLOT)
  let bad = 0
  for (const n of names) {
    const got = SLOT[n]
    const want = truth.get(n)
    if (want === undefined) {
      say(`  ❌ ${n.padEnd(24)} jni.h 里没有这个成员`)
      bad++
      continue
    }
    const okSlot = got === want
    say(`  ${okSlot ? '✅' : '❌'} ${n.padEnd(24)} SLOT=${String(got).padStart(3)}  jni.h=${String(want).padStart(3)}`)
    if (!okSlot) bad++
  }
  say(`  共 ${names.length} 条，不符 ${bad} 条`)
  if (bad > 0) failed++
  if (bad === 0) say('  ✅ 槽位与 jni.h 完全一致')

  // 顺带把 trace 里用到的 14 个函数都核一遍（防止漏实现）
  say('\n=== 2. trace 用到的 14 个 JNI 函数槽位 ===')
  const NEEDED = [
    'FindClass', 'GetSuperclass', 'RegisterNatives',
    'GetStaticMethodID', 'GetMethodID',
    'CallStaticObjectMethodV', 'CallObjectMethodV', 'CallLongMethodV',
    'NewStringUTF', 'GetStringUTFChars', 'ReleaseStringUTFChars',
    'GetArrayLength', 'GetByteArrayRegion', 'GetObjectArrayElement',
  ]
  let miss = 0
  for (const f of NEEDED) {
    const idx = truth.get(f)
    const declared = SLOT[f]
    const mark = idx === undefined ? '❌ jni.h 无此函数' : declared === undefined ? '⚠️ 未在 SLOT 声明' : declared === idx ? '✅' : '❌ 不一致'
    if (mark.startsWith('❌') || mark.startsWith('⚠️')) miss++
    say(`  ${mark} ${f.padEnd(24)} jni.h=${idx === undefined ? '?' : idx}  SLOT=${declared ?? '未声明'}`)
  }
  if (miss > 0) failed++
  else say('  ✅ 14 个函数全部声明且索引正确')
}

// ================================================================ 3. 行为自检

say('\n=== 3. 14 个函数的返回值自检 ===')
const api = loadUnicorn()
const h = api.open(2, 0)
const mem = new Memory(api, h)

// ---- 各缓冲区都要先映射：jni.ts 会直接往这些地址读写，没映射会抛
//      UC_ERR_READ_UNMAPPED（表现为「跑到一半炸掉」，很容易误判成 JNI 实现有问题）
const SCRATCH = 0x500000n
mem.map(SCRATCH, 0x10000n, PROT.READ | PROT.WRITE)
const vaBuf = 0x600000n
mem.map(vaBuf, 0x1000n, PROT.READ | PROT.WRITE)

const cert = Buffer.from('FAKE-APK-CERT-BYTES')
const env = new JniEnv(mem, {
  handler: makeFqHandler({
    filesDir: '/data/user/0/com.dragon.read.oversea.gp/files',
    cert,
  }),
})

const ENV = 0x1000n
const checks = []
const check = (name, got, want) => {
  const ok = String(got) === String(want)
  checks.push(ok)
  say(`  ${ok ? '✅' : '❌'} ${name.padEnd(34)} 实得 ${String(got).slice(0, 60)}`)
  if (!ok) say(`      期望 ${String(want).slice(0, 60)}`)
}

// -- FindClass / GetSuperClass
const ptr = (s) => {
  const p = SCRATCH + BigInt(writeStr(s))
  return p
}
let scratchOff = 0
function writeStr(s) {
  const p = scratchOff
  scratchOff += Buffer.byteLength(s, 'utf8') + 1 + (8 - ((Buffer.byteLength(s, 'utf8') + 1) % 8 || 8))
  const b = Buffer.from(s, 'utf8')
  const out = Buffer.alloc(b.length + 1)
  b.copy(out)
  mem.write(SCRATCH + BigInt(p), new Uint8Array(out))
  return p
}

const msClass = env.findClass(ENV, ptr('com/bytedance/mobsec/metasec/ml/MS'))
check('FindClass(MS) 非 0', msClass !== 0n, true)
const superCls = env.getSuperClass(ENV, msClass)
check('GetSuperClass(MS) 非 0', superCls !== 0n, true)
const unknown = env.findClass(ENV, ptr('no/such/Class'))
check('FindClass(未知类)=0', unknown, 0n)

// -- GetStaticMethodID / GetMethodID
const bSig = ptr('(IIJLjava/lang/String;Ljava/lang/Object;)Ljava/lang/Object;')
const methodB = env.getStaticMethodID(ENV, msClass, ptr('b'), bSig)
check('GetStaticMethodID(MS.b) 非 0', methodB !== 0n, true)

// -- CallStaticObjectMethodV: MS.b 的各个 op
const vaOf = (op) => {
  mem.writeU32(vaBuf, op >>> 0)
  return vaBuf
}
const r1 = env.callStaticObjectMethodV(ENV, msClass, methodB, vaOf(MS_OP.MSDATA_PATH))
check('MS.b(0x10003) = .msdata 路径', env.get(r1)?.value, '/data/user/0/com.dragon.read.oversea.gp/files/.msdata')
const r2 = env.callStaticObjectMethodV(ENV, msClass, methodB, vaOf(MS_OP.FLAG_1))
check('MS.b(0x2000001) = true', env.get(r2)?.value, true)
const r3 = env.callStaticObjectMethodV(ENV, msClass, methodB, vaOf(MS_OP.VERSION_CODE_OBJ))
check('MS.b(0x1000010) = Integer(68132)', env.get(r3)?.value, 68132)
const r4 = env.callStaticObjectMethodV(ENV, msClass, methodB, vaOf(MS_OP.VERSION_NAME))
check('MS.b(0x1000011) = "6.8.1.32"', env.get(r4)?.value, '6.8.1.32')
const r5 = env.callStaticObjectMethodV(ENV, msClass, methodB, vaOf(MS_OP.APK_CERT))
check('MS.b(0x1000012) = 证书字节', env.get(r5)?.value?.length, cert.length)
const r6 = env.callStaticObjectMethodV(ENV, msClass, methodB, vaOf(MS_OP.NOW))
check('MS.b(0x100000e) = Long(毫秒)', typeof env.get(r6)?.value, 'bigint')

// -- Thread.currentThread / getStackTrace / GetObjectArrayElement
const curThread = env.callStaticObjectMethodV(ENV, env.findClass(ENV, ptr('java/lang/Thread')), env.getStaticMethodID(ENV, env.findClass(ENV, ptr('java/lang/Thread')), ptr('currentThread'), ptr('()Ljava/lang/Thread;')), 0n)
check('Thread.currentThread() 非 0', curThread !== 0n, true)
const stackArr = env.callObjectMethodV(ENV, curThread, env.getMethodID(ENV, 0n, ptr('getStackTrace'), ptr('()[Ljava/lang/StackTraceElement;')), 0n)
const frames = env.get(stackArr)
check('getStackTrace() 返回数组', frames?.kind, 'array')
check('getArrayLength(栈帧)', env.getArrayLength(ENV, stackArr), BigInt(frames?.items.length ?? 0))
const frame0 = env.getObjectArrayElement(ENV, stackArr, 0)
check('GetObjectArrayElement([0]) 非 0', frame0 !== 0n, true)

// -- StackTraceElement.getClassName / getMethodName
const steClass = env.findClass(ENV, ptr('java/lang/StackTraceElement'))
const gcn = env.getMethodID(ENV, steClass, ptr('getClassName'), ptr('()Ljava/lang/String;'))
const gmn = env.getMethodID(ENV, steClass, ptr('getMethodName'), ptr('()Ljava/lang/String;'))
const nameRef = env.callObjectMethodV(ENV, frame0, gcn, 0n)
check('getClassName() 返回字符串', env.get(nameRef)?.kind, 'string')
const methodRef = env.callObjectMethodV(ENV, frame0, gmn, 0n)
check('getMethodName() 返回字符串', env.get(methodRef)?.kind, 'string')

// -- GetStringUTFChars / ReleaseStringUTFChars
const utfBuf = 0x700000n
const charsPtr = env.getStringUTFChars(ENV, nameRef, utfBuf)
check('GetStringUTFChars 写 isCopy=1', mem.readU8(utfBuf), 1)
check('GetStringUTFChars 内容回读', mem.readCString(charsPtr), env.get(nameRef)?.value)
check('ReleaseStringUTFChars 返回 0', env.releaseStringUTFChars(ENV, nameRef, charsPtr), 0n)

// -- NewStringUTF
const ns = env.newStringUTF(ENV, ptr('utf-8'))
check('NewStringUTF("utf-8")', env.get(ns)?.value, 'utf-8')

// -- String.getBytes
const gb = env.getMethodID(ENV, env.findClass(ENV, ptr('java/lang/String')), ptr('getBytes'), ptr('(Ljava/lang/String;)[B'))
const bytesRef = env.callObjectMethodV(ENV, nameRef, gb, vaBuf)
check('String.getBytes 返回 byte[]', env.get(bytesRef)?.kind, 'bytes')

// -- GetArrayLength / GetByteArrayRegion
const byteLen = env.getArrayLength(ENV, bytesRef)
check('GetArrayLength(byte[]) 与实际一致', byteLen, BigInt(env.get(bytesRef)?.value.length ?? -1))
const outBuf = 0x800000n
mem.map(outBuf, 0x1000n, PROT.READ | PROT.WRITE)
const blen = Number(byteLen)
check('GetByteArrayRegion 返回 0', env.getByteArrayRegion(ENV, bytesRef, 0, blen, outBuf), 0n)
const readBack = Buffer.from(mem.read(outBuf, blen))
const expect = env.get(bytesRef)?.value ?? Buffer.alloc(0)
check('GetByteArrayRegion 内容逐字节一致', readBack.equals(expect.subarray(0, blen)), true)

// -- Long.longValue
const longClass = env.findClass(ENV, ptr('java/lang/Long'))
const lv = env.getMethodID(ENV, longClass, ptr('longValue'), ptr('()J'))
check('Long.longValue() 回读一致', env.callLongMethodV(ENV, r6, lv, 0n), env.get(r6)?.value)

// -- GetStaticIntField
const fbuf = 0x900000n
mem.map(fbuf, 0x1000n, PROT.READ | PROT.WRITE)
check('GetStaticIntField(MS.a) 返回 0', env.getStaticIntField(ENV, msClass, 0x1234n, fbuf), 0n)
check('MS.a() 写入 0x40', mem.readU32(fbuf), 0x40)

// -- RegisterNatives
const mArr = 0xa00000n
mem.map(mArr, 0x1000n, PROT.READ | PROT.WRITE)
const nm = ptr('a')
const nsig = ptr('(IIJLjava/lang/String;Ljava/lang/Object;)Ljava/lang/Object;')
mem.writeU64(mArr, SCRATCH + BigInt(nm))
mem.writeU64(mArr + 8n, SCRATCH + BigInt(nsig))
mem.writeU64(mArr + 16n, 0x1234ed0n)
check('RegisterNatives 返回 0', env.registerNatives(ENV, msClass, mArr, 1), 0n)
check('RegisterNatives 记录了 1 条', env.registeredNatives.length, 1)
check('RegisterNatives 名字正确', env.registeredNatives[0]?.name, 'a')

const passed = checks.filter(Boolean).length
say(`\n  行为断言 ${passed}/${checks.length} 通过`)
if (passed !== checks.length) failed++

say('\n=== JNI 统计 ===')
for (const [k, v] of Object.entries(env.statsReport())) say(`  ${k.padEnd(26)} ${v}`)

// ⚠️ 断言全部做完再关引擎；close 之后读寄存器会让进程静默死掉
api.close(h)

if (failed === 0) {
  say('\n✅ JNI 层：槽位与 jni.h 一致，14 个函数行为正确')
  process.exit(0)
} else {
  say(`\n❌ 有 ${failed} 组检查未通过`)
  process.exit(1)
}