/**
 * hongguo-mac FastAPI 契约适配层（测试模块 /api/test）
 */

import type { HongguoDetail, HongguoListItem } from '../hongguo/hongguo.js'

export const GENRES = {
  short_play: { name: '真人剧', category: '' },
  comic_series: { name: '漫剧', category: 'comic' },
  ai_series: { name: 'AI剧', category: 'ai' },
} as const

export type GenreId = keyof typeof GENRES

export const RANK_BOARDS = ['recommend', 'hot', 'new'] as const
export type RankBoard = (typeof RANK_BOARDS)[number]

export const RANK_NAMES: Record<RankBoard, string> = {
  recommend: '漫剧推荐榜',
  hot: '漫剧热播榜',
  new: '漫剧新剧榜',
}

export type MacItem = {
  series_id: string
  title: string
  cover: string
  episode_cnt: number
  score: string
  play_cnt: number
  hot: string
  category: string
  intro: string
  vid?: string
  stream_url?: string
  episodes_url?: string
}

export type MacEpisode = {
  index: number
  vid: string
  title: string
  duration: number
  cover: string
}

export type MacMeta = {
  series_id: string
  title: string
  intro: string
  episode_cnt: number
  status: string
  play_cnt: number
  followed_cnt: number
  cover: string
  category: string | string[]
  score: string
}

const THEME_BY_GENRE: Record<GenreId, string[]> = {
  short_play: ['甜宠', '虐恋', '逆袭', '复仇', '霸总', '重生', '穿越', '古装'],
  comic_series: ['玄幻', '都市', '热血', '恋爱', '搞笑', '冒险', '系统', '修仙'],
  ai_series: ['科幻', '奇幻', '剧情', '恋爱', '悬疑', '动作'],
}

const API_BASE = '/api/test'

export function isGenre(v: string): v is GenreId {
  return v in GENRES
}

export function categoryOfGenre(genre: string): string {
  if (!isGenre(genre)) return ''
  return GENRES[genre].category
}

export function toMacItem(item: HongguoListItem, base = API_BASE): MacItem {
  const sid = String(item.id)
  const play = Number(item.hot_value) || 0
  return {
    series_id: sid,
    title: item.title || sid,
    cover: item.image_link || '',
    episode_cnt: Number(item.total_num) || 0,
    score: '',
    play_cnt: play,
    hot: item.hot_value ? `${item.hot_value}` : '',
    category: item.sub_title || '',
    intro: item.sub_title || '',
    stream_url: `${base}/stream?series_id=${encodeURIComponent(sid)}&ep=1`,
    episodes_url: `${base}/episodes?series_id=${encodeURIComponent(sid)}`,
  }
}

export function toMacEpisodes(detail: HongguoDetail): { meta: MacMeta; episodes: MacEpisode[] } {
  const sid = detail.playlet_id
  const episodes = (detail.play_list || []).map((ep, i) => {
    const index = Number(ep.sort) || i + 1
    return {
      index,
      vid: ep.video_id,
      title: ep.title || `第${index}集`,
      duration: Number(ep.duration) || 0,
      cover: ep.first_img || detail.image_link || '',
    }
  })
  const status =
    detail.is_over === '1' ? '完结' : detail.is_over === '0' ? '连载中' : detail.release_status || ''
  return {
    meta: {
      series_id: sid,
      title: detail.title,
      intro: detail.intro || '',
      episode_cnt: Number(detail.total_episode_num) || episodes.length,
      status,
      play_cnt: 0,
      followed_cnt: 0,
      cover: detail.image_link || '',
      category: detail.tags || '',
      score: '',
    },
    episodes,
  }
}

export function macFilters(genre: string) {
  const g: GenreId = isGenre(genre) ? genre : 'short_play'
  const themes = THEME_BY_GENRE[g]
  return {
    genre: g,
    name: GENRES[g].name,
    rows: [
      {
        type: 'category_dim_theme',
        label: '主题',
        items: themes.map((name) => ({ id: name, name })),
      },
      {
        type: 'sort',
        label: '排序',
        items: [
          { id: 'hot', name: '最热' },
          { id: 'new', name: '最新' },
        ],
      },
    ],
  }
}
