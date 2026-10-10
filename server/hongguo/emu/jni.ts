/**
 * JNI 桩层 —— 只需 14 个函数，全部来自 hongguo-work/trace/trace.log 的实测。
 *
 * ## 为什么不需要 Dalvik 解释器
 *
 * jar 里没有任何 .dex / .apk，且用的是 `createDalvikVM()` 无参重载。
 * metasec 只通过 14 个 JNI 函数和 Java 交互，且全部是**取常量值**
 * （版本号、证书字节、当前时间、栈帧），没有一次真的执行 Java 字节码。
 * 所以把 JNIEnv 的函数表填成一组 trampoline 就够了。
 *
 * ## ⚠️ 槽位编号必须用 C 布局，不是 unidbg 的编号
 *
 * metasec 是普通 NDK 编译的 so，按 `struct JNINativeInterface_` 的
 * **C 内存布局**索引函数表：开头 4 个 reserved 槽，GetVersion 在索引 4，
 * FindClass 在索引 6。
 *
 * unidbg 的 `DalvikVM64$N`（N=3 是 FindClass）只是它自己 Svc 对象的
 * **分配序号**，与表偏移差 3。两者都在
 * scripts/hongguo-trace/{jnilayout,jnitable}.py 里机械抽出来对过。
 *
 * 下标错一位是**静默失败** —— 不报错，只是行为诡异（详见 jnilayout.py 的口径说明）。
 * 改动 SLOT 时请用 `python3 scripts/hongguo-trace/jnilayout.py` 复核。
 *
 * ## 验收
 *
 * scripts/hongguo-jni-check.mjs 会：
 *   1. 断言本文件的 SLOT 表与 jnilayout.py 的输出逐条一致（防手改错位）
 *   2. 造一个假的 metasec 调用序列，跑通 14 个函数
 */

import { randomBytes } from 'node:crypto'

import type { Memory } from './memory.ts'

// ---------------------------------------------------------------- 槽位

/**
 * 索引 = `struct JNINativeInterface_` 的成员下标（含开头 4 个 reserved）。
 * 由 `python3 scripts/hongguo-trace/jnilayout.py <jni.h>` 机械抽取。
 */
export const SLOT = {
  GetVersion: 4,
  FindClass: 6,
  /** 注意 jni.h 里的拼写是 GetSuperclass（小写 c），不是 GetSuperClass */
  GetSuperclass: 10,
  RegisterNatives: 215,

  GetMethodID: 33,
  GetStaticMethodID: 113,

  CallObjectMethodV: 35,
  CallLongMethodV: 53,
  CallStaticObjectMethodV: 115,

  GetStaticIntField: 150,

  NewStringUTF: 167,
  GetStringUTFChars: 169,
  ReleaseStringUTFChars: 170,
  GetArrayLength: 171,
  NewObjectArray: 172,
  GetObjectArrayElement: 173,
  NewByteArray: 176,
  GetByteArrayRegion: 200,
} as const

// ---------------------------------------------------------------- 客体模型

/**
 * Java 侧对象。**不是真的 Java**，只是一张「够 metasec 用」的表。
 * metasec 只做三类事：把对象转成字符串、读字节数组、问长度。
 */
export type JObj =
  | { kind: 'string'; value: string; bytes: Buffer }
  | { kind: 'bytes'; value: Buffer }
  | { kind: 'int'; value: number }
  | { kind: 'long'; value: bigint }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'array'; items: JObj[]; of: string }
  | { kind: 'class'; name: string }
  /** 栈帧这类只做身份标识的 */
  | { kind: 'opaque'; class: string; method: string }

/** 引用：一个指针值 → 对象。JNI 引用本身就是不透明的指针。 */
type Ref = bigint

export type JniHandler = {
  /** MS.b(op) 的返回值 */
  callMS(op: number): JObj | null
  /** getStaticIntField：MS.a() 返回 0x40 */
  staticIntField(className: string, field: string): number | null
  /** getStackTrace 返回的帧 */
  stackTrace(): { class: string; method: string }[]
}

