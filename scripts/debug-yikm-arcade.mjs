const LIST_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

async function main() {
  const url = `https://www.yikm.net/nes?page=1&tag=${encodeURIComponent('动作')}&e=1`
  const res = await fetch(url, {
    headers: {
      'User-Agent': LIST_UA,
      Accept: 'text/html,application/xhtml+xml',
      Referer: 'https://www.yikm.net/',
    },
  })
  const html = await res.text()
  console.log('status', res.status, 'len', html.length)
  console.log('has col-md-3 col-xs-6', html.includes('col-md-3 col-xs-6'))
  console.log('has col-md-3', html.includes('col-md-3'))
  console.log('play?id count', (html.match(/\/play\?id=\d+/g) || []).length)
  console.log('card-caption', (html.match(/card-caption/g) || []).length)
  console.log('img-raised', (html.match(/img-raised/g) || []).length)

  // find class patterns around cards
  const classHits = [...html.matchAll(/class="([^"]*col-md[^"]*)"/g)].slice(0, 20).map((m) => m[1])
  console.log('col-md classes sample', classHits)

  const i = html.indexOf('/play?id=')
  console.log('around first play', html.slice(Math.max(0, i - 400), i + 400))

  // try first play page
  const id = html.match(/\/play\?id=(\d+)/)?.[1]
  if (id) {
    const playRes = await fetch(`https://www.yikm.net/play?id=${id}`, {
      headers: {
        'User-Agent': LIST_UA,
        Accept: 'text/html',
        Referer: 'https://www.yikm.net/',
      },
    })
    const playHtml = await playRes.text()
    console.log('\nplay status', playRes.status, 'id', id, 'len', playHtml.length)
    const grom = playHtml.match(/var gromname="([^"]*)"/)
    const allVars = playHtml.match(/var gromname=[^;]+;/)
    console.log('grom match', grom?.[1])
    console.log('var line', allVars?.[0])
    const alt = playHtml.match(/gromname\s*=\s*["']([^"']+)["']/)
    console.log('alt grom', alt?.[1])
    // search rom related
    for (const key of ['gromname', 'rom', 'download', 'file.1990i', '.zip', '.nes']) {
      console.log(key, playHtml.includes(key))
    }
    const zi = playHtml.indexOf('gromname')
    console.log('around gromname', playHtml.slice(Math.max(0, zi - 100), zi + 300))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
