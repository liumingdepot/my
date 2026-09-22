import type { ClassNode, QqFilterGroup, QqTitle, VodItem, VodListResult } from './types'
import { withPlaySources } from './merge'

async function getJson<T>(
  path: string,
  params?: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(path, window.location.origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url.toString(), signal ? { signal } : undefined)
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    throw new Error(data.error || '请求失败')
  }
  return data
}

function mapList(data: VodListResult): VodListResult {
  return {
    ...data,
    list: data.list.map(withPlaySources),
  }
}

export function fetchSources() {
  return getJson<{ list: { name: string }[]; primary: string }>('/api/video/sources')
}

export function fetchClasses(source?: string) {
  return getJson<{ list: ClassNode[]; source: string }>(
    '/api/video/classes',
    source ? { source } : undefined,
  )
}

export function listVideos(t: string | number, pg = 1, source?: string) {
  return getJson<VodListResult>('/api/video/list', {
    t,
    pg,
    ...(source ? { source } : {}),
  }).then(mapList)
}

export function searchVideos(q: string, pg = 1, source?: string, signal?: AbortSignal) {
  return getJson<VodListResult>(
    '/api/video/search',
    {
      q,
      pg,
      ...(source ? { source } : {}),
    },
    signal,
  ).then(mapList)
}

export function fetchDetail(ids: string | number, source: string) {
  return getJson<VodListResult>('/api/video/detail', { ids, source }).then(mapList)
}

export async function fetchDetailItem(ids: string | number, source: string): Promise<VodItem | null> {
  const data = await fetchDetail(ids, source)
  return data.list[0] ?? null
}

export function fetchQqChannel(pageId: string) {
  return getJson<{ list: QqTitle[]; menus?: { title: string; filter: string }[]; page_id: string }>(
    '/api/video/qq',
    { page_id: pageId },
  )
}

export function fetchQqList(channelId: string, filter: string, ctx?: string) {
  return getJson<{
    list: QqTitle[]
    filters: QqFilterGroup[]
    has_next: boolean
    next_ctx: string
    channel_id: string
    filter: string
  }>('/api/video/qq/list', {
    channel_id: channelId,
    filter,
    ...(ctx ? { ctx } : {}),
  })
}

/** 把筛选选中值拼成腾讯 filter_params（对齐 getMVLPage） */
export function buildQqFilterParams(selected: Record<string, string>) {
  const params: Record<string, string> = {
    sort: selected.sort || '75',
    itype: selected.itype ?? '-1',
    ipay: selected.ipay ?? '-1',
    iarea: selected.iarea ?? '-1',
    iyear: selected.iyear ?? '-1',
    producer: selected.producer ?? '-1',
    characteristic: selected.characteristic ?? '-1',
  }
  for (const [k, v] of Object.entries(selected)) {
    if (!(k in params) && v) params[k] = v
  }
  return Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
}
