/**
 * 家宽代理：Cloudflare 出口常被上游风控 / 拿到无效地址，
 * 音乐取链、教育 B 站接口等走此转发。
 */
export const HOME_PROXY = 'https://liuming1994.qzz.io/proxy?url='

export function viaHomeProxy(target: string) {
  return `${HOME_PROXY}${encodeURIComponent(target)}`
}

/** 经家宽代理发起上游请求（默认 GET） */
export async function fetchViaHomeProxy(target: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  // 代理若误传 content-encoding，identity 可避免二次解压失败
  if (!headers.has('accept-encoding')) {
    headers.set('accept-encoding', 'identity')
  }
  return fetch(viaHomeProxy(target), {
    ...init,
    method: init?.method ?? 'GET',
    headers,
    signal: init?.signal ?? AbortSignal.timeout(20_000),
  })
}

/** 经家宽代理拉取文本；代理返回 JSON error 时抛错 */
export async function fetchTextViaHomeProxy(target: string, init?: RequestInit): Promise<string> {
  const res = await fetchViaHomeProxy(target, init)
  const text = await res.text()
  if (!res.ok) throw new Error(`proxy ${res.status}`)
  const trimmed = text.trim()
  if (trimmed.startsWith('{') && trimmed.includes('"error"')) {
    try {
      const err = JSON.parse(trimmed) as { error?: string }
      if (err.error) throw new Error(err.error)
    } catch (e) {
      if (e instanceof SyntaxError) {
        /* not a proxy error payload */
      } else {
        throw e
      }
    }
  }
  return text
}
