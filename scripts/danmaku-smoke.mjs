import { searchTencent, fetchTencentParts, fetchTencentComments } from '../server/video/danmaku/tencent.ts'
import { searchIqiyi, fetchIqiyiParts, fetchIqiyiComments } from '../server/video/danmaku/iqiyi.ts'
import { searchBilibili, fetchBilibiliParts, fetchBilibiliComments } from '../server/video/danmaku/bilibili.ts'
import { searchYouku, fetchYoukuParts, fetchYoukuComments } from '../server/video/danmaku/youku.ts'
import { searchDanmakuSources } from '../server/video/danmaku/index.ts'

async function probe(name, search, partsFn, commentsFn, kw) {
  try {
    const list = await search(kw)
    console.log(`\n[${name}] search=${list.length}`, list.slice(0, 2).map((x) => ({
      id: x.id,
      t: x.title,
      ep: x.episodeCount,
      kind: x.kind,
    })))
    if (!list[0]) return
    const ps = await partsFn(list[0])
    console.log(`[${name}] parts=${ps.length}`, ps[0])
    if (!ps[0]) return
    const cs = await commentsFn(ps[0].id)
    console.log(`[${name}] comments=${cs.length}`, cs[0])
  } catch (e) {
    console.log(`[${name}] ERR`, e instanceof Error ? e.message : e)
  }
}

await probe(
  'tencent',
  searchTencent,
  (item) => fetchTencentParts(item.id),
  fetchTencentComments,
  '庆余年',
)
await probe(
  'iqiyi',
  searchIqiyi,
  (item) => fetchIqiyiParts(item.id),
  fetchIqiyiComments,
  '庆余年',
)
await probe(
  'bilibili',
  searchBilibili,
  (item) => fetchBilibiliParts(item.id),
  fetchBilibiliComments,
  '庆余年',
)
await probe(
  'youku',
  searchYouku,
  (item) => fetchYoukuParts(item.id, item.type || ''),
  fetchYoukuComments,
  '以法之名',
)

console.log('\n=== merged search 庆余年 ===')
const merged = await searchDanmakuSources({ keyword: '庆余年' })
const by = {}
for (const i of merged.list) by[i.platform] = (by[i.platform] || 0) + 1
console.log('total', merged.total, by)
console.log(
  'top8',
  merged.list.slice(0, 8).map((x) => ({ p: x.platform, t: x.title, kind: x.kind })),
)
