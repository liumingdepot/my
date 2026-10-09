const BASE = 'https://hongguoduanju.com'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const sid = '7690163276214176792'
const vid = '7690223456847154201'

function parseRouterData(raw) {
  const m = raw.match(/(?:window\.)?_ROUTER_DATA\s*=\s*/)
  if (!m || m.index == null) return null
  const start = m.index + m[0].length
  let depth = 0
  let inStr = false
  let escape = false
  let end = -1
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inStr) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') {
      inStr = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  if (end < 0) return null
  return JSON.parse(raw.slice(start, end))
}

const r = await fetch(`${BASE}/player/${sid}/${vid}`, {
  headers: { 'User-Agent': UA, Referer: `${BASE}/` },
})
const t = await r.text()
const data = parseRouterData(t)
const loader = data?.loaderData || {}
console.log('status', r.status, 'loader keys', Object.keys(loader))
for (const [k, v] of Object.entries(loader)) {
  const s = JSON.stringify(v)
  console.log('---', k, 'len', s.length)
  console.log(s.slice(0, 1200))
  if (/main_url|video_player|backup_url|key_urls/.test(s)) console.log('>>> HAS MEDIA KEYS')
}
