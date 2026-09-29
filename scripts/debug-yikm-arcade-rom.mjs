const LIST_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

async function main() {
  const playHtml = await (
    await fetch('https://www.yikm.net/play?id=9247', {
      headers: { 'User-Agent': LIST_UA, Referer: 'https://www.yikm.net/' },
    })
  ).text()

  // find rom path construction
  const hits = []
  for (const re of [
    /file\.1990i\.com[^"'\s]*/g,
    /gromname[^;]{0,200}/g,
    /arcade[^"']{0,80}/gi,
    /rom[^"']{0,80}/gi,
    /gsystem[^;]{0,120}/g,
  ]) {
    const m = playHtml.match(re)
    if (m) hits.push(...m.slice(0, 8))
  }
  console.log([...new Set(hits)].join('\n'))

  // fetch related js that might build rom url
  const scripts = [...playHtml.matchAll(/src="(https:\/\/[^"]+\.js)"/g)].map((m) => m[1])
  console.log('\nscripts', scripts)

  for (const src of scripts) {
    if (!/yikm|1990i|arcade|emulator|play/i.test(src)) continue
    const js = await (await fetch(src, { headers: { 'User-Agent': LIST_UA } })).text()
    const related = []
    for (const key of ['gromname', 'file.1990i', 'gsystem', 'arcade', 'rompath', 'rom_url']) {
      if (js.includes(key)) related.push(key)
    }
    if (related.length) {
      console.log('\n===', src, related)
      const idx = js.indexOf('gromname')
      if (idx >= 0) console.log(js.slice(idx - 80, idx + 400))
      const idx2 = js.indexOf('file.1990i')
      if (idx2 >= 0) console.log('cdn', js.slice(idx2 - 80, idx2 + 300))
    }
  }

  // probe possible download urls
  const candidates = [
    'https://file.1990i.com/jjsquawk.zip',
    'https://file.1990i.com/arcade/jjsquawk.zip',
    'https://file.1990i.com/roms/jjsquawk.zip',
    'https://file.1990i.com/arcaderom/jjsquawk.zip',
    'https://file.1990i.com/capcom-cps-1/jjsquawk.zip',
  ]
  for (const u of candidates) {
    const r = await fetch(u, {
      method: 'HEAD',
      headers: { 'User-Agent': LIST_UA, Referer: 'https://www.yikm.net/' },
      redirect: 'manual',
    })
    console.log('HEAD', r.status, u, r.headers.get('content-type'), r.headers.get('content-length'))
  }
}

main().catch(console.error)
