import type { AgnesCredential } from '../admin/agnesKeys.js'
import { listEnabledAgnesCredentials } from '../admin/agnesKeys.js'
import type { FortuneEnv } from './api.js'
import { parseAgnesKeys } from './agnesKeyParse.js'

export { parseAgnesKeys, isAgnesTokenError } from './agnesKeyParse.js'

let keyIndex = 0
let loggedKeyCount = false

/**
 * 按轮询起点列出本次应尝试的凭证顺序（每个最多一次）。
 */
export function rotateAgnesCredentials(credentials: AgnesCredential[]): AgnesCredential[] {
  if (!credentials.length) return []
  if (!loggedKeyCount) {
    loggedKeyCount = true
    console.info(`[agnes] loaded ${credentials.length} credential(s) from DB`)
  }
  if (credentials.length === 1) return credentials

  keyIndex = (keyIndex + 1) % credentials.length
  const start = keyIndex
  return Array.from(
    { length: credentials.length },
    (_, i) => credentials[(start + i) % credentials.length]!,
  )
}

/** @deprecated 兼容旧调用：仅返回 key 字符串列表 */
export function rotateAgnesKeys(raw?: string): string[] {
  const keys = parseAgnesKeys(raw)
  if (!keys.length) return []
  if (keys.length === 1) return keys
  keyIndex = (keyIndex + 1) % keys.length
  const start = keyIndex
  return Array.from({ length: keys.length }, (_, i) => keys[(start + i) % keys.length]!)
}

export async function nextAgnesApiKey(env: FortuneEnv): Promise<string | null> {
  const credentials = await loadAgnesCredentials(env)
  return credentials[0]?.apiKey ?? null
}

export async function loadAgnesCredentials(env: FortuneEnv): Promise<AgnesCredential[]> {
  try {
    const fromDb = await listEnabledAgnesCredentials(env.DB)
    if (fromDb.length) return fromDb
  } catch (err) {
    console.warn('[agnes] load DB credentials failed:', err)
  }

  // 表为空时兜底环境变量（中国区）
  const keys = parseAgnesKeys(env.AGNES_API_KEY)
  return keys.map((apiKey, index) => ({
    id: `env-${index}`,
    apiKey,
    baseUrl: 'https://api.agnes-ai.cn/v1',
  }))
}

export async function hasAgnesCredentials(env: FortuneEnv) {
  const list = await loadAgnesCredentials(env)
  return list.length > 0
}

/**
 * 多 key 故障切换：失败自动换下一个凭证，直到成功或全部失败。
 */
export async function withAgnesKeyFailover<T>(
  env: FortuneEnv,
  run: (credential: AgnesCredential) => Promise<T>,
): Promise<T> {
  const credentials = rotateAgnesCredentials(await loadAgnesCredentials(env))
  if (!credentials.length) throw new Error('未配置 AGNES_API_KEY')

  let lastError: unknown
  for (let i = 0; i < credentials.length; i++) {
    try {
      return await run(credentials[i]!)
    } catch (err) {
      lastError = err
      const msg = err instanceof Error ? err.message : String(err)
      if (i < credentials.length - 1) {
        console.warn(
          `[agnes] key ${i + 1}/${credentials.length} failed, try next:`,
          msg.slice(0, 160),
        )
        continue
      }
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`${msg}（已尝试 ${credentials.length} 个密钥）`)
}

/** 从 Agnes 错误响应里取出可读信息 */
export function agnesErrorMessage(data: unknown, fallback = 'ai request failed'): string {
  if (!data || typeof data !== 'object') return fallback
  const obj = data as Record<string, unknown>
  if (typeof obj.detail === 'string' && obj.detail.trim()) return obj.detail.trim()
  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message.trim()
  if (typeof obj.error === 'string' && obj.error.trim()) return obj.error.trim()
  if (obj.error && typeof obj.error === 'object') {
    const msg = (obj.error as { message?: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
  }
  return fallback
}