export const DEFAULT_HANDLER: JniHandler = {
  callMS: () => null,
  staticIntField: () => null,
  stackTrace: () => [],
}

/** metasec 的 MS.b 操作码（与 FqTrace.handleMS 一致） */
export const MS_OP = {
  MSDATA_PATH: 0x10003, // 返回 files/.msdata 路径字符串
  FLAG_1: 0x2000001, // 返回 true
  FLAG_2: 0x2000002, // 返回 true
  VERSION_CODE_OBJ: 0x1000010, // Integer(68132)
  VERSION_NAME: 0x1000011, // "6.8.1.32"
  APK_CERT: 0x1000012, // ms_16777218.bin
  NOW: 0x100000e, // Long(currentTimeMillis)
} as const

export type JniTraceEntry = {
  fn: string
  detail?: string
}

export type JniOptions = {
  handler?: JniHandler
  onTrace?: (e: JniTraceEntry) => void
  verbose?: boolean
}

// ---------------------------------------------------------------- 层

export class JniEnv {
  private readonly mem: Memory
  private readonly handler: JniHandler
  private readonly opts: JniOptions

  /** 引用表：指针 → 对象 */
  private readonly refs = new Map<bigint, JObj>()
  private nextRef = 0x1000n
  /** 局部引用帧，PushLocalFrame/PopLocalFrame 与之对应 */
  private readonly frames: Set<bigint>[] = [new Set()]

  /** 类缓存：类名 → jclass 引用 */
  private readonly classes = new Map<string, Ref>()

  /** 方法 ID → (类名, 方法名, 签名)，CallXxx 靠它反查 */
  private readonly methods = new Map<bigint, { cls: string; name: string; sig: string }>()
  private nextMethodId = 0x7000n

  /** 已 RegisterNatives 的 native 方法，用于对齐 trace 的那条记录 */
  readonly registeredNatives: { cls: string; name: string; sig: string; fn: bigint }[] = []

  /** trampoline 可执行页 */
  private readonly trampolineBase: bigint
  private readonly dispatchPage: bigint
  /** 每个槽位对应的 trampoline 地址 */
  private readonly slotAddr = new Map<number, bigint>()
  /** 反查：trampoline 地址 → 槽位 */
  private readonly addrSlot = new Map<bigint, number>()

  /** 本层累计的调用计数 */
  readonly stats = new Map<string, number>()

  constructor(mem: Memory, opts: JniOptions = {}) {
    this.mem = mem
    this.handler = opts.handler ?? DEFAULT_HANDLER
    this.opts = opts

    // trampoline 放在代码区之外的一段可执行页。
    // 全部槽位共用一个入口，进去后靠 LR 区分是谁 —— LR 由外部 trampoline 指令设置。
    this.trampolineBase = 0x7000000000n
    this.dispatchPage = this.trampolineBase
  }

  // ---- 引用

  private allocRef(o: JObj): Ref {
    const p = this.nextRef += 0x8n
    this.refs.set(p, o)
    this.frames[this.frames.length - 1].add(p)
    return p
  }

  /** 由裸指针取对象；未知引用返回 undefined */
  get(p: Ref): JObj | undefined {
    return this.refs.get(p)
  }

  private release(p: Ref): void {
    this.refs.delete(p)
    for (const f of this.frames) f.delete(p)
  }

  // ---- 对象构造

  makeString(s: string): Ref {
    return this.allocRef({ kind: 'string', value: s, bytes: Buffer.from(s, 'utf8') })
  }

  makeBytes(b: Buffer): Ref {
    return this.allocRef({ kind: 'bytes', value: b })
  }

  makeInt(v: number): Ref {
    return this.allocRef({ kind: 'int', value: v })
  }

  makeLong(v: bigint): Ref {
    return this.allocRef({ kind: 'long', value: v })
  }

  makeBoolean(v: boolean): Ref {
    return this.allocRef({ kind: 'boolean', value: v })
  }

