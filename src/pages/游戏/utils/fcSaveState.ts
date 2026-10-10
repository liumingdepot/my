/**
 * FC 即时存档的编解码。
 *
 * jsnes 的 `nes.toJSON()` / `nes.fromJSON()` 已被实测证明可完整还原
 * （存档点重放同样帧数后画面逐像素一致），因此沿用其对象图，
 * 只在「落盘」这一步做压缩：
 *
 *   - `toJSON()` 把所有 TypedArray 转成普通数组，CPU 主内存等大块数据用
 *     JSON 数字表示体积极大（整机约 1.1MB）。
 *   - 这里把大块 TypedArray 按其**元素字节宽度**转成二进制再 base64，
 *     其余寄存器等标量仍走 JSON。
 *   - 解码时还原成普通数组交给 `fromJSON`，由它原地 `.set()` 回原 TypedArray，
 *     与实测通过的路径一致。
 *
 * 注意两个易错点：
 *   1. 元素宽度必须区分。`vramMirrorTable` 是 Uint16Array（值可达 65535），
 *      若按字节截断会静默损坏画面。宽度信息只能从 toJSON 之前的活对象读取。
 *   2. 不能从快照里删字段。`fromJSON` 会遍历全部 JSON_PROPERTIES，缺失的键
 *      会被写成 `undefined`。`buffer` / `pixrendered` 虽由 `startFrame()` 每帧
 *      `fill()` 覆盖、内容不跨帧，但引用必须保留，故读档前先备份、读档后补回。
 */

/** 体积大且值得二进制编码的字段（相对各分量的属性名） */
const BINARY_FIELDS: Record<string, string[]> = {
  cpu: ['mem'],
  ppu: [
    'vramMem',
    'vramMirrorTable',
    'spriteMem',
    'secondaryOAM',
    'sprPalette',
    'imgPalette',
    'attrib',
    'bgbuffer',
  ],
}

/** 内容不跨帧、可省略数据但必须保留引用的输出缓冲 */
const REBUILT_FIELDS = ['buffer', 'pixrendered']

type NesLike = {
  // jsnes 的 EmulatorData 无索引签名，故 toJSON 结果按 unknown 接收后自行断言；
  // fromJSON 用 never 作形参类型，使 NES 的具体签名仍可赋值进来。
  toJSON: () => unknown
  fromJSON: (state: never) => void
  cpu?: Record<string, unknown>
  ppu?: Record<string, unknown>
}

/** path → [元素个数, 元素字节宽度] */
type BinaryMeta = Record<string, [number, number]>

function btoaChunked(bytes: Uint8Array) {
  let binary = ''
  // 分片必须够小：一次 spread 3 万多个参数会超出引擎参数上限并静默返回空串
  const CHUNK = 4096
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[])
  }
  return btoa(binary)
}

/** 按元素宽度打包成小端二进制 */
function encodeArray(values: ArrayLike<number>, width: number) {
  const view = new DataView(new ArrayBuffer(values.length * width))
  for (let i = 0; i < values.length; i++) {
    const v = values[i] | 0
    if (width === 1) view.setUint8(i, v & 0xff)
    else if (width === 2) view.setUint16(i * 2, v & 0xffff, true)
    else view.setUint32(i * 4, v >>> 0, true)
  }
  return btoaChunked(new Uint8Array(view.buffer))
}

function decodeArray(b64: string, count: number, width: number) {
  const binary = atob(b64)
  // 必须把 atob 的结果写入字节缓冲，否则 DataView 读到的全是初始化的 0
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const view = new DataView(bytes.buffer)
  const out = new Array<number>(count)
  for (let i = 0; i < count; i++) {
    if (width === 1) out[i] = view.getUint8(i)
    else if (width === 2) out[i] = view.getUint16(i * 2, true)
    else out[i] = view.getUint32(i * 4, true)
  }
  return out
}

export function encodeFcState(nes: NesLike): string {
  // 元素宽度只能从活对象取：toJSON 之后已退化为普通数组
  const meta: BinaryMeta = {}
  for (const [component, fields] of Object.entries(BINARY_FIELDS)) {
    const live = (nes as unknown as Record<string, unknown>)[component] as
      | Record<string, ArrayBufferView>
      | undefined
    if (!live) continue
    for (const field of fields) {
      const view = live[field]
      if (!view || !ArrayBuffer.isView(view)) continue
      const typed = view as unknown as { length: number; BYTES_PER_ELEMENT: number }
      meta[`${component}.${field}`] = [typed.length, typed.BYTES_PER_ELEMENT]
    }
  }

  const snapshot = nes.toJSON() as Record<string, Record<string, unknown>>
  const binary: Record<string, string> = {}
  for (const [path, [count, width]] of Object.entries(meta)) {
    const dot = path.indexOf('.')
    const holder = snapshot[path.slice(0, dot)]
    if (!holder) continue
    const field = path.slice(dot + 1)
    const value = holder[field] as ArrayLike<number> | undefined
    if (!value || value.length !== count) continue
    binary[path] = encodeArray(value, width)
    delete holder[field]
  }

  for (const field of REBUILT_FIELDS) delete snapshot.ppu?.[field]

  return JSON.stringify({ v: 1, meta, binary, state: snapshot })
}

export function decodeFcState(nes: NesLike, payload: string): boolean {
  let parsed: {
    v: number
    meta?: BinaryMeta
    binary?: Record<string, string>
    state: Record<string, Record<string, unknown>>
  }
  try {
    parsed = JSON.parse(payload)
  } catch {
    return false
  }
  // 版本或结构不符时不要动模拟器状态，避免把正在玩的游戏弄坏
  if (!parsed || parsed.v !== 1 || !parsed.state?.cpu || !parsed.state?.ppu) return false

  const state = parsed.state
  for (const [path, [count, width]] of Object.entries(parsed.meta || {})) {
    const dot = path.indexOf('.')
    const holder = state[path.slice(0, dot)]
    const field = path.slice(dot + 1)
    const b64 = parsed.binary?.[path]
    if (!holder || !b64) return false
    holder[field] = decodeArray(b64, count, width)
  }

  try {
    // fromJSON 会把快照里缺失的字段写成 undefined，先保住这些输出缓冲的原引用
    const kept = new Map<string, unknown>()
    for (const field of REBUILT_FIELDS) kept.set(field, nes.ppu?.[field])

    // fromJSON 的形参类型在 NesLike 上是 never（仅为兼容 NES 的具体签名），实际调用处再取回
    ;(nes.fromJSON as (s: unknown) => void)(state)

    const ppu = nes.ppu
    if (ppu) {
      for (const [field, value] of kept) {
        if (value !== undefined && ppu[field] === undefined) ppu[field] = value
      }
    }
    return true
  } catch {
    return false
  }
}

/** 从 canvas 取一张小缩略图，用于存档列表识别（失败返回 undefined） */
export function captureThumbnail(canvas: HTMLCanvasElement | null | undefined) {
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return undefined
  try {
    const out = document.createElement('canvas')
    out.width = 96
    out.height = 72
    const ctx = out.getContext('2d')
    if (!ctx) return undefined
    ctx.imageSmoothingEnabled = false
    // 居中裁切为 4:3
    const side = Math.min(canvas.width, canvas.height)
    ctx.drawImage(
      canvas,
      (canvas.width - side) / 2,
      (canvas.height - side) / 2,
      side,
      side,
      0,
      0,
      out.width,
      out.height,
    )
    return out.toDataURL('image/jpeg', 0.6)
  } catch {
    return undefined
  }
}