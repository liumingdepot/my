import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env')
const raw = fs.readFileSync(envPath, 'utf8')

let value = ''
const quoted = raw.match(/AGNES_API_KEY\s*=\s*"([\s\S]*?)"/)
const single = raw.match(/AGNES_API_KEY\s*=\s*'([\s\S]*?)'/)
if (quoted) value = quoted[1]
else if (single) value = single[1]
else {
  const line = raw.split(/\r?\n/).find((l) => /^\s*AGNES_API_KEY\s*=/.test(l))
  if (line) value = line.replace(/^\s*AGNES_API_KEY\s*=\s*/, '')
}

const keys = value
  .split(/[\n,]+/)
  .map((s) => s.trim().replace(/^["']|["']$/g, ''))
  .filter(Boolean)

console.log('keys', keys.length)
console.log('firstPrefix', keys[0]?.slice(0, 6) || '')
console.log('firstLen', keys[0]?.length || 0)
console.log('hasSpaceAfterComma', /,\s+sk-/.test(value))

const tryCount = Math.min(keys.length, 4)
for (let i = 0; i < tryCount; i++) {
  const apiKey = keys[i]
  const started = Date.now()
  try {
    const res = await fetch('https://api.agnes-ai.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'agnes-2.5-flash',
        messages: [{ role: 'user', content: '回复一个字：好' }],
      }),
      signal: AbortSignal.timeout(30000),
    })
    const text = await res.text()
    const snippet = text.replace(/\s+/g, ' ').slice(0, 180)
    console.log(`key#${i + 1}`, res.status, `${Date.now() - started}ms`, snippet)
  } catch (err) {
    console.log(`key#${i + 1}`, 'ERR', err instanceof Error ? err.message : String(err))
  }
}