  private classRef(name: string): Ref {
    const hit = this.classes.get(name)
    if (hit) return hit
    const p = this.allocRef({ kind: 'class', name })
    this.classes.set(name, p)
    return p
  }

  /** 字符串字面量（按值缓存，同串共用一个引用） */
  private stringCache = new Map<string, Ref>()
  internString(s: string): Ref {
    const hit = this.stringCache.get(s)
    if (hit) return hit
    const p = this.makeString(s)
    this.stringCache.set(s, p)
    return p
  }

  // ---- 计数 / trace

  private tick(fn: string, detail?: string): void {
    this.stats.set(fn, (this.stats.get(fn) ?? 0) + 1)
    this.opts.onTrace?.({ fn, detail })
    if (this.opts.verbose) {
      process.stderr.write(`  [jni] ${fn}${detail ? ` ${detail}` : ''}\n`)
    }
  }

  // ================================================================
  // 14 个 JNI 函数的实现。
  // 每个都返回 x0 的值（BigInt），调用方负责写回寄存器。
  // ================================================================

  /** FindClass(env, name) -> jclass；找不到抛 NoClassDefFoundError 时返回 null */
  findClass(env: Ref, namePtr: bigint): bigint {
    const name = this.mem.readCString(namePtr)
    this.tick('FindClass', name)
    // metasec 只查 3 个类（MS / Thread / StackTraceElement / Long / Integer），
    // 全部命中；未知的类返回 null 让它走「类找不到」分支。
    const known = [
      'com/bytedance/mobsec/metasec/ml/MS',
      'java/lang/Thread',
      'java/lang/StackTraceElement',
      'java/lang/Long',
      'java/lang/Integer',
      'java/lang/Boolean',
      'java/lang/String',
      'java/lang/Object',
    ]
    if (!known.includes(name)) return 0n
    return this.classRef(name)
  }

  /** GetSuperclass(env, clazz) -> jclass */
  getSuperClass(env: Ref, clazz: bigint): bigint {
    this.tick('GetSuperClass')
    const c = this.refs.get(clazz)
    // MS 继承 ms/bd/c/a4$a（trace 里能看到），Thread/StackTraceElement 继承 Object
    if (c && c.kind === 'class') {
      if (c.name === 'com/bytedance/mobsec/metasec/ml/MS') return this.classRef('ms/bd/c/a4$a')
      return this.classRef('java/lang/Object')
    }
    return 0n
  }

  /** RegisterNatives(env, clazz, methods, nMethods) */
  registerNatives(env: Ref, clazz: bigint, methods: bigint, n: number): bigint {
    const c = this.refs.get(clazz)
    const cls = c && c.kind === 'class' ? c.name : '?'
    for (let i = 0; i < n; i++) {
      // struct JNINativeMethod { const char* name; const char* signature; void* fnPtr; }
      const rec = methods + BigInt(i) * 24n
      const name = this.mem.readCString(this.mem.readU64(rec))
      const sig = this.mem.readCString(this.mem.readU64(rec + 8n))
      const fn = this.mem.readU64(rec + 16n)
      this.registeredNatives.push({ cls, name, sig, fn })
      this.tick('RegisterNatives', `${cls}.${name}${sig}`)
    }
    return 0n
  }

  /** GetMethodID(env, clazz, name, sig) -> jmethodID */
  getMethodID(env: Ref, clazz: bigint, namePtr: bigint, sigPtr: bigint): bigint {
    const c = this.refs.get(clazz)
    const cls = c && c.kind === 'class' ? c.name : '?'
    const name = this.mem.readCString(namePtr)
    const sig = this.mem.readCString(sigPtr)
    const id = this.nextMethodId += 0x8n
    this.methods.set(id, { cls, name, sig })
    this.tick('GetMethodID', `${cls}.${name}${sig} => 0x${id.toString(16)}`)
    return id
  }

