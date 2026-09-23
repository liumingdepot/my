import type { PlaySource } from './types'

/** 解析 MacCMS vod_play_url / vod_play_from → 可播放线路 */
export function parsePlayUrl(vodPlayUrl: string, vodPlayFrom = '', sourceName = '源'): PlaySource[] {
  if (!vodPlayUrl) return []
  const fromNames = vodPlayFrom
    ? vodPlayFrom.split('$$$').map((s) => s.trim()).filter(Boolean)
    : []

  return vodPlayUrl
    .split('$$$')
    .map((chunk, index) => {
      if (!chunk.includes('.m3u8') && !chunk.includes('.mp4')) return null
      const episodes = chunk
        .split('#')
        .map((ep, epIndex) => {
          const dollar = ep.indexOf('$')
          if (dollar < 0) return null
          const title = ep.slice(0, dollar).trim() || `第${epIndex + 1}集`
          const url = ep.slice(dollar + 1).trim()
          if (!url) return null
          if (!url.includes('.m3u8') && !url.includes('.mp4')) return null
          return { title, url }
        })
        .filter((e): e is { title: string; url: string } => !!e)

      if (!episodes.length) return null
      const lineName = fromNames[index] || `${sourceName}${index + 1}`
      return { title: lineName, episodes }
    })
    .filter((s): s is PlaySource => !!s)
}

/** 仅取豆瓣评分（不含站内 vod_score） */
export function scoreOf(item: { vod_douban_score?: string }) {
  const raw = item.vod_douban_score || ''
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
}
