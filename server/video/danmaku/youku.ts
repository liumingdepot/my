/**
 * 优酷弹幕：复用既有解析逻辑，适配统一多源类型
 */

import {
  searchDanmakuSources,
  fetchDanmakuParts as fetchYoukuPartsRaw,
  fetchDanmakuComments as fetchYoukuCommentsRaw,
} from '../danmaku.js'
import type { DanmakuComment, DanmakuPart, DanmakuSearchItem } from './types.js'

export async function searchYouku(keyword: string): Promise<DanmakuSearchItem[]> {
  try {
    const result = await searchDanmakuSources({ keyword })
    return result.list.map((item) => ({
      platform: 'youku' as const,
      id: item.showId,
      title: item.title,
      pic: item.pic,
      type: item.type,
      year: item.year,
      episodeCount: item.episodeCount,
      kind: item.kind || '正片',
    }))
  } catch {
    return []
  }
}

export async function fetchYoukuParts(showId: string, mediaType = ''): Promise<DanmakuPart[]> {
  try {
    const result = await fetchYoukuPartsRaw({ showId, mediaType })
    return result.pages.map((p) => ({
      id: p.vid,
      title: p.title,
      episodeIndex: p.episodeIndex,
      link: p.link,
    }))
  } catch {
    return []
  }
}

export async function fetchYoukuComments(vid: string): Promise<DanmakuComment[]> {
  try {
    return await fetchYoukuCommentsRaw({ vid })
  } catch {
    return []
  }
}