  /** GetStaticMethodID —— 与 GetMethodID 同构 */
  getStaticMethodID(env: Ref, clazz: bigint, namePtr: bigint, sigPtr: bigint): bigint {
    const c = this.refs.get(clazz)
    const cls = c && c.kind === 'class' ? c.name : '?'
    const name = this.mem.readCString(namePtr)
    const sig = this.mem.readCString(sigPtr)
    const id = this.nextMethodId += 0x8n
    this.methods.set(id, { cls, name, sig })
    this.tick('GetStaticMethodID', `${cls}.${name}${sig} => 0x${id.toString(16)}`)
    return id
  }

  /**
   * CallStaticObjectMethodV(env, clazz, methodID, vaList)
   *
   * 实测只走到 `MS.b(IIJLjava/lang/String;Ljava/lang/Object;)Ljava/lang/Object;`，
   * 第一个参数是 op 码，其余一律传 0/null。
   */
  callStaticObjectMethodV(env: Ref, clazz: bigint, method: bigint, vaList: bigint): bigint {
    const m = this.methods.get(method)
    const cls = this.refs.get(clazz)
    const clsName = cls && cls.kind === 'class' ? cls.name : (m?.cls ?? '?')
    const name = m?.name ?? '?'

    // VaList 第一个参数就是 op 码（int）
    const op = vaList ? Number(this.mem.readU32(vaList)) : 0

    if (clsName === 'com/bytedance/mobsec/metasec/ml/MS' && name === 'b') {
      this.tick('CallStaticObjectMethodV', `MS.b(0x${op.toString(16)})`)
      const r = this.handler.callMS(op)
      if (r === null) return 0n
      return this.wrap(r)
    }

    if (clsName === 'java/lang/Thread' && name === 'currentThread') {
      this.tick('CallStaticObjectMethodV', 'Thread.currentThread()')
      return this.allocRef({ kind: 'opaque', class: 'java/lang/Thread', method: 'currentThread' })
    }

    this.tick('CallStaticObjectMethodV', `${clsName}.${name}`)
    return 0n
  }

  /** CallObjectMethodV(env, obj, methodID, vaList) */
  callObjectMethodV(env: Ref, obj: bigint, method: bigint, vaList: bigint): bigint {
    const m = this.methods.get(method)
    const name = m?.name ?? '?'

    switch (name) {
      case 'getBytes': {
        // String.getBytes(String charsetName) -> byte[]
        const argRef = vaList ? this.mem.readU64(vaList) : 0n
        const s = this.refs.get(argRef)
        const str = s && s.kind === 'string' ? s.value : ''
        this.tick('CallObjectMethodV', `String.getBytes() => ${str.length}B`)
        return this.makeBytes(Buffer.from(str, 'utf8'))
      }

      case 'getStackTrace': {
        const frames = this.handler.stackTrace()
        this.tick('CallObjectMethodV', `Thread.getStackTrace() => ${frames.length} 帧`)
        const items = frames.map((f) =>
          this.allocRef({ kind: 'opaque', class: 'java/lang/StackTraceElement', method: f.method }),
        )
        return this.allocRef({ kind: 'array', items, of: 'java/lang/StackTraceElement' })
      }

      case 'getClassName': {
        const o = this.refs.get(obj)
        const cls = o && o.kind === 'opaque' ? o.class : 'java/lang/Object'
        this.tick('CallObjectMethodV', `StackTraceElement.getClassName() => "${cls}"`)
        return this.makeString(cls)
      }

      case 'getMethodName': {
        const o = this.refs.get(obj)
        const mth = o && o.kind === 'opaque' ? o.method : '?'
        this.tick('CallObjectMethodV', `StackTraceElement.getMethodName() => "${mth}"`)
        return this.makeString(mth)
      }

      default:
        this.tick('CallObjectMethodV', name)
        return 0n
    }
  }

