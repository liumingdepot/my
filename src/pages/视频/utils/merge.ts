import type { MergedEntry, VodItem } from './types'
import { parsePlayUrl } from './parse'

function nameKey(name: string) {
  return name.trim().replace(/\s+/g, '').toLowerCase()
}

function uniqSources(sources: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of sources) {
    const t = s.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function entryKey(entry: MergedEntry) {
  return `${entry.source}::${entry.vod_id}`
}

function uniqEntries(entries: MergedEntry[]) {
  const seen = new Set<string>()
  const out: MergedEntry[] = []
  for (const entry of entries) {
    const source = entry.source.trim()
    if (!source) continue
    const next = { source, vod_id: entry.vod_id }
    const key = entryKey(next)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(next)
  }
  return out
}

function entriesOf(item: VodItem): MergedEntry[] {
  if (item.mergedEntries?.length) return uniqEntries(item.mergedEntries)
  return [{ source: item.source, vod_id: item.vod_id }]
}

/** 按片名合并多源结果，同名只展示一条，并保留各源 id 供播放页切换 */
export function mergeVodLists(existing: VodItem[], incoming: VodItem[]): VodItem[] {
  const map = new Map<string, VodItem>()
  const order: string[] = []
  const seenIds = new Set<string>()

  function add(item: VodItem) {
    const idKey = `${item.source}::${item.vod_id}`
    if (seenIds.has(idKey)) return
    seenIds.add(idKey)

    const key = nameKey(item.vod_name)
    if (!key) {
      const fallback = idKey
      if (!map.has(fallback)) {
        const mergedEntries = entriesOf(item)
        map.set(fallback, {
          ...item,
          mergedSources: mergedEntries.map((e) => e.source),
          mergedEntries,
          playSources: [...(item.playSources || [])],
        })
        order.push(fallback)
      }
      return
    }

    const prev = map.get(key)
    if (!prev) {
      const mergedEntries = entriesOf(item)
      map.set(key, {
        ...item,
        mergedSources: mergedEntries.map((e) => e.source),
        mergedEntries,
        playSources: [...(item.playSources || [])],
      })
      order.push(key)
      return
    }

    const mergedEntries = uniqEntries([...entriesOf(prev), ...entriesOf(item)])
    const mergedSources = uniqSources(mergedEntries.map((e) => e.source))
    map.set(key, {
      ...prev,
      vod_pic: prev.vod_pic || item.vod_pic,
      vod_douban_score: prev.vod_douban_score || item.vod_douban_score,
      vod_blurb: prev.vod_blurb || item.vod_blurb,
      vod_content: prev.vod_content || item.vod_content,
      vod_remarks: prev.vod_remarks || item.vod_remarks,
      vod_year: prev.vod_year || item.vod_year,
      vod_area: prev.vod_area || item.vod_area,
      type_name: prev.type_name || item.type_name,
      mergedSources,
      mergedEntries,
      playSources: [...(prev.playSources || []), ...(item.playSources || [])],
    })
  }

  for (const item of existing) add(item)
  for (const item of incoming) add(item)
  return order.map((k) => map.get(k)!)
}

export function withPlaySources(item: VodItem): VodItem {
  const playSources = parsePlayUrl(item.vod_play_url, item.vod_play_from, item.source)
  return { ...item, playSources }
}

function mirrorStorageKey(source: string, id: string | number) {
  return `video:mirrors:${source}:${id}`
}

/** 把合并后的多源条目写入 sessionStorage，每个源 id 都能读到同一份列表 */
export function saveMergedEntries(entries: MergedEntry[]) {
  const list = uniqEntries(entries)
  if (!list.length) return
  const json = JSON.stringify(list)
  try {
    for (const entry of list) {
      sessionStorage.setItem(mirrorStorageKey(entry.source, entry.vod_id), json)
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadMergedEntries(
  source: string,
  id: string | number,
  fallback?: MergedEntry[],
): MergedEntry[] {
  try {
    const raw = sessionStorage.getItem(mirrorStorageKey(source, id))
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        const list = uniqEntries(
          parsed.filter(
            (row): row is MergedEntry =>
              !!row &&
              typeof row === 'object' &&
              typeof (row as MergedEntry).source === 'string' &&
              (row as MergedEntry).vod_id != null,
          ),
        )
        if (list.length) return list
      }
    }
  } catch {
    /* ignore */
  }
  if (fallback?.length) return uniqEntries(fallback)
  return [{ source, vod_id: id }]
}
