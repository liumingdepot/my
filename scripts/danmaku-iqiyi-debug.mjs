import { searchIqiyi, fetchIqiyiParts, fetchIqiyiComments } from '../server/video/danmaku/iqiyi.ts'

const list = await searchIqiyi('庆余年')
console.log('search', list.length, list.slice(0, 3))

if (!list.length) {
  // dump raw templates
  const params = {
    key: '庆余年',
    current_page: '1',
    mode: '1',
    source: 'input',
    suggest: '',
    pcv: '13.074.22699',
    version: '13.074.22699',
    pageNum: '1',
    pageSize: '25',
    pu: '',
    u: 'f6440fc5d919dca1aea12b6aff56e1c7',
    scale: '200',
    token: '',
    userVip: '0',
    conduit: '',
    vipType: '-1',
    os: '',
    osShortName: 'win10',
    dataType: '',
    appMode: '',
    ad: JSON.stringify({ lm: 3, azd: 1000000000951, azt: 733, position: 'feed' }),
    adExt: JSON.stringify({ r: '2.1.5-ares6-pure' }),
  }
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  const res = await fetch(`https://mesh.if.iqiyi.com/portal/lw/search/homePageV3?${qs}`, {
    headers: {
      Accept: '*/*',
      Origin: 'https://www.iqiyi.com',
      Referer: 'https://www.iqiyi.com/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  console.log('raw status', res.status)
  const data = await res.json()
  console.log('raw code', data.code, 'templates', data.data?.templates?.length)
  const t0 = data.data?.templates?.find((t) => t.albumInfo || t.intentAlbumInfos)
  const album = t0?.albumInfo || t0?.intentAlbumInfos?.[0]
  console.log('sample album', {
    title: album?.title,
    channel: album?.channel,
    pageUrl: album?.pageUrl,
    btnText: album?.btnText,
    qipuId: album?.qipuId,
  })
  process.exit(0)
}

const parts = await fetchIqiyiParts(list[0].id)
console.log('parts', parts.length, parts[0])
if (parts[0]) {
  const cs = await fetchIqiyiComments(parts[0].id)
  console.log('comments', cs.length, cs[0])
}