  /** CallLongMethodV(env, obj, methodID, vaList) —— Long.longValue() */
  callLongMethodV(env: Ref, obj: bigint, method: bigint, vaList: bigint): bigint {
    const m = this.methods.get(method)
    const name = m?.name ?? '?'
    if (name === 'longValue') {
      const o = this.refs.get(obj)
      const v = o && o.kind === 'long' ? o.value : 0n
      this.tick('CallLongMethodV', `Long.longValue() => ${v}`)
      return v
    }
    this.tick('CallLongMethodV', name)
    return 0n
  }

  /** NewStringUTF(env, chars) -> jstring */
  newStringUTF(env: Ref, chars: bigint): bigint {
    const s = this.mem.readCString(chars)
    this.tick('NewStringUTF', `"${s}"`)
    return this.makeString(s)
  }

  /** GetStringUTFChars(env, str, isCopy) -> const char* */
  getStringUTFChars(env: Ref, str: bigint, isCopy: bigint): bigint {
    const o = this.refs.get(str)
    const s = o && o.kind === 'string' ? o.value : ''
    this.tick('GetStringUTFChars', `"${s}"`)
    // 返回客体里的 C 字符串副本。isCopy(非 0 时) 写 1。
    const p = this.mem.heapAlloc(BigInt(Buffer.byteLength(s, 'utf8') + 1), 0x10n)
    this.mem.writeCString(p, s)
    if (isCopy) this.mem.writeU8(isCopy, 1)
    // 记下映射，Release 时释放（这里只记账，bump 分配器不做真正回收）
    this.utfChars.set(p, s)
    return p
  }

  private readonly utfChars = new Map<bigint, string>()

  /** ReleaseStringUTFChars(env, str, chars) */
  releaseStringUTFChars(env: Ref, str: bigint, chars: bigint): bigint {
    this.tick('ReleaseStringUTFChars')
    this.utfChars.delete(chars)
    return 0n
  }

  /** GetArrayLength(env, array) -> jsize */
  getArrayLength(env: Ref, array: bigint): bigint {
    const a = this.refs.get(array)
    let n = 0
    if (a && a.kind === 'array') n = a.items.length
    else if (a && a.kind === 'bytes') n = a.value.length
    this.tick('GetArrayLength', `=> ${n}`)
    return BigInt(n)
  }

  /** GetObjectArrayElement(env, array, index) -> jobject */
  getObjectArrayElement(env: Ref, array: bigint, index: number): bigint {
    const a = this.refs.get(array)
    if (!a || a.kind !== 'array') return 0n
    const item = a.items[index]
    this.tick('GetObjectArrayElement', `[${index}]`)
    return item === undefined ? 0n : this.refToRef(item)
  }

  /** GetByteArrayRegion(env, array, start, len, buf) */
  getByteArrayRegion(env: Ref, array: bigint, start: number, len: number, buf: bigint): bigint {
    const a = this.refs.get(array)
    if (!a) return -1n
    const data = a.kind === 'bytes' ? a.value : Buffer.alloc(0)
    const slice = data.subarray(start, start + len)
    this.mem.write(buf, new Uint8Array(slice))
    this.tick('GetByteArrayRegion', `[${start}, ${len}] -> 0x${buf.toString(16)}`)
    return 0n
  }

  /** GetStaticIntField(env, clazz, fieldID, valuePtr) */
  getStaticIntField(env: Ref, clazz: bigint, field: bigint, valuePtr: bigint): bigint {
    const c = this.refs.get(clazz)
    const clsName = c && c.kind === 'class' ? c.name : '?'
    const v = this.handler.staticIntField(clsName, 'a')
    this.tick('GetStaticIntField', `${clsName}.a() => ${v ?? 'null'}`)
    if (v === null) {
      // 没实现的字段：写 0，别留垃圾
      if (valuePtr) this.mem.writeU32(valuePtr, 0)
      return 0n
    }
    if (valuePtr) this.mem.writeU32(valuePtr, v)
    return 0n
  }

  // ---- 工具

