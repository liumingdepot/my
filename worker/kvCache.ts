/** KV JSON 读缓存：命中直接返回，未命中写回并带 TTL（免费档写次数有限，TTL 宜略长） */

export async function getKvJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  return kv.get(key, 'json') as Promise<T | null>
}

export async function putKvJson(kv: KVNamespace, key: string, value: unknown, ttlSec: number) {
  // KV expirationTtl 最小 60
  const ttl = Math.max(60, Math.floor(ttlSec))
  await kv.put(key, JSON.stringify(value), { expirationTtl: ttl })
}

export async function withKvJsonCache<T>(
  kv: KVNamespace,
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await getKvJson<T>(kv, key)
  if (hit != null) return hit
  const data = await loader()
  try {
    await putKvJson(kv, key, data, ttlSec)
  } catch (err) {
    console.error('[kv cache] put failed', key, err)
  }
  return data
}

export function cacheKey(prefix: string, parts: Record<string, string | number | null | undefined>) {
  const entries = Object.entries(parts)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${String(v)}`)
    .sort()
  return `${prefix}:${entries.join('&')}`
}
