const LIST_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

async function main() {
  const playHtml = await (
    await fetch('https://www.yikm.net/play?id=9247', {
      headers: { 'User-Agent': LIST_UA, Referer: 'https://www.yikm.net/' },
    })
  ).text()

  // dump script inline blocks mentioning arcade/rom
  const inlines = [...playHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1])
  inlines.forEach((s, i) => {
    if (/gromname|arcade|rom|gsystem|loadRom|file\./i.test(s)) {
      console.log(`\n===== inline ${i} len=${s.length} =====`)
      console.log(s.slice(0, 2000))
    }
  })

  for (const src of [
    'https://file.yikm.net/libs/pzmlib.js',
    'https://file.yikm.net/libs/browserfs.min.js',
  ]) {
    const js = await (await fetch(src, { headers: { 'User-Agent': LIST_UA } })).text()
    console.log('\n===== file', src, 'len', js.length)
    const keys = ['gromname', '1990i', 'gsystem', 'arcade', 'rompath', '/rom', 'zip', 'fetch(']
    for (const k of keys) {
      let from = 0
      let n = 0
      while (n < 3) {
        const idx = js.indexOf(k, from)
        if (idx < 0) break
        console.log(`-- ${k} @${idx}:`, JSON.stringify(js.slice(Math.max(0, idx - 60), idx + 120)))
        from = idx + k.length
        n++
      }
    }
  }

  // also check common arcade loader pages / endpoints referenced in html
  const urls = [...playHtml.matchAll(/https?:\/\/[^"'>\s]+/g)].map((m) => m[0])
  console.log('\nunique urls', [...new Set(urls)].join('\n'))
}

main().catch(console.error)
