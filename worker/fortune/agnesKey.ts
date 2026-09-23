import type { FortuneEnv } from './api.js'

const KEY_INDEX = 'agnes:api_key_index'

/** 解析逗号 / 换行分隔的多个 key */
export function parseAgnesKeys(raw?: string): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/** 每次调用轮询取下一个 key；有 KV 时跨 isolate 共享序号 */
export async function nextAgnesApiKey(env: FortuneEnv): Promise<string | null> {
  const keys = parseAgnesKeys(env.AGNES_API_KEY)
  if (!keys.length) return null
  if (keys.length === 1) return keys[0]

  let index = 0
  try {
    const prev = Number(await env.KV.get(KEY_INDEX))
    index = Number.isFinite(prev) ? (prev + 1) % keys.length : 0
    await env.KV.put(KEY_INDEX, String(index))
  } catch {
    index = Math.floor(Math.random() * keys.length)
  }
  return keys[index] ?? keys[0]
}
