/**
 * 腾讯视频弹幕：搜索 / 分集 / barrage 分段拉取
 */

import {
  UA,
  cleanTitle,
  clampComment,
  sortComments,
  type DanmakuComment,
  type DanmakuPart,
  type DanmakuSearchItem,
} from './types.js'

const SEARCH_URL =
  'https://pbaccess.video.qq.com/trpc.videosearch.mobile_search.MultiTerminalSearch/MbSearch?vplatform=2'
const EPISODES_URL =
  'https://pbaccess.video.qq.com/trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData?video_appid=3000010&vversion_name=8.2.96&vversion_platform=2'
const DM_BASE = 'https://dm.video.qq.com/barrage/base/'
const DM_SEG = 'https://dm.video.qq.com/barrage/segment/'

const ALLOWED_TYPES = new Set(['电视剧', '动漫', '电影', '纪录片', '综艺', '综艺节目'])

async function postJson<T>(url: string, body: unknown, referer: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://v.qq.com',
        Referer: referer,
        'User-Agent': UA,
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function filterItem(item: {
  videoInfo?: {
    year?: number
    subTitle?: string
    playFlag?: number
    title?: string
    typeName?: string
    imgUrl?: string
    playSites?: Array<{ enName?: string }>
    episodeSites?: Array<{ enName?: string }>
    subjectDoc?: { videoNum?: number }
    hintWords?: string
  }
  doc?: { id?: string }
}): DanmakuSearchItem | null {
  const info = item.videoInfo
  const cid = item.doc?.id
  if (!info?.title || !cid) return null
  if (!info.year) return null
  if (info.subTitle === '全网搜' || info.playFlag === 2) return null

  const title = cleanTitle(info.title)
  const typeName = info.typeName || ''
  if (typeName.includes('短剧')) return null
  if (!ALLOWED_TYPES.has(typeName)) return null

  const sites = [...(info.playSites || []), ...(info.episodeSites || [])]
  if (sites.length && !sites.some((s) => s.enName === 'qq')) return null

  const junk = ['花絮', '彩蛋', '解说', '特辑', '混剪', '解析', '抢先', '幕后']
  if (typeName === '电影' && junk.some((k) => title.includes(k))) return null

  return {
    platform: 'tencent',
    id: cid,
    title,
    pic: info.imgUrl || '',
    type: typeName,
    year: info.year || null,
    episodeCount: typeName === '电影' ? 1 : Number(info.subjectDoc?.videoNum) || 0,
    kind: '正片',
  }
}

function extractEpisodesFromModules(data: {
  data?: {
    module_list_datas?: Array<{
      module_datas?: Array<{
        item_data_lists?: {
          item_datas?: Array<{
            item_params?: { vid?: string; title?: string; union_title?: string; is_trailer?: string }
          }>
        }
        module_params?: { tabs?: string }
      }>
    }>
  }
}) {
  const episodes: Array<{ vid: string; title: string }> = []
  const seen = new Set<string>()
  let tabs: Array<{ page_context?: string; title?: string }> = []

  for (const ml of data.data?.module_list_datas || []) {
    for (const mod of ml.module_datas || []) {
      if (mod.module_params?.tabs) {
        try {
          tabs = JSON.parse(mod.module_params.tabs)
        } catch {
          // ignore
        }
      }
      for (const item of mod.item_data_lists?.item_datas || []) {
        const p = item.item_params
        if (!p?.vid || p.is_trailer === '1' || seen.has(p.vid)) continue
        seen.add(p.vid)
        episodes.push({
          vid: p.vid,
          title: p.union_title || p.title || p.vid,
        })
      }
    }
  }
  return { episodes, tabs, seen }
}

export async function searchTencent(keyword: string): Promise<DanmakuSearchItem[]> {
  const q = keyword.trim()
  if (!q) return []

  const payload = {
    version: '25071701',
    clientType: 1,
    filterValue: '',
    uuid: '0379274D-05A0-4EB6-A89C-878C9A460426',
    query: q,
    retry: 0,
    pagenum: 0,
    isPrefetch: true,
    pagesize: 30,
    queryFrom: 0,
    searchDatakey: '',
    transInfo: '',
    isneedQc: true,
    preQid: '',
    adClientInfo: '',
    extraInfo: {
      multi_terminal_pc: '1',
      themeType: '1',
      sugRelatedIds: '{}',
      appVersion: '',
    },
  }

  const data = await postJson<{
    ret?: number
    data?: {
      areaBoxList?: Array<{ boxId?: string; itemList?: unknown[] }>
      normalList?: { itemList?: unknown[] }
    }
  }>(SEARCH_URL, payload, `https://v.qq.com/x/search/?q=${encodeURIComponent(q)}`)

  if (!data || data.ret !== 0) return []

  let itemList: unknown[] = []
  for (const box of data.data?.areaBoxList || []) {
    if (box.boxId === 'MainNeed' && box.itemList?.length) {
      itemList = box.itemList
      break
    }
  }
  if (!itemList.length) itemList = data.data?.normalList?.itemList || []

  const list: DanmakuSearchItem[] = []
  const seen = new Set<string>()
  for (const raw of itemList) {
    const item = filterItem(raw as Parameters<typeof filterItem>[0])
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    list.push(item)
  }
  return list
}

export async function fetchTencentParts(cid: string): Promise<DanmakuPart[]> {
  const id = cid.trim()
  if (!id) return []

  const basePayload = {
    has_cache: 1,
    page_params: {
      req_from: 'web_vsite',
      page_id: 'vsite_episode_list',
      page_type: 'detail_operation',
      id_type: '1',
      page_size: '',
      cid: id,
      vid: '',
      lid: '',
      page_num: '',
      page_context: `cid=${id}&detail_page_type=1&req_from=web_vsite&req_from_second_type=&req_type=0`,
      detail_page_type: '1',
    },
  }

  const first = await postJson<{
    ret?: number
    data?: unknown
  }>(EPISODES_URL, basePayload, `https://v.qq.com/x/cover/${id}.html`)

  if (!first || first.ret !== 0) return []

  const { episodes, tabs, seen } = extractEpisodesFromModules(first as Parameters<typeof extractEpisodesFromModules>[0])

  // 多页 tabs
  for (const tab of tabs) {
    const ctx = tab.page_context
    if (!ctx) continue
    const pagePayload = {
      has_cache: 1,
      page_params: {
        req_from: 'web_vsite',
        page_id: 'vsite_episode_list',
        page_type: 'detail_operation',
        id_type: '1',
        page_size: '',
        cid: id,
        vid: '',
        lid: '',
        page_num: '',
        page_context: ctx,
        detail_page_type: '1',
      },
    }
    const page = await postJson<{ ret?: number; data?: unknown }>(
      EPISODES_URL,
      pagePayload,
      `https://v.qq.com/x/cover/${id}.html`,
    )
    if (!page || page.ret !== 0) continue
    const more = extractEpisodesFromModules(page as Parameters<typeof extractEpisodesFromModules>[0])
    for (const ep of more.episodes) {
      if (seen.has(ep.vid)) continue
      seen.add(ep.vid)
      episodes.push(ep)
    }
  }

  return episodes.map((ep, i) => ({
    id: ep.vid,
    title: cleanTitle(ep.title) || `第${i + 1}集`,
    episodeIndex: i + 1,
    link: `https://v.qq.com/x/cover/${id}/${ep.vid}.html`,
  }))
}

function extractVid(input: string) {
  const m = input.match(/\/([a-z0-9]+)\.html/i) || input.match(/[?&]vid=([a-z0-9]+)/i)
  if (m?.[1]) return m[1]
  if (/^[a-z0-9]+$/i.test(input.trim())) return input.trim()
  return ''
}

export async function fetchTencentComments(vidOrUrl: string): Promise<DanmakuComment[]> {
  const vid = extractVid(vidOrUrl)
  if (!vid) return []

  let base: { segment_index?: Record<string, { segment_name?: string; segment_start?: string | number }> }
  try {
    const res = await fetch(DM_BASE + vid, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return []
    base = (await res.json()) as typeof base
  } catch {
    return []
  }

  const segments = Object.values(base.segment_index || {})
  if (!segments.length) return []

  const raw: Array<{
    time_offset?: number
    content?: string
    content_style?: string
  }> = []

  const concurrency = 8
  for (let i = 0; i < segments.length; i += concurrency) {
    const batch = segments.slice(i, i + concurrency)
    const settled = await Promise.allSettled(
      batch.map(async (seg) => {
        const name = seg.segment_name
        if (!name) return [] as typeof raw
        const res = await fetch(`${DM_SEG}${vid}/${name}`, {
          headers: { 'User-Agent': UA, Accept: 'application/json' },
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) return []
        const data = (await res.json()) as { barrage_list?: typeof raw }
        return data.barrage_list || []
      }),
    )
    for (const s of settled) {
      if (s.status === 'fulfilled') raw.push(...s.value)
    }
  }

  const list: DanmakuComment[] = []
  for (const item of raw) {
    let color = 0xffffff
    let mode = 1
    if (item.content_style) {
      try {
        const style = JSON.parse(item.content_style) as {
          color?: string
          gradient_colors?: string[]
          position?: number
        }
        const hex = style.gradient_colors?.[0] || style.color
        if (hex && hex !== 'ffffff') color = parseInt(hex.replace('#', ''), 16) || 0xffffff
        if (style.position === 2) mode = 5
        else if (style.position === 3) mode = 4
      } catch {
        // ignore
      }
    }
    const c = clampComment({
      time: Number(item.time_offset) / 1000,
      mode,
      color,
      text: item.content || '',
    })
    if (c) list.push(c)
  }
  return sortComments(list)
}
