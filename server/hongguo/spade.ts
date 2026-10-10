/**
 * 红果 spade_a → 内容密钥（content key）
 *
 * 逆向自 libttmplayer.so FUN_001c4550（ver1 路径，播放器 option 0x97）。
 * 纯字节变换（XOR + POPCOUNT + 位置相关），无 KEK、无 AES，可完全离线计算。
 *
 * 链路：multi_video_model 的 encrypt_info.spade_a(base64)
 *      → base64 解码 → unwrapV1 → content key(16B, 32 hex)
 *      → 配合密文 senc 首样本 base_iv 做 AES-128-CTR 解密。
 *
 * 注：ver2（type 字符串 "app_v2" / "web_v2"）走 AES-GCM 路径，当前红果视频未使用。
 */

/** 32 位 popcount */
function popcount(x: number): number {
  let v = x >>> 0
  let n = 0
  while (v) {
    v &= v - 1
    n++
  }
  return n
}

/** 转成有符号 8 位 */
function s8(v: number): number {
  const b = v & 0xff
  return b >= 128 ? b - 256 : b
}

/** 以 \0 结尾的 strncmp */
function strncmp0(a: number[], b: string, n: number): boolean {
  for (let k = 0; k < n; k++) {
    const ca = k < a.length ? a[k]! : 0
    const cb = b.charCodeAt(k) || 0
    if (ca !== cb) return false
    if (ca === 0) return true
  }
  return true
}

/**
 * spade（37B 字节）→ content key（32 hex）；无法解析时返回 null。
 * flag = 播放器 option 0x97 的值（实测为 0），非 0 时变换方向相反。
 */
export function unwrapV1(spade: Buffer, flag = 0): string | null {
  const L = spade.length
  if (L < 3) return null

  const bVar5 = spade[0]! ^ spade[1]! ^ spade[2]!
  const iVar9 = bVar5 - 0x30 // type 字符串长度
  if (iVar9 < 1) return null

  const uVar1 = L - bVar5 + 0x2f // 工作缓冲长度
  if (uVar1 < 1 || 1 + uVar1 > L) return null

  const dest = Buffer.from(spade.subarray(1, 1 + uVar1)) // memcpy(dest, spade+1, uVar1)

  // 解出 type 字符串，识别 v1 / v2
  const s1 = new Array<number>(iVar9)
  const b16 = spade[L - iVar9 - 2]!
  const b14 = spade[L - iVar9 - 1]!
  for (let i = 0; i < iVar9; i++) {
    s1[i] = b14 ^ b16 ^ spade[i + (L - iVar9)]!
  }
  if (strncmp0(s1, 'app_v2', iVar9) || strncmp0(s1, 'web_v2', iVar9)) {
    return null // ver2：AES-GCM 路径，此处未实现
  }

  // ver1 字节变换
  let cur14 = 0x55
  let cur16 = 0xfa
  for (let i = 0; i < uVar1; i++) {
    const b6 = dest[i]!
    const u18 = popcount(i)
    let b3 = b6
    let b7 = cur14
    if (i & 1) {
      b3 = cur16
      b7 = b6
      cur16 = cur14
    }
    const cVar4 = flag ? u18 + 0x15 : s8(-0x15 - u18)
    dest[i] = (cVar4 + (cur16 ^ b6)) & 0xff
    cur14 = b7
    cur16 = b3
  }

  // 按 dest[0] 的 hex 值切出 content key
  const b0 = dest[0]!
  let u11: number
  if (b0 >= 0x30 && b0 <= 0x39) u11 = b0 - 0x30
  else if (b0 >= 0x61 && b0 <= 0x7a) u11 = b0 - 0x57
  else return null

  const iv9 = uVar1 - (u11 & 0xff)
  if (iv9 < 2) return null
  return dest.subarray(1, iv9).toString('latin1')
}

/** video_model 的 spade_a(base64) → content key(32 hex) */
export function spadeToKey(spadeAB64: string, flag = 0): string | null {
  const spade = Buffer.from(spadeAB64.trim(), 'base64')
  return unwrapV1(spade, flag)
}

/** 5 组运行时真值（libttmplayer FUN_001c4550 hook 抓取），用于自测 */
export const SPADE_TRUTH: ReadonlyArray<readonly [string, string]> = [
  ['93bc1df253ba1bf7618b19c448b806f64d810afc45b715fe5eb925f26cbf12f541ba098282', '287216bfa89e662a0f748120c305e199'],
  ['a1bc2ff164b91df04dbf00f17dba00f47cbb35c27b922aec67a628eb52972fdc7ea036a7a7', 'd742b28967e4e6c92b699f4375add27f'],
  ['9cbc12fb588721cd69b739f977b70be7429c08e074990ec847843dcc738638cf76b33ebcbc', '113fb30d9767d80e3edbb905b052204f'],
  ['a3bc2df760ba2bc27b8b34c04a8907f557be19f249be35c748ba03f64fbc1ff161ba29a2a2', 'b5674a8384f25d757585dadf343274d5'],
  ['9cbc12f45aba11f76fb814f444bd15f459b225cb5e8c15dd459a0fd170ac0ad358aa108b8b', '121846f9d5829130ebc0397023feaf8c'],
]