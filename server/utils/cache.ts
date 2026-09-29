type Entry = { value: string; expiresAt: number }

const store = new Map<string, Entry>()

function now() {
  return Date.now()
}

export async function getJsonCache<T>(key: string): Promise<T | null> {
  const hit = store.get(key)
  if (!hit) return null
  if (hit.expiresAt <= now()) {
    store.delete(key)
    return null
  }
  try {
    return JSON.parse(hit.value) as T
  } catch {
    store.delete(key)
    return null
  }
}

export async function putJsonCache(key: string, value: unknown, ttlSec: number) {
  const ttl = Math.max(1, Math.floor(ttlSec))
  store.set(key, {
    value: JSON.stringify(value),
    expiresAt: now() + ttl * 1000,
  })
}

export function deleteCache(key: string) {
  store.delete(key)
}

export async function withJsonCache<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await getJsonCache<T>(key)
  if (hit != null) return hit
  const data = await loader()
  try {
    await putJsonCache(key, data, ttlSec)
  } catch (err) {
    console.error('[cache] put failed', key, err)
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