  /** 把 handler 返回的对象包成引用 */
  private wrap(o: JObj): bigint {
    switch (o.kind) {
      case 'string':
        return this.makeString(o.value)
      case 'bytes':
        return this.makeBytes(o.value)
      case 'int':
        return this.makeInt(o.value)
      case 'long':
        return this.makeLong(o.value)
      case 'boolean':
        return this.makeBoolean(o.value)
      case 'array':
        return this.allocRef(o)
      case 'class':
        return this.classRef(o.name)
      default:
        return this.allocRef(o)
    }
  }

  /** 对象已在引用表里则复用，否则新建 */
  private refToRef(o: JObj): Ref {
    for (const [p, v] of this.refs) {
      if (v === o) return p
    }
    return this.allocRef(o)
  }

  /** PushLocalFrame(env, capacity) */
  pushLocalFrame(env: Ref, capacity: number): bigint {
    this.frames.push(new Set())
    return 0n
  }

  /** PopLocalFrame(env, result) */
  popLocalFrame(env: Ref, result: bigint): bigint {
    const f = this.frames.pop()
    if (f) for (const p of f) this.refs.delete(p)
    return result
  }

  /** DeleteLocalRef(env, obj) */
  deleteLocalRef(env: Ref, obj: bigint): bigint {
    this.release(obj)
    return 0n
  }

  /** 引用表快照，调试用 */
  refCount(): number {
    return this.refs.size
  }

  statsReport(): Record<string, number> {
    return Object.fromEntries([...this.stats.entries()].sort((a, b) => b[1] - a[1]))
  }
}

/**
 * FqTrace 等价实现：MS.b(op) 的返回值表。
 *
 * 数值全部照抄 FqTrace.handleMS —— 这是签名能对上的前提，改任何一个都会
 * 让服务端验签失败（表现为 HTTP 200 + 空 body，见 README-stream.md）。
 */
export function makeFqHandler(opts: {
  filesDir: string
  versionCode?: number
  versionName?: string
  cert?: Buffer | null
}): JniHandler {
  const versionCode = opts.versionCode ?? 68132
  const versionName = opts.versionName ?? '6.8.1.32'
  return {
    callMS(op: number): JObj | null {
      switch (op) {
        case MS_OP.MSDATA_PATH:
          return { kind: 'string', value: `${opts.filesDir}/.msdata`, bytes: Buffer.from(`${opts.filesDir}/.msdata`) }
        case MS_OP.FLAG_1:
        case MS_OP.FLAG_2:
          return { kind: 'boolean', value: true }
        case MS_OP.VERSION_CODE_OBJ:
          return { kind: 'int', value: versionCode }
        case MS_OP.VERSION_NAME:
          return { kind: 'string', value: versionName, bytes: Buffer.from(versionName) }
        case MS_OP.APK_CERT:
          // ⚠️ 返回 null 会让 metasec 拿不到签名证书 —— 必须真的提供字节
          return opts.cert ? { kind: 'bytes', value: opts.cert } : null
        case MS_OP.NOW:
          return { kind: 'long', value: BigInt(Date.now()) }
        default:
          return null
      }
    },
    staticIntField(className: string, field: string): number | null {
      if (className === 'com/bytedance/mobsec/metasec/ml/MS' && field === 'a') return 0x40
      return null
    },
    stackTrace() {
      // metasec 取第 2、3 帧的 class/method 名拼进签名。
      // FqTrace 侧是真实 JVM 栈（AbstractJni/DvmMethod…），这里给一组固定的：
      // 内容不同会导致签名不同，但结构一致 —— 服务端不校验栈内容，
      // 只校验它参与了正确的派生链。
      return [
        { class: 'java.lang.Thread', method: 'run' },
        { class: 'com.github.unidbg.linux.android.dvm.AbstractJni', method: 'callObjectMethodV' },
        { class: 'com.github.unidbg.linux.android.dvm.DvmMethod', method: 'callObjectMethodV' },
        { class: 'com.hongguo.sign.FqTrace', method: 'sign' },
      ]
    },
  }
}