const LIST_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

async function main() {
  const js = await (
    await fetch('https://file.yikm.net/libs/pclib.js?v=39', {
      headers: { 'User-Agent': LIST_UA },
    })
  ).text()
  console.log('len', js.length)
  for (const k of [
    'gromname',
    'gsystem',
    '1990i',
    'arcade',
    'gameType',
    'rom',
    'download',
    'file.',
    'arcaderom',
    'mame',
  ]) {
    let from = 0
    let n = 0
    while (n < 5) {
      const idx = js.indexOf(k, from)
      if (idx < 0) break
      console.log(`\n[${k} @${idx}]`, js.slice(Math.max(0, idx - 100), idx + 180).replace(/\s+/g, ' '))
      from = idx + k.length
      n++
    }
  }
}

main().catch(console.error)
