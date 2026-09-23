export type PlayEpisode = {
  title: string
  url: string
}

export type PlaySource = {
  title: string
  episodes: PlayEpisode[]
}

/** 同名合并后的各采集源条目（播放页可切换） */
export type MergedEntry = {
  source: string
  vod_id: string | number
}

export type ClassNode = {
  type_id: number
  type_pid: number
  type_name: string
}

export type VodItem = {
  vod_id: string | number
  vod_name: string
  vod_pic: string
  vod_remarks: string
  vod_blurb: string
  vod_content?: string
  vod_actor: string
  vod_director: string
  vod_area: string
  vod_year: string
  vod_en: string
  vod_class?: string
  vod_score?: string
  vod_douban_score?: string
  type_id: string | number
  type_name: string
  vod_play_url: string
  vod_play_from?: string
  source: string
  /** 同名合并后的采集源列表（展示用） */
  mergedSources?: string[]
  /** 同名合并后的各源 id，播放页用来拉取并切换资源 */
  mergedEntries?: MergedEntry[]
  playSources?: PlaySource[]
}

export type VodListResult = {
  list: VodItem[]
  page: number
  pagecount: number
  total: number
}

/** 腾讯视频频道片名（点击走智能匹配） */
export type QqTitle = {
  title: string
  pic: string
  /** 横图（Banner 优先） */
  pic_hz?: string
  sub?: string
  cid?: string
  year?: string
  score?: string
  badge?: string
}

export type QqFilterOption = {
  n: string
  v: string
}

export type QqFilterGroup = {
  key: string
  name: string
  options: QqFilterOption[]
}

export type NavKey =
  | 'home'
  | 'short'
  | 'movie'
  | 'tv'
  | 'anime'
  | 'variety'
  | 'child'
  | 'music'
  | 'doco'
  | 'actor'
