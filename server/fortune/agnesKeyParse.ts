/** 解析逗号 / 中文逗号 / 换行分隔的多个 key */
export function parseAgnesKeys(raw?: string): string[] {
  if (!raw?.trim()) return []
  let text = raw.trim()
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1)
  }
  return text
    .split(/[\n,，;；]+/)
    .map((item) => item.trim().replace(/^["']|["']$/g, ''))
    .filter((item) => item.startsWith('sk-') || item.length > 20)
}

/** 令牌失效 / 不可用 / 鉴权失败 */
export function isAgnesTokenError(message: string, status?: number): boolean {
  if (status === 401 || status === 403) return true
  const text = message || ''
  return /令牌|token|api[\s_-]?key|unauthorized|forbidden|状态不可用|不可用|已禁用|disabled|expired|invalid/i.test(
    text,
  )
}
